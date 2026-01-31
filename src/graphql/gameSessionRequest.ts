import ClientResponse from '../services/response';

/**
 * Wrapper for gameplay mutations that require a valid Game Session Token.
 * Extracted from x-game-session header via context.getGameSession()
 */
export default (next: any) =>
    async (root: any, args: any, context: any, info: any) => {
        // 1. Try to get valid game session from header
        // 1. Try to get valid game session from header
        const sessionPayload = context.getGameSession ? context.getGameSession() : null;

        if (!sessionPayload) {
            return new ClientResponse(401, false, 'Unauthorized: Valid Game Session Token required');
        }

        // 2. Validate that the token matches the Game ID being accessed (if gameId is in args)
        if (args.gameId && args.gameId !== sessionPayload.gameId) {
            return new ClientResponse(403, false, 'Forbidden: Token is for a different game');
        }

        // 3. Attach session info to context for easy access in resolver
        context.gameSession = sessionPayload;

        // 4. Also providing a helper to get the "acting user ID"
        // This replaces the previous logic where we checked user?.id or `name-gameId`
        context.getActingUserId = () => sessionPayload.userId;

        return next(root, args, context, info);
    };
