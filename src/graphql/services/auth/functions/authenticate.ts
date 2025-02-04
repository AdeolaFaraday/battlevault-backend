import { Request } from "express";
import bcrypt from 'bcrypt';
import { sign as signToken } from 'jsonwebtoken';

import { jwt as jwtEnv } from "../../../../config/environment"
import User from "../../../../models/user/user";

const jwtSecret: any = jwtEnv.jwtSecret;
const jwtExp: any = jwtEnv.jwtExp;
const setCookie = (authToken: any, user: any, res: any) => {
    res.cookie('user_token', authToken);
    return;
};

const loginUser = (user: any, res: any) => {
    const authToken = signToken({ id: user._id }, jwtSecret, {
        expiresIn: jwtExp,
    });
    setCookie(authToken, user, res);
};

export const authenticate = (req: Request, res: Response) => {
    return async (credentials: any) => {
        const { email, password } = credentials;
        if (!email || !password) {
            throw new Error('Incorrect email and password combination');
        }

        const matchingUser = await User.getUser({
            find: {
                $or: [{ email: email as string }, { username: email as string }],
            },
        });

        if (!matchingUser) {
            throw new Error('No matching user');
        }
        //  else if (!matchingUser.emailVerifiedAt) {
        //     throw new Error('Please verify your email address!');
        // } 
        else {
            try {
                if (JSON.parse(password).isValidated) {
                    loginUser(matchingUser, res);
                    return matchingUser;
                }

                throw new Error('An error occurred during authentication');
            } catch (error) {
                const isMatch = await bcrypt.compare(
                    password as string,
                    matchingUser.password
                );
                if (isMatch) {
                    loginUser(matchingUser, res);
                    return matchingUser;
                } else {
                    throw new Error('Invalid email and password combination!');
                }
            }
        }
    }
}