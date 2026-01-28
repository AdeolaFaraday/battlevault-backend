import { verify } from 'jsonwebtoken';
import User from '../../../../models/user/user';
import { jwt } from '../../../../config/environment'

export const getUserLocal = (req: any, res: any) => {
    return async () => {
        // Previous cookie-based auth (now disabled):
        // const token = req.cookies?.user_token || req.cookies?.admin_token;

        // Gets the currently logged in user from the Authorization Bearer token
        const authHeader = req.headers?.authorization || req.headers?.Authorization;
        const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : null;

        if (!token) {
            return null;
        }

        try {
            console.log({ gotIntoTryBlock: true });
            const decoded: any = verify(token, jwt.jwtSecret as string);
            console.log({ decoded });
            const user = await User.findById(decoded.id);
            console.log({ user });
            if (!user) {
                return null;
            }
            return user;
        } catch (error) {
            console.log({ errorBeforeReturnNull: error });
            return null;
        }

        // Other checks can be implemented here
    };
};