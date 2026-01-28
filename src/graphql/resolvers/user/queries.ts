import ClientResponse from "../../../services/response";
import LeaderboardService from "../../services/user/leaderboard";
import GameService from "../../services/game/game";

const userQueries = {
    // get user in the current context
    getUser: (_: any, __: any, context: any) => {
        return new ClientResponse(200, true, 'successful', context.currentUser);
    },
    getUserStats: async (_: any, __: any, context: any) => {
        const user = await context.getUserLocal();
        if (!user) {
            return new ClientResponse(401, false, 'Unauthorized');
        }

        const totalGamesPlayed = user.totalGamesPlayed ?? 0;
        const totalWins = user.totalWins ?? 0;
        const totalLosses = user.totalLosses ?? 0;
        const currentStreak = user.currentStreak ?? 0;
        const bestStreak = user.bestStreak ?? 0;
        const winPercentage =
            totalGamesPlayed > 0 ? (totalWins / totalGamesPlayed) * 100 : 0;

        return new ClientResponse(200, true, 'successful', {
            totalGamesPlayed,
            totalWins,
            totalLosses,
            winPercentage,
            currentStreak,
            bestStreak,
        });
    },
    getUserGames: async (
        _: any,
        { limit, page, search }: { limit?: number; page?: number; search?: string },
        context: any
    ) => {
        return GameService.getUserGames(context, page, limit, search);
    },
    getLeaderboard: async (_: any, { limit, page, search }: { limit?: number; page?: number; search?: string }) => {
        return LeaderboardService.getLeaderboard({ limit, page, search });
    },
}

export default userQueries;