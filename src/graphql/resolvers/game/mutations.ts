import GameService from "../../services/game/game";
import authenticatedRequest from "../../authenticatedRequest";
import gameSessionRequest from "../../gameSessionRequest";

const gameMutations = {
    createGame: async (_: any, { input }: { input: any }, context: any) => {
        return await GameService.createGame(input);
    },

    createFreeGame: async (_: any, { name }: { name: string }, context: any) => {
        return await GameService.createFreeGame(name);
    },

    createAIGame: async (_: any, { name }: { name: string }, context: any) => {
        return await GameService.createAIGame(name);
    },

    joinGame: authenticatedRequest(async (_: any, { gameId, userId, name }: { gameId: string, userId?: string, name: string }, context: any) => {
        return await GameService.joinGame(gameId, userId, name, context);
    }, true),

    rollDice: gameSessionRequest(async (_: any, { gameId, name }: { gameId: string, name?: string }, context: any) => {
        const userId = context.getActingUserId();
        return await GameService.rollDice(gameId, userId);
    }),

    processMove: gameSessionRequest(async (_: any, { gameId, input, name }: { gameId: string, input: any, name?: string }, context: any) => {
        const userId = context.getActingUserId();
        return await GameService.processMove(gameId, input, userId);
    }),

    selectDice: gameSessionRequest(async (_: any, { gameId, diceValues, name }: { gameId: string, diceValues: number[], name?: string }, context: any) => {
        const userId = context.getActingUserId();
        return await GameService.selectDice(gameId, diceValues, userId);
    })
}

export default gameMutations;
