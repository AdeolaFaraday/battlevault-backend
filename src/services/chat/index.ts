import { admin } from '../auth';
import User from '../../models/user/user';

class ChatService {
    /**
     * Search users by generic query
     * @param query The search query
     * @param limit Max limit to return
     * @returns List of users matching the query
     */
    static async searchUsers(query: string, limit: number = 20, currentUserId?: string) {
        if (!query || query.trim() === '') {
            return [];
        }

        const regex = new RegExp(query, 'i');
        const filter: any = {
            $or: [
                { userName: regex },
                { firstName: regex },
                { lastName: regex },
                { email: regex }
            ]
        };

        if (currentUserId) {
            filter._id = { $ne: currentUserId };
        }

        const users = await User.find(filter)
            .select('id userName firstName lastName avatar email')
            .limit(limit)
            .lean();

        // Ensure id is mapped correctly from _id
        return users.map(u => ({
            ...u,
            id: u._id.toString()
        }));
    }

    /**
     * Create a new message between sender and recipient
     */
    static async createMessage(senderId: string, recipientId: string, text: string) {
        if (!senderId || !recipientId) throw new Error("Sender and recipient IDs are required.");
        if (senderId === recipientId) throw new Error("Cannot send a message to yourself.");

        const firestore = admin.firestore();

        // Generate a predictable chatId
        const sortedIds = [senderId, recipientId].sort();
        const chatId = `${sortedIds[0]}_${sortedIds[1]}`;

        const timestamp = new Date().toISOString();
        const chatRef = firestore.collection('chats').doc(chatId);

        const messageData = {
            chatId,
            senderId,
            text,
            timestamp,
            read: false
        };

        const batch = firestore.batch();

        // Set or update the chat document
        batch.set(chatRef, {
            participants: sortedIds,
            lastMessage: text,
            lastMessageTimestamp: timestamp,
            [`unreadCounts.${recipientId}`]: admin.firestore.FieldValue.increment(1)
        }, { merge: true });

        // Add the message
        const messageRef = chatRef.collection('messages').doc();
        batch.set(messageRef, messageData);

        await batch.commit();

        return {
            id: messageRef.id,
            ...messageData
        };
    }

    /**
     * Mark a chat as read for a user
     */
    static async markChatAsRead(chatId: string, userId: string) {
        const firestore = admin.firestore();
        await firestore.collection('chats').doc(chatId).update({
            [`unreadCounts.${userId}`]: 0
        });
        return true;
    }

    /**
     * Get chat list for a user
     */
    static async getChatList(userId: string) {
        const firestore = admin.firestore();

        const snapshot = await firestore.collection('chats')
            .where('participants', 'array-contains', userId)
            // Note: If you have an index error, Firebase will provide a direct link to create it in the logs.
            .orderBy('lastMessageTimestamp', 'desc')
            .get();

        if (snapshot.empty) {
            return [];
        }

        const chats = snapshot.docs.map(doc => {
            const data = doc.data();
            const unreadCounts = data.unreadCounts || {};
            return {
                id: doc.id,
                ...data,
                unreadCount: unreadCounts[userId] || 0
            };
        });

        // Extract all unique participant IDs to fetch their details
        const participantIds = new Set<string>();
        chats.forEach((chat: any) => {
            (chat.participants || []).forEach((pId: string) => {
                if (pId !== userId) {
                    participantIds.add(pId);
                }
            });
        });

        const users = await User.find({
            _id: { $in: Array.from(participantIds) }
        }).select('id userName firstName lastName avatar').lean();

        const userMap = new Map();
        users.forEach(u => {
            userMap.set(u._id.toString(), {
                id: u._id.toString(),
                userName: u.userName,
                firstName: u.firstName,
                lastName: u.lastName,
                avatar: u.avatar
            });
        });

        // Attach participant details
        const populatedChats = chats.map((chat: any) => {
            const details = chat.participants
                .filter((p: string) => p !== userId)
                .map((p: string) => userMap.get(p))
                .filter(Boolean);

            return {
                ...chat,
                participantDetails: details
            };
        });

        return populatedChats;
    }
}

export default ChatService;
