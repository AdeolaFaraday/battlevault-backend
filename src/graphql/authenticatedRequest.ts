import ClientResponse from '../services/response';

export default (next: any, isAuthOptional: Boolean = false) =>
    async (root: any, args: any, context: any, info: any) => {
        const user = await context.getUserLocal();
        if (!user && !isAuthOptional) {
            return new ClientResponse(401, false, 'Unauthorized / Please login to perform this action');
        }
        if (user) context.currentUser = user;
        return next(root, args, context, info);
    };