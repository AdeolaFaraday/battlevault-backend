import { verify } from 'jsonwebtoken';
import User from '../../../../models/user/user';
import { jwt } from '../../../../config/environment'

export const getUserLocal = (req: any, res: any) => {
    return async () => {
        // Gets the currently logged in user from the request token;
        const token = req.cookies?.user_token || req.cookies?.admin_token;
        console.log({ USER_TOKEN: token, reqCookies: req.cookies });
        if (!token) {
            return null;
        }

        try {
            const decoded: any = verify(token, jwt.jwtSecret as string);
            const user = await User.findById(decoded.id);
            if (!user) {
                return null;
            }
            return user;
        } catch (error) {
            return null;
        }

        // Other checks can be implemented here
    };
};