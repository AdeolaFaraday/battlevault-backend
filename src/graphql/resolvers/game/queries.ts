import Game from "../../../models/game/game";

const gameQueries = {
    getGame: async (_: any, { id }: { id: string }) => {
        try {
            const game = await Game.findById(id);
            if (!game) {
                throw new Error("Game not found");
            }
            return game;
        } catch (error) {
            throw error;
        }
    },
    getUpcomingGames: async (_: any, __: any, context: any) => {
        try {
            const user = await context.getUserLocal();

            const filter: any = { status: 'waiting' };

            if (user) {
                // If authenticated, filter games where the user is a participant
                filter['players.id'] = user.id;
            }

            // Return games matching the filter, sorted by startDate (upcoming first)
            return await Game.find(filter).sort({ startDate: 1 });
        } catch (error) {
            throw error;
        }
    }
}

export default gameQueries;
