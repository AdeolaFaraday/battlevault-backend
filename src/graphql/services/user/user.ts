import User from "../../../models/user/user";
import ClientResponse from "../../../services/response";

export default class UserService {
    static async getAllUsers(context: any, page: number = 1, limit: number = 10, search?: string) {
        try {
            const user = context.currentUser;
            if (!user) {
                return new ClientResponse(401, false, 'Unauthorized');
            }

            if (user.role !== 'ADMIN') {
                return new ClientResponse(403, false, 'Forbidden: Admin access required');
            }

            const query: any = {};
            if (search) {
                query.$or = [
                    { userName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } }
                ];
            }

            const skip = (page - 1) * limit;

            const [users, total] = await Promise.all([
                User.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                User.countDocuments(query)
            ]);

            return new ClientResponse(200, true, 'Users retrieved successfully', {
                users,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + users.length < total
            });
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }
}
