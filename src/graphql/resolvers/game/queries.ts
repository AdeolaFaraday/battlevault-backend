import GameService from "../../services/game/game";

const gameQueries = {
    getGame: async (_: any, { id }: { id: string }) => {
        return await GameService.getGame(id);
    },
    getUpcomingGames: async (_: any, __: any, context: any) => {
        return await GameService.getUpcomingGames(context);
    },
    getActiveGames: async (_: any, __: any, context: any) => {
        return await GameService.getActiveGames(context);
    }
}

export default gameQueries;
