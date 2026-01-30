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
    getNextPlayerId
} from "../../../services/game/ludo-logic";
import ClientResponse from "../../../services/response";

const INITIAL_TOKENS: TokenMap = {
    blue: Array.from({ length: 4 }, (_, i) => ({ sn: i + 1, color: LudoColor.BLUE, active: false, position: 0, isSafePath: false, isFinished: false })),
    yellow: Array.from({ length: 4 }, (_, i) => ({ sn: i + 1, color: LudoColor.YELLOW, active: false, position: 0, isSafePath: false, isFinished: false })),
    green: Array.from({ length: 4 }, (_, i) => ({ sn: i + 1, color: LudoColor.GREEN, active: false, position: 0, isSafePath: false, isFinished: false })),
    red: Array.from({ length: 4 }, (_, i) => ({ sn: i + 1, color: LudoColor.RED, active: false, position: 0, isSafePath: false, isFinished: false })),
};

export default class GameService {
    private static formatGameState(game: any) {
        if (!game) return game;

        // Map id to _id if needed since GraphQL expects _id
        if (game.id && !game._id) {
            game._id = game.id;
        }

        if (game.players) {
            game.players = game.players.map((p: any) => ({
                ...p,
                color: p.color?.toLowerCase(),
                tokens: p.tokens?.map((t: string) => t.toLowerCase())
            }));
        }
        if (game.tokens) {
            const formattedTokens: any = {};
            Object.keys(game.tokens).forEach(color => {
                formattedTokens[color.toLowerCase()] = game.tokens[color].map((t: any) => ({
                    ...t,
                    color: t.color?.toLowerCase()
                }));
            });
            game.tokens = formattedTokens;
        }
        return game;
    }

