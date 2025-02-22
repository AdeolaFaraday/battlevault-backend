import { Response } from 'express';
require('dotenv').config();

export const logout = (req: any, res: Response) => {
    return () => {
        if (req.cookies.user_token) {
            res.clearCookie('user_token', {
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                secure: process.env.NODE_ENV === 'production',
            });
            return;
        } else {
            throw new Error('Unauthorized');
        }
    };
};
