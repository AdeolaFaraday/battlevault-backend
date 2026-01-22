import Game from "../../../models/game/game";
import RealtimeProviderFactory from "../../../services/realtime";
import { admin } from "../../../services/auth";
import {
    LudoColor,
    LudoStatus,
    calculateMoveUpdate,
    getProjectedPosition,
    getMovableTokens,
    START_PATHS,
    HOME_POSITIONS,
    TokenMap,
    LudoGameState,
    Token,
    getNextPlayerId
} from "../../../services/game/ludo-logic";
import authenticatedRequest from "../../authenticatedRequest";

const INITIAL_TOKENS: TokenMap = {
    blue: Array.from({ length: 4 }, (_, i) => ({ sn: i + 1, color: LudoColor.BLUE, active: false, position: 0, isSafePath: false, isFinished: false })),
    yellow: Array.from({ length: 4 }, (_, i) => ({ sn: i + 1, color: LudoColor.YELLOW, active: false, position: 0, isSafePath: false, isFinished: false })),
    green: Array.from({ length: 4 }, (_, i) => ({ sn: i + 1, color: LudoColor.GREEN, active: false, position: 0, isSafePath: false, isFinished: false })),
    red: Array.from({ length: 4 }, (_, i) => ({ sn: i + 1, color: LudoColor.RED, active: false, position: 0, isSafePath: false, isFinished: false })),
};