    static async getGame(id: string) {
        try {
            const game = await Game.findById(id).lean();
            if (!game) return new ClientResponse(404, false, "Game not found");
            return new ClientResponse(200, true, "Game retrieved successfully", this.formatGameState(game));
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async getUpcomingGames(context: any, page: number = 1, limit: number = 10) {
        try {
            const user = await context.getUserLocal();
            const filter: any = { status: 'waiting' };
            if (user) {
                filter['players.id'] = user.id;
            }

            const skip = (page - 1) * limit;
            const total = await Game.countDocuments(filter);
            const games = await Game.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const formattedGames = games.map(g => this.formatGameState(g));
            return new ClientResponse(200, true, "Games retrieved successfully", {
                games: formattedGames,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            });
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async getUserGames(context: any, page: number = 1, limit: number = 10, search?: string) {
        try {
            const user = await context.getUserLocal();
            if (!user) return new ClientResponse(401, false, "Unauthorized");

            const filter: any = { 'players.id': user.id };
            if (search) {
                filter.name = { $regex: search, $options: 'i' };
            }

            const skip = (page - 1) * limit;
            const total = await Game.countDocuments(filter);
            const games = await Game.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const formattedGames = games.map(g => this.formatGameState(g));
            return new ClientResponse(200, true, "Games retrieved successfully", {
                games: formattedGames,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            });
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async getActiveGames(context: any) {
        try {
            const user = await context.getUserLocal();
            if (!user) return new ClientResponse(401, false, "Unauthorized");

            const games = await Game.find({
                'players.id': user.id,
                status: { $in: ['playingDice', 'playingToken'] }
            }).sort({ updatedAt: -1 }).lean();

            const formattedGames = games.map(g => this.formatGameState(g));
            return new ClientResponse(200, true, "Active games retrieved successfully", { games: formattedGames });
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async createGame(input: any) {
        try {
            const initialData = {
                ...input,
                status: LudoStatus.WAITING,
                tokens: INITIAL_TOKENS,
                diceValue: [],
                usedDiceValues: [],
                activeDiceConfig: [],
                players: input.players || [],
                currentTurn: input.players?.[0]?.id || "",
                isRolling: false,
            };

            const game = new Game(initialData);
            const savedGame = await game.save();

            const realtimeProvider = RealtimeProviderFactory.getProvider();
            await realtimeProvider.createGameDocument(savedGame.id, initialData);

            return new ClientResponse(201, true, "Game created successfully", this.formatGameState(savedGame));
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async createFreeGame(name: string) {
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
                startDate: new Date(),
            };

            const game = new Game(initialData);
            const savedGame = await game.save();

            const realtimeProvider = RealtimeProviderFactory.getProvider();
            await realtimeProvider.createGameDocument(savedGame.id, initialData);

            return new ClientResponse(201, true, "Free game created successfully", this.formatGameState(savedGame));
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async joinGame(gameId: string, userId: string | undefined, name: string, context: any) {
        const user = await context.getUserLocal();
        let finalUserId = userId;

        if (user) {
            finalUserId = user.id;
        } else if (name) {
            finalUserId = `${name}-${gameId}`;
        }

        if (!finalUserId) return new ClientResponse(400, false, "User ID is required");

        const db = admin.firestore();
        const gameRef = db.collection('games').doc(gameId);

        try {
            // Check if game exists in Firestore
            let doc = await gameRef.get();

            if (!doc.exists) {
                // Check MongoDB if it's a tournament game
                const mongoGame = await Game.findById(gameId).lean();
                if (!mongoGame || mongoGame.type !== 'TOURNAMENT') {
                    return new ClientResponse(404, false, "Game not found");
                }

                // Initialize in Firestore
                const initialData = {
                    id: gameId,
                    name: mongoGame.name,
                    type: mongoGame.type,
                    status: LudoStatus.WAITING,
                    tokens: INITIAL_TOKENS,
                    diceValue: [],
                    usedDiceValues: [],
                    activeDiceConfig: [],
                    players: [],
                    currentTurn: "",
                    isRolling: false,
                    startDate: new Date(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                await gameRef.set(initialData);
                doc = await gameRef.get();
            }

            const result = await db.runTransaction(async (transaction) => {
                const docInTransaction = await transaction.get(gameRef);
                if (!docInTransaction.exists) throw new Error("Game not found even after initialization");

                const gameState = docInTransaction.data() as LudoGameState;
                if (gameState.players.length >= 2) throw new Error("Game is full (2 player mode)");
                if (gameState.players.find(p => p.id === finalUserId)) throw new Error("User already in game");

                const isFirstPlayer = gameState.players.length === 0;
                const assignedColors = isFirstPlayer
                    ? [LudoColor.RED, LudoColor.GREEN]
                    : [LudoColor.BLUE, LudoColor.YELLOW];

                const newPlayer = {
                    id: finalUserId,
                    name,
                    color: assignedColors[0],
                    tokens: assignedColors,
                    capturedCount: 0,
                    finishedCount: 0
                };

                const updatedPlayers = [...gameState.players, newPlayer];
                const updates: any = {
                    players: updatedPlayers,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                if (updatedPlayers.length === 2 && gameState.status === LudoStatus.WAITING) {
                    updates.status = LudoStatus.PLAYING_DICE;
                    updates.currentTurn = updatedPlayers[0].id;
                }

                transaction.update(gameRef, updates);
                const { id: __, ...stateData } = gameState as any;
                return { ...stateData, ...updates, _id: gameId };
            });

            return new ClientResponse(200, true, "Joined game successfully", this.formatGameState(result));
        } catch (error: any) {
            return new ClientResponse(400, false, error.message);
        }
    }

    static async rollDice(gameId: string, userId: string) {
        const db = admin.firestore();
        const gameRef = db.collection('games').doc(gameId);

        try {
            let errorToThrow: string | null = null;
            let finalState: any = null;

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
                const playerColors = player?.tokens || [];
                const myTokens = playerColors.flatMap(color => gameState.tokens[color] || []);

                const hasSix = results.includes(6);
                const hasTokensAtHome = myTokens.some(t => !t.active && !t.isFinished);

                let usableDice: number[] = [];

                if (hasSix && hasTokensAtHome) {
                    usableDice = results;
                } else {
                    usableDice = results.filter(diceVal => {
                        return playerColors.some(color => {
                            const tokensOfColor = gameState.tokens[color] || [];
                            const movableTokens = getMovableTokens(diceVal, tokensOfColor, color);
                            return movableTokens.length > 0;
                        });
                    });
                }

                if (usableDice.length === 0) {
                    const nextPlayerId = getNextPlayerId(gameState.players, gameState.currentTurn);
                    const updates: any = {
                        diceValue: results,
                        status: LudoStatus.PLAYING_DICE,
                        currentTurn: nextPlayerId,
                        usedDiceValues: [],
                        activeDiceConfig: null,
                        lastMoverId: userId,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    transaction.update(gameRef, updates);
                    const { id: __, ...stateData } = gameState as any;
                    finalState = { ...stateData, ...updates, _id: gameId };
                    errorToThrow = "No valid moves possible with these dice! Skipping turn...";
                    return;
                }

                const updates: any = {
                    diceValue: results,
                    status: LudoStatus.PLAYING_TOKEN,
                    currentTurn: userId,
                    usedDiceValues: [],
                    activeDiceConfig: null,
                    lastMoverId: userId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.update(gameRef, updates);
                const { id: ___, ...rollStateData } = gameState as any;
                finalState = { ...rollStateData, ...updates, _id: gameId };
            });

            if (errorToThrow) {
                return new ClientResponse(200, false, errorToThrow, this.formatGameState(finalState));
            }

            return new ClientResponse(200, true, "Dice rolled successfully", this.formatGameState(finalState));
        } catch (error: any) {
            return new ClientResponse(400, false, error.message);
        }
    }

    static async processMove(gameId: string, input: any, userId: string) {
        const db = admin.firestore();
        const gameRef = db.collection('games').doc(gameId);

        try {
            let errorToThrow: string | null = null;
            const resultState = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(gameRef);
                if (!doc.exists) throw new Error("Game not found");

                const gameState = doc.data() as LudoGameState;
                if (gameState.currentTurn !== userId) throw new Error("Not your turn");
                if (gameState.status !== LudoStatus.PLAYING_TOKEN) throw new Error("Cannot move now");

                const tokenColor = input.color;
                const tokenId = input.tokenId;
                const player = gameState.players.find((p) => p.id === userId);

                if (!player || !player.tokens.includes(tokenColor)) {
                    throw new Error("Can't move this token!");
                }

                const tokens = gameState.tokens[tokenColor];
                const token = tokens.find(t => t.sn === tokenId);
                if (!token) throw new Error("Token not found");

                const availableDiceValues = [...gameState.diceValue];
                gameState.usedDiceValues.forEach(usedVal => {
                    const index = availableDiceValues.indexOf(usedVal);
                    if (index !== -1) availableDiceValues.splice(index, 1);
                });

                if (availableDiceValues.length === 0) {
                    throw new Error("Roll dice first / No dice left!");
                }

                let diceToUse: number[] | null = null;
                if (gameState.activeDiceConfig && gameState.activeDiceConfig.length > 0) {
                    diceToUse = gameState.activeDiceConfig;
                } else if (availableDiceValues.length === 1) {
                    diceToUse = [availableDiceValues[0]];
                }

                if (!token.active) {
                    const hasSix = diceToUse?.includes(6) || (!diceToUse && availableDiceValues.includes(6));
                    if (hasSix) {
                        let finalDiceToConsume = diceToUse || [6];
                        const pool = [...availableDiceValues];
                        finalDiceToConsume.forEach(val => {
                            const idx = pool.indexOf(val);
                            if (idx !== -1) pool.splice(idx, 1);
                        });

                        for (const d of pool) {
                            const hasOtherTokensAtHome = player.tokens.some(color => {
                                const tokensOfColor = gameState.tokens[color] || [];
                                return tokensOfColor.some(t => !t.active && !t.isFinished && !(t.sn === tokenId && t.color === tokenColor));
                            });

                            if (d === 6 && hasOtherTokensAtHome) continue;

                            const canOthersUse = player.tokens.some(color => {
                                const tokensOfColor = gameState.tokens[color] || [];
                                const otherTokens = tokensOfColor.filter(t => !(t.sn === tokenId && t.color === tokenColor));
                                return getMovableTokens(d, otherTokens, color).length > 0;
                            });

                            if (!canOthersUse) {
                                const startPos = START_PATHS[tokenColor];
                                const { position: proj, willBeSafe: wbs } = getProjectedPosition(
                                    { ...token, active: true, position: startPos, isSafePath: false },
                                    d
                                );
                                const homePos = HOME_POSITIONS[tokenColor];
                                if (!wbs || proj <= homePos) {
                                    finalDiceToConsume.push(d);
                                }
                            }
                        }

                        const totalMoveAmount = finalDiceToConsume.reduce((sum, val) => sum + val, 0);
                        const extraSteps = totalMoveAmount - 6;

                        const { position: finalPosition, willBeSafe } = getProjectedPosition(
                            { ...token, active: true, position: START_PATHS[tokenColor], isSafePath: false },
                            extraSteps
                        );

                        const updatedState = calculateMoveUpdate(
                            gameState,
                            tokenColor,
                            tokenId,
                            finalPosition,
                            finalDiceToConsume,
                            availableDiceValues,
                            willBeSafe
                        );

                        const { id: __, ...stateToUpdate } = updatedState as any;
                        transaction.update(gameRef, stateToUpdate);
                        return { ...updatedState, _id: gameId };
                    } else {
                        throw new Error("You need a 6 to move out!");
                    }
                }

                if (!diceToUse) {
                    const canOtherTokensMoveWithAny = player.tokens.some(color => {
                        const tokensOfColor = gameState.tokens[color] || [];
                        const otherTokens = tokensOfColor.filter(t => !(t.sn === tokenId && t.color === tokenColor));
                        return availableDiceValues.some(d => getMovableTokens(d, otherTokens, color).length > 0);
                    });

                    if (!canOtherTokensMoveWithAny) {
                        diceToUse = [];
                        let tempToken = { ...token };
                        const sortedPool = [...availableDiceValues].sort((a, b) => b - a);

                        for (const d of sortedPool) {
                            const { position: projPos, willBeSafe: wbs } = getProjectedPosition(tempToken, d);
                            const hPos = HOME_POSITIONS[tokenColor];
                            if (!wbs || projPos <= hPos) {
                                diceToUse.push(d);
                                tempToken = { ...tempToken, position: projPos, isSafePath: wbs || tempToken.isSafePath };
                            }
                        }
                    }
                }

                if (!diceToUse || diceToUse.length === 0) {
                    throw new Error("Please select a dice value!");
                }

                const finalDiceToConsume = [...diceToUse];
                const remainingPool = [...availableDiceValues];
                finalDiceToConsume.forEach(val => {
                    const idx = remainingPool.indexOf(val);
                    if (idx !== -1) remainingPool.splice(idx, 1);
                });

                let currentTempTokenForNormal = { ...token };
                const { position: startPos, willBeSafe: startWbs } = getProjectedPosition(token, diceToUse.reduce((s, v) => s + v, 0));
                currentTempTokenForNormal.position = startPos;
                currentTempTokenForNormal.isSafePath = startWbs || token.isSafePath;

                for (const d of remainingPool) {
                    const hasTokensAtHome = player.tokens.some(color => {
                        const tokensOfColor = gameState.tokens[color] || [];
                        return tokensOfColor.some(t => !t.active && !t.isFinished);
                    });

                    if (d === 6 && hasTokensAtHome) continue;

                    const canOthersUse = player.tokens.some(color => {
                        const tokensOfColor = gameState.tokens[color] || [];
                        const otherTokens = tokensOfColor.filter(t => !(t.sn === tokenId && t.color === tokenColor));
                        return getMovableTokens(d, otherTokens, color).length > 0;
                    });

                    if (!canOthersUse) {
                        const { position: proj, willBeSafe } = getProjectedPosition(currentTempTokenForNormal, d);
                        const hPos = HOME_POSITIONS[tokenColor];
                        if (!willBeSafe || proj <= hPos) {
                            finalDiceToConsume.push(d);
                            currentTempTokenForNormal.position = proj;
                            currentTempTokenForNormal.isSafePath = willBeSafe || currentTempTokenForNormal.isSafePath;
                        }
                    }
                }

                const moveAmount = finalDiceToConsume.reduce((sum, val) => sum + val, 0);
                const { position: finalPosition, willBeSafe } = getProjectedPosition(token, moveAmount);
                const homePos = HOME_POSITIONS[tokenColor];

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
                    finalDiceToConsume,
                    availableDiceValues,
                    willBeSafe
                );

                const remainingCtxDice = availableDiceValues.length - diceToUse.length;
                if (remainingCtxDice > 0 && updatedState.currentTurn !== userId) {
                    errorToThrow = "Turn skipped! Remaining dice cannot be used by any token.";
                }

                const { id: __, ...stateToUpdate } = updatedState as any;
                transaction.update(gameRef, stateToUpdate);
                return { ...updatedState, _id: gameId };
            });

            if (errorToThrow) {
                return new ClientResponse(200, false, errorToThrow, this.formatGameState(resultState));
            }

            return new ClientResponse(200, true, "Move processed successfully", this.formatGameState(resultState));
        } catch (error: any) {
            return new ClientResponse(400, false, error.message);
        }
    }

    static async selectDice(gameId: string, diceValues: number[], userId: string) {
        const db = admin.firestore();
        const gameRef = db.collection('games').doc(gameId);

        try {
            const result = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(gameRef);
                if (!doc.exists) throw new Error("Game not found");

                const gameState = doc.data() as LudoGameState;
                if (gameState.currentTurn !== userId) throw new Error("Not your turn");
                if (gameState.status !== LudoStatus.PLAYING_TOKEN) throw new Error("Cannot select dice now");

                if (diceValues.length > 0) {
                    const availableRolls = [...gameState.diceValue];
                    const usedRolls = [...(gameState.usedDiceValues || [])];

                    usedRolls.forEach(val => {
                        const idx = availableRolls.indexOf(val);
                        if (idx !== -1) availableRolls.splice(idx, 1);
                    });

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
                return { ...stateData, ...updates, _id: gameId };
            });

            return new ClientResponse(200, true, "Dice selected successfully", this.formatGameState(result));
        } catch (error: any) {
            return new ClientResponse(400, false, error.message);
        }
    }
}
