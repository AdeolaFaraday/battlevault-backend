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
    }
}

export default gameQueries;