const gameMutations = {
    createGame: async (_: any, { input }: { input: any }, context: any) => {
        try {
            const initialData = {
                ...input,
                status: LudoStatus.WAITING,
                tokens: INITIAL_TOKENS,
                diceValue: [],
                usedDiceValues: [],
                activeDiceConfig: [],
                players: input.players || [], // Make players optional
                currentTurn: input.players?.[0]?.id || "",
                isRolling: false,
            };

            const game = new Game(initialData);
            const savedGame = await game.save();

            const realtimeProvider = RealtimeProviderFactory.getProvider();
            await realtimeProvider.createGameDocument(savedGame.id, initialData);

            return savedGame;
        } catch (error) {
            throw error;
        }
    },

    createFreeGame: async (_: any, { name }: { name: string }, context: any) => {
        try {
            const initialData = {
                name: name,
                type: 'FREE',
                status: LudoStatus.WAITING,
                tokens: INITIAL_TOKENS,
                diceValue: [],
                usedDiceValues: [],
                activeDiceConfig: [],
                players: [],
                currentTurn: "",
                isRolling: false,
                startDate: new Date(), // Set start date to now for immediate visibility
            };

            const game = new Game(initialData);
            const savedGame = await game.save();

            const realtimeProvider = RealtimeProviderFactory.getProvider();
            await realtimeProvider.createGameDocument(savedGame.id, initialData);

            return savedGame;
        } catch (error) {
            throw error;
        }
    },

    joinGame: authenticatedRequest(async (_: any, { gameId, userId, name }: { gameId: string, userId?: string, name: string }, context: any) => {
        const user = await context.getUserLocal();

        let finalUserId = userId;

        if (user) {
            finalUserId = user.id;
        } else {
            // If unauthenticated, derive ID from name and gameId as requested
            finalUserId = `${name}-${gameId}`;
        }

        if (!finalUserId) throw new Error("User ID is required");

        const db = admin.firestore();
        const gameRef = db.collection('games').doc(gameId);

        try {
            return await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(gameRef);
                if (!doc.exists) throw new Error("Game not found");

                const gameState = doc.data() as LudoGameState;
                if (gameState.players.length >= 2) throw new Error("Game is full (2 player mode)");
                if (gameState.players.find(p => p.id === finalUserId)) throw new Error("User already in game");

                // Dual Color Assignment Logic
                // Player 1 (Index 0): Red and Green
                // Player 2 (Index 1): Blue and Yellow
                const isFirstPlayer = gameState.players.length === 0;
                const assignedColors = isFirstPlayer
                    ? [LudoColor.RED, LudoColor.GREEN]
                    : [LudoColor.BLUE, LudoColor.YELLOW];

                const newPlayer = {
                    id: finalUserId,
                    name,
                    color: assignedColors[0], // Primary color (red or blue)
                    tokens: assignedColors,   // Both colors controlled by this player
                    capturedCount: 0,
                    finishedCount: 0
                };

                const updatedPlayers = [...gameState.players, newPlayer];
                const updates: any = {
                    players: updatedPlayers,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                // Game starts when 2nd player joins
                if (updatedPlayers.length === 2 && gameState.status === LudoStatus.WAITING) {
                    updates.status = LudoStatus.PLAYING_DICE;
                    updates.currentTurn = updatedPlayers[0].id;
                }

                transaction.update(gameRef, updates);
                const { id: __, ...stateData } = gameState as any;
                return { ...stateData, ...updates, id: gameId };
            });
        } catch (error) {
            console.error("Join Game Error:", error);
            throw error;
        }
    }, true),

    rollDice: authenticatedRequest(async (_: any, { gameId, name }: { gameId: string, name?: string }, context: any) => {
        const user = await context.getUserLocal();

        let userId = user?.id;
        if (!userId) {
            if (!name) throw new Error("Unauthorized: Name required if not logged in");
            userId = `${name}-${gameId}`;
        }

        const db = admin.firestore();
        const gameRef = db.collection('games').doc(gameId);

        let errorToThrow: string | null = null;
        let finalState: any = null;

        try {
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(gameRef);
                if (!doc.exists) throw new Error("Game not found");

                const gameState = doc.data() as LudoGameState;
                if (gameState.currentTurn !== userId) throw new Error("Not your turn");
                if (gameState.status !== LudoStatus.PLAYING_DICE) throw new Error("Cannot roll dice now");

                const crypto = require("crypto");
                const results = [
                    crypto.randomInt(1, 7),
                    crypto.randomInt(1, 7)
                ];

                const player = gameState.players.find(p => p.id === userId);
                const playerColors = player?.tokens || []; // Array of colors like ['red'] or ['blue']

                // Aggregate all tokens controlled by this player
                const myTokens = playerColors.flatMap(color => gameState.tokens[color] || []);

                // GRANULAR AUTO-SKIP & DISCARD CHECK
                const hasSix = results.includes(6);
                const hasTokensAtHome = myTokens.some(t => !t.active && !t.isFinished);

                let usableDice: number[] = [];

                if (hasSix && hasTokensAtHome) {
                    // If we have a 6 and tokens at home, ALL rolled dice are potentially usable 
                    usableDice = results;
                } else {
                    // Otherwise, check if ANY owned color can use each dice value
                    usableDice = results.filter(diceVal => {
                        return playerColors.some(color => {
                            const tokensOfColor = gameState.tokens[color] || [];
                            const movableTokens = getMovableTokens(diceVal, tokensOfColor, color);
                            return movableTokens.length > 0;
                        });
                    });
                }

                console.log({ usableDice });

                if (usableDice.length === 0) {
                    // No moves possible, rotate turn and throw error to frontend
                    const nextPlayerId = getNextPlayerId(gameState.players, gameState.currentTurn);

                    const updates: any = {
                        diceValue: results, // Persist the rolled dice so user sees them
                        status: LudoStatus.PLAYING_DICE,
                        currentTurn: nextPlayerId,
                        usedDiceValues: [],
                        activeDiceConfig: null,
                        lastMoverId: userId,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    transaction.update(gameRef, updates);
                    const { id: __, ...stateData } = gameState as any;
                    finalState = { ...stateData, ...updates, id: gameId };
                    errorToThrow = "No valid moves possible with these dice! Skipping turn...";
                    return;
                }

                // If some dice were unusable, we effectively "discard" them by only setting the usable ones
                // Note: Frontend will handle the toast info if needed based on the response
                const updates: any = {
                    diceValue: results, // SHOW ALL DICE (Trusted View) - filtering happens in process logic
                    status: LudoStatus.PLAYING_TOKEN,
                    currentTurn: userId,
                    usedDiceValues: [],
                    activeDiceConfig: null,
                    lastMoverId: userId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.update(gameRef, updates);
                const { id: ___, ...rollStateData } = gameState as any;
                finalState = { ...rollStateData, ...updates, id: gameId };
            });

            if (errorToThrow) {
                throw new Error(errorToThrow);
            }

            // TEMPORARY: Quick MongoDB sync for testing (comment out after testing)
            // try {
            //     await Game.findByIdAndUpdate(
            //         gameId,
            //         { $set: finalState },
            //         { upsert: true }
            //     );
            //     console.log(`[TEMP SYNC] Game ${gameId} synced to MongoDB`);
            // } catch (syncError) {
            //     console.error('[TEMP SYNC] MongoDB sync failed:', syncError);
            // }

            return finalState;
        } catch (error) {
            console.error("Roll Dice Error:", error);
            throw error;
        }
    }, true),

    processMove: authenticatedRequest(async (_: any, { gameId, input, name }: { gameId: string, input: any, name?: string }, context: any) => {
        const user = await context.getUserLocal();

        let userId = user?.id;
        if (!userId) {
            if (!name) throw new Error("Unauthorized: Name required if not logged in");
            userId = `${name}-${gameId}`;
        }

        const db = admin.firestore();
        const gameRef = db.collection('games').doc(gameId);

        let errorToThrow: string | null = null;

        try {
            const resultState = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(gameRef);
                if (!doc.exists) throw new Error("Game not found");

                const gameState = doc.data() as LudoGameState;
                if (gameState.currentTurn !== userId) throw new Error("Not your turn");
                if (gameState.status !== LudoStatus.PLAYING_TOKEN) throw new Error("Cannot move now");

                const tokenColor = input.color;
                const tokenId = input.tokenId;
                const player = gameState.players.find((p) => p.id === userId);
                // 1. GATHER CONTEXT
                if (!player || !player.tokens.includes(tokenColor)) {
                    throw new Error("Can't move this token!");
                }

                const tokens = gameState.tokens[tokenColor];
                const token = tokens.find(t => t.sn === tokenId);
                if (!token) throw new Error("Token not found");

                // 2. DETERMINE AVAILABLE DICE
                const availableDiceValues = [...gameState.diceValue];
                gameState.usedDiceValues.forEach(usedVal => {
                    const index = availableDiceValues.indexOf(usedVal);
                    if (index !== -1) availableDiceValues.splice(index, 1);
                });

                if (availableDiceValues.length === 0) {
                    throw new Error("Roll dice first / No dice left!");
                }

                // 3. DECIDE WHICH DICE TO USE
                let diceToUse: number[] | null = null;
                if (gameState.activeDiceConfig && gameState.activeDiceConfig.length > 0) {
                    diceToUse = gameState.activeDiceConfig;
                } else if (availableDiceValues.length === 1) {
                    diceToUse = [availableDiceValues[0]];
                }

                // 4. HANDLE "ACTIVATION"
                if (!token.active) {
                    const hasSix = diceToUse?.includes(6) || (!diceToUse && availableDiceValues.includes(6));
                    if (hasSix) {
                        const finalDiceToConsume = diceToUse || [6];
                        const totalMoveAmount = finalDiceToConsume.reduce((sum, val) => sum + val, 0);
                        const extraSteps = totalMoveAmount - 6;
                        const newPosition = START_PATHS[tokenColor] + extraSteps;

                        const updatedState = calculateMoveUpdate(
                            gameState,
                            tokenColor,
                            tokenId,
                            newPosition,
                            finalDiceToConsume,
                            availableDiceValues,
                            false
                        );

                        const { id: __, ...stateToUpdate } = updatedState as any;
                        transaction.update(gameRef, stateToUpdate);
                        return { ...updatedState, id: gameId };
                    } else {
                        throw new Error("You need a 6 to move out!");
                    }
                }

                // 5. HANDLE "NORMAL MOVE"
                if (!diceToUse) {
                    throw new Error("Please select a dice value!");
                }

                const moveAmount = diceToUse.reduce((sum, val) => sum + val, 0);
                const { position: finalPosition, willBeSafe } = getProjectedPosition(token, moveAmount);
                const homePos = HOME_POSITIONS[tokenColor];

                // Overshoot check
                if (willBeSafe || token.isSafePath) {
                    if (finalPosition > homePos) {
                        throw new Error(`You need exactly ${homePos - (token.position || 0)} to finish!`);
                    }
                }

                const updatedState = calculateMoveUpdate(
                    gameState,
                    tokenColor,
                    tokenId,
                    finalPosition,
                    diceToUse,
                    availableDiceValues,
                    willBeSafe
                );

                // CHECK FOR FORCED TURN END (Unusable Remaining Dice)
                const remainingCtxDice = availableDiceValues.length - diceToUse.length;
                if (remainingCtxDice > 0 && updatedState.currentTurn !== userId) {
                    errorToThrow = "Turn skipped! Remaining dice cannot be used by any token.";
                }

                const { id: __, ...stateToUpdate } = updatedState as any;
                transaction.update(gameRef, stateToUpdate);
                return { ...updatedState, id: gameId };
            });

            if (errorToThrow) {
                // Ensure we don't block the actual successful move/update event
                // But we want to notify the client
                throw new Error(errorToThrow);
            }

            return resultState;
        } catch (error) {
            console.error("Process Move Error:", error);
            throw error;
        }
    }, true),

    selectDice: authenticatedRequest(async (_: any, { gameId, diceValues, name }: { gameId: string, diceValues: number[], name?: string }, context: any) => {
        const user = await context.getUserLocal();

        let userId = user?.id;
        if (!userId) {
            if (!name) throw new Error("Unauthorized: Name required if not logged in");
            userId = `${name}-${gameId}`;
        }

        const db = admin.firestore();
        const gameRef = db.collection('games').doc(gameId);

        try {
            return await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(gameRef);
                if (!doc.exists) throw new Error("Game not found");

                const gameState = doc.data() as LudoGameState;
                if (gameState.currentTurn !== userId) throw new Error("Not your turn");
                if (gameState.status !== LudoStatus.PLAYING_TOKEN) throw new Error("Cannot select dice now");

                // DICE VALIDATION: Subset and Consumption Check
                if (diceValues.length > 0) {
                    const availableRolls = [...gameState.diceValue];
                    const usedRolls = [...(gameState.usedDiceValues || [])];

                    // Subtract usedRolls from availableRolls to get current pool
                    usedRolls.forEach(val => {
                        const idx = availableRolls.indexOf(val);
                        if (idx !== -1) availableRolls.splice(idx, 1);
                    });

                    // Check if diceValues are in availableRolls (handling duplicates)
                    const pool = [...availableRolls];
                    for (const diceVal of diceValues) {
                        const idx = pool.indexOf(diceVal);
                        if (idx === -1) {
                            throw new Error(`Dice value ${diceVal} is not available or already used!`);
                        }
                        pool.splice(idx, 1);
                    }
                }

                const updates: any = {
                    activeDiceConfig: diceValues.length > 0 ? diceValues : null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.update(gameRef, updates);
                const { id: __, ...stateData } = gameState as any;
                return { ...stateData, ...updates, id: gameId };
            });
        } catch (error) {
            console.error("Select Dice Error:", error);
            throw error;
        }
    }, true)
}

export default gameMutations;
