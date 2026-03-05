import ChatService from "../../../services/chat";
import authenticatedRequest from "../../authenticatedRequest";

export const chatMutations = {
    createMessage: authenticatedRequest(async (_: any, { recipientId, text }: { recipientId: string, text: string }, context: any) => {
        try {
            if (!context.currentUser) {
                return { statusCode: 401, success: false, message: 'Unauthorized', data: null };
            }
            const message = await ChatService.createMessage(context.currentUser.id, recipientId, text);
            return {
                statusCode: 200,
                success: true,
                message: 'Message sent successfully',
                data: message
            };
        } catch (error: any) {
            return {
                statusCode: 500,
                success: false,
                message: error.message || 'Error occurred while sending message',
                data: null
            };
        }
    }),

    markChatAsRead: authenticatedRequest(async (_: any, { chatId }: { chatId: string }, context: any) => {
        try {
            if (!context.currentUser) {
                return { statusCode: 401, success: false, message: 'Unauthorized', data: null };
            }
            await ChatService.markChatAsRead(chatId, context.currentUser.id);
            return {
                statusCode: 200,
                success: true,
                message: 'Chat marked as read',
                data: null
            };
        } catch (error: any) {
            return {
                statusCode: 500,
                success: false,
                message: error.message || 'Error occurred while marking chat as read',
                data: null
            };
        }
    })
};
