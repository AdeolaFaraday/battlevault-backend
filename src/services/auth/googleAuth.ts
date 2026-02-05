import axios from "axios";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { sign as signToken } from "jsonwebtoken";
import User from "../../models/user/user";
import { jwt as jwtEnv } from "../../config/environment";
import { generateSignUpUserData } from "../../utlis/utlis";
import { CreateUserInputs } from "../../models/user/types/userAuth";
import dotenv from "dotenv";
dotenv.config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const jwtSecret: any = jwtEnv.jwtSecret;
const jwtExp: any = jwtEnv.jwtExp;

export interface GoogleUser {
    email: string;
    name: string;
    picture?: string;
    googleId: string;
}

export default class GoogleAuthService {
    /**
     * Exchanges auth code for tokens and verifies the ID token
     */
    static async verifyCode(code: string): Promise<TokenPayload> {
        const params = new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
            grant_type: "authorization_code",
        });

        const tokenRes = await axios.post(
            "https://oauth2.googleapis.com/token",
            params.toString(),
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }
        );

        const { id_token } = tokenRes.data;

        if (!id_token) {
            throw new Error("No ID token returned from Google");
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            throw new Error("Invalid Google user payload");
        }

        return payload;
    }

    /**
     * Finds or creates a user based on Google profile
     */
    static async findOrCreateUser(payload: TokenPayload) {
        const { email } = payload;

        let user = await User.findOne({ email });

        if (!user) {
            const userData = await generateSignUpUserData(payload) as CreateUserInputs;
            user = await User.createUser(userData);
        }

        return user;
    }

    /**
     * Generates a JWT for the user (existing system's token)
     */
    static generateToken(user: any) {
        return signToken({ id: user._id }, jwtSecret, {
            expiresIn: jwtExp,
        });
    }
}
