import { sign, verify } from 'jsonwebtoken';
import { jwt } from '../config/environment';

export interface GameSessionPayload {
    userId: string;
    gameId: string;
}

/**
 * Creates a signed JWT token for a game session
 * Expires in 3 hours
 */
export const createGameSessionToken = (userId: string, gameId: string): string => {
    if (!jwt.jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
    }

    const payload: GameSessionPayload = { userId, gameId };
    return sign(payload, jwt.jwtSecret, { expiresIn: '3h' });
};

/**
 * Verifies and decodes a game session token
 * Returns the payload if valid, or null if invalid
 */
export const verifyGameSessionToken = (token: string): GameSessionPayload | null => {
    if (!jwt.jwtSecret) return null;

    try {
        const decoded = verify(token, jwt.jwtSecret) as GameSessionPayload;
        if (decoded && decoded.userId && decoded.gameId) {
            return decoded;
        }
        return null;
    } catch (error) {
        return null;
    }
};
