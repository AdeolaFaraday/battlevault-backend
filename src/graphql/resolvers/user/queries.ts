import ClientResponse from "../../../services/response";
import LeaderboardService from "../../services/user/leaderboard";
import GameService from "../../services/game/game";
import WalletService from "../../services/user/wallet";
import authenticatedRequest from "../../authenticatedRequest";

const userQueries = {
    getWallet: async (_: any, __: any, context: any) => {
        const user = await context.getUserLocal();
        if (!user) {
            return new ClientResponse(401, false, 'Unauthorized / Please login to view');
        }
        return WalletService.getWallet(user.id);
    },
    // get user in the current context
    me: authenticatedRequest(async (_: any, __: any, context: any) => {
        return new ClientResponse(200, true, 'successful', { user: context.currentUser });
    }),
    getUser: authenticatedRequest(async (_: any, __: any, context: any) => {
        return new ClientResponse(200, true, 'successful', context.currentUser);
    }),
    getUserStats: authenticatedRequest(async (_: any, __: any, context: any) => {
        const user = context.currentUser;
        if (!user) {
            return new ClientResponse(401, false, 'Unauthorized / Please login to view');
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
    }),
    getUserGames: authenticatedRequest(async (
        _: any,
        { limit, page, search }: { limit?: number; page?: number; search?: string },
        context: any
    ) => {
        return GameService.getUserGames(context, page, limit, search);
    }),
    getLeaderboard: async (_: any, { limit, page, search }: { limit?: number; page?: number; search?: string }) => {
        return LeaderboardService.getLeaderboard({ limit, page, search });
    },
}

export default userQueries;