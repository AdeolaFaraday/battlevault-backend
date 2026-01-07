import Game from "../../../models/game/game";
import RealtimeProviderFactory from "../../../services/realtime";

const defaultPlayers = [
    {
        name: "Player 1",
        color: "BLUE",
        tokens: ["BLUE", "BLUE", "BLUE", "BLUE"]
    },
    {
        name: "Player 2",
        color: "YELLOW",
        tokens: ["YELLOW", "YELLOW", "YELLOW", "YELLOW"]
    }
];

const defaultGameState = {
    players: defaultPlayers,
    currentTurn: "1",
    diceValue: [],
    isRolling: false,
    status: "playingDice",
};

const gameMutations = {
    createGame: async (_: any, { input }: { input: any }) => {
        try {
            // Basic validation for tournament games
            if (input.type === 'TOURNAMENT') {
                if (!input.tournamentId) {
                    throw new Error("Tournament ID is required for tournament games.");
                }
                if (!input.matchStage) {
                    throw new Error("Match Stage is required for tournament games.");
                }
            }

            // Merge defaults with input. 
            // Note: input.players will override defaultPlayers if provided.
            const initialData = { ...defaultGameState, ...input };

            // Create game in MongoDB
            const game = new Game(initialData);
            const savedGame = await game.save();

            // Create corresponding document in Firebase for realtime updates
            const realtimeProvider = RealtimeProviderFactory.getProvider();
            await realtimeProvider.createGameDocument(savedGame.id, {
                name: savedGame.name,
                type: savedGame.type,
                tournamentId: savedGame.tournamentId,
                matchStage: savedGame.matchStage,
                players: savedGame.players,
                currentTurn: savedGame.currentTurn,
                diceValue: savedGame.diceValue,
                isRolling: savedGame.isRolling,
                status: savedGame.status,
            });

            return savedGame;
        } catch (error) {
            throw error;
        }
    },
    updateGame: async (_: any, { id, input }: { id: string, input: any }) => {
        try {
            // Update in MongoDB
            const game = await Game.findByIdAndUpdate(id, input, { new: true });
            if (!game) {
                throw new Error("Game not found");
            }

            // Update in Firebase for realtime sync
            const realtimeProvider = RealtimeProviderFactory.getProvider();
            await realtimeProvider.updateGameState(id, input);

            return game;
        } catch (error) {
            throw error;
        }
    },

    // New mutation for joining a game
    joinGame: async (_: any, { gameId, player }: { gameId: string, player: any }) => {
        try {
            const game = await Game.findById(gameId);
            if (!game) {
                throw new Error("Game not found");
            }

            // Check if game is full
            if (game.players.length >= 2) {
                throw new Error("Game is already full");
            }

            // Add player to MongoDB
            game.players.push(player);
            const updatedGame = await game.save();

            // Add player to Firebase
            const realtimeProvider = RealtimeProviderFactory.getProvider();
            await realtimeProvider.addPlayerToGame(gameId, player);

            return updatedGame;
        } catch (error) {
            throw error;
        }
    }
}

export default gameMutations;
