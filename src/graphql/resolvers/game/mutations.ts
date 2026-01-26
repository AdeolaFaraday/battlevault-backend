import GameService from "../../services/game/game";
import authenticatedRequest from "../../authenticatedRequest";

const gameMutations = {
    createGame: async (_: any, { input }: { input: any }, context: any) => {
        return await GameService.createGame(input);
    },

    createFreeGame: async (_: any, { name }: { name: string }, context: any) => {
        return await GameService.createFreeGame(name);
    },

    joinGame: authenticatedRequest(async (_: any, { gameId, userId, name }: { gameId: string, userId?: string, name: string }, context: any) => {
        return await GameService.joinGame(gameId, userId, name, context);
    }, true),

    rollDice: authenticatedRequest(async (_: any, { gameId, name }: { gameId: string, name?: string }, context: any) => {
        const user = await context.getUserLocal();
        let userId = user?.id;
        if (!userId) {
            if (!name) throw new Error("Unauthorized: Name required if not logged in");
            userId = `${name}-${gameId}`;
        }
        return await GameService.rollDice(gameId, userId);
    }, true),

    processMove: authenticatedRequest(async (_: any, { gameId, input, name }: { gameId: string, input: any, name?: string }, context: any) => {
        const user = await context.getUserLocal();
        let userId = user?.id;
        if (!userId) {
            if (!name) throw new Error("Unauthorized: Name required if not logged in");
            userId = `${name}-${gameId}`;
        }
        return await GameService.processMove(gameId, input, userId);
    }, true),

    selectDice: authenticatedRequest(async (_: any, { gameId, diceValues, name }: { gameId: string, diceValues: number[], name?: string }, context: any) => {
        const user = await context.getUserLocal();
        let userId = user?.id;
        if (!userId) {
            if (!name) throw new Error("Unauthorized: Name required if not logged in");
            userId = `${name}-${gameId}`;
        }
        return await GameService.selectDice(gameId, diceValues, userId);
    }, true)
}

export default gameMutations;
