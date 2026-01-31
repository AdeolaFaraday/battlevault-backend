import { verifyGameSessionToken, GameSessionPayload } from "../../../../utils/gameSessionToken";

export const getGameSession = (req: any) => {
    return (): GameSessionPayload | null => {
        // Check for x-game-session header
        const token = req.headers['x-game-session']; // Headers are usually lower-cased

        if (!token || typeof token !== 'string') {
            return null;
        }

        return verifyGameSessionToken(token);
    };
};
