import { verify } from 'jsonwebtoken';
import User from '../../../../models/user/user';
import { jwt } from '../../../../config/environment'

export const getUserLocal = (req: any, res: any) => {
    return async () => {
        // Gets the currently logged in user from the request token;
        const token = req.cookies?.user_token || req.cookies?.admin_token;
        if (!token) {
            return null;
        }

        const decoded: any = verify(token, jwt.jwtSecret as string);
        const user = await User.findById(decoded.id);
        if (!user) {
            return null;
        }

        // Other checks to be implemented
        /*
        1. If user has changed their password after the token was issued 
        2. Other ones I can think of righ now
        */
        return user;
    };
};