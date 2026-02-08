import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwt as jwtEnv } from '../config/environment';
import User from '../models/user/user';

export interface AuthRequest extends Request {
    user?: any;
    file?: any;
    files?: any;
}

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token;

        // Check Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        // Check cookie
        else if ((req as any).cookies && (req as any).cookies.user_token) {
            token = (req as any).cookies.user_token;
        }

        if (!token) {
            res.status(401).json({ success: false, message: 'Not authorized to access this route' });
            return;
        }

        // Verify token
        const decoded: any = jwt.verify(token, jwtEnv.jwtSecret as string);

        // Find user
        const user = await User.findById(decoded.id);

        if (!user) {
            res.status(401).json({ success: false, message: 'User not found' });
            return;
        }

        // Attach user to request
        (req as any).user = user;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
};
