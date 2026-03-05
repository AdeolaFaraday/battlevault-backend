import ChatService from "../../../services/chat";
import authenticatedRequest from "../../authenticatedRequest";

export const chatQueries = {
    searchUsers: authenticatedRequest(async (_: any, { query, limit }: { query: string, limit?: number }, context: any) => {
        try {
            const users = await ChatService.searchUsers(query, limit, context.currentUser.id);
            return {
                statusCode: 200,
                success: true,
                message: 'Users fetched successfully',
                data: { users }
            };
        } catch (error: any) {
            return {
                statusCode: 500,
                success: false,
                message: error.message || 'Error occurred while searching users',
                data: null
            };
        }
    }),

    getChatList: authenticatedRequest(async (_: any, __: any, context: any) => {
        try {
            if (!context.currentUser) {
                return { statusCode: 401, success: false, message: 'Unauthorized', data: null };
            }
            const chats = await ChatService.getChatList(context.currentUser.id);
            return {
                statusCode: 200,
                success: true,
                message: 'Chat list fetched successfully',
                data: { chats }
            };
        } catch (error: any) {
            return {
                statusCode: 500,
                success: false,
                message: error.message || 'Error occurred while fetching chat list',
                data: null
            };
        }
    })
};
