"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiOrchestrator = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const aiStrategy_1 = require("./ai/aiStrategy");
const ludoLogic_1 = require("./ai/ludoLogic");
const AI_DELAY_MS = 800;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.aiOrchestrator = functions.firestore
    .document('games/{gameId}')
    .onUpdate(async (change, context) => {
    const gameId = context.params.gameId;
    const newData = change.after.data();
    const oldData = change.before.data();
    if (!newData || !oldData) {
        console.log(`[AI] No data for game ${gameId}, skipping.`);
        return null;
    }
    if (newData.aiProcessing) {
        console.log(`[AI] Game ${gameId} is already being processed by AI, skipping.`);
        return null;
    }
    const status = newData.status;
    if (status !== ludoLogic_1.LudoStatus.PLAYING_DICE && status !== ludoLogic_1.LudoStatus.PLAYING_TOKEN) {
        return null;
    }
    const currentTurnId = newData.currentTurn;
    if (!(0, aiStrategy_1.isAIPlayer)(currentTurnId)) {
        return null;
    }
    const { aiProcessing: _a, ...actualNew } = newData;
    const { aiProcessing: _b, ...actualOld } = oldData;
    if (JSON.stringify(actualNew) === JSON.stringify(actualOld)) {
        console.log(`[AI] No functional change for game ${gameId}, skipping.`);
        return null;
    }
    console.log(`[AI] Detected AI turn for game ${gameId}. Status: ${status}, Player: ${currentTurnId}`);
    const db = admin.firestore();
    const gameRef = db.collection('games').doc(gameId);
    try {
        const lockAcquired = await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(gameRef);
            if (!doc.exists)
                return false;
            const data = doc.data();
            if (data.aiProcessing)
                return false;
            if (!(0, aiStrategy_1.isAIPlayer)(data.currentTurn))
                return false;
            if (data.status !== ludoLogic_1.LudoStatus.PLAYING_DICE && data.status !== ludoLogic_1.LudoStatus.PLAYING_TOKEN)
                return false;
            transaction.update(gameRef, { aiProcessing: true });
            return true;
        });
        if (!lockAcquired) {
            console.log(`[AI] Failed to acquire lock for game ${gameId}, another instance may be handling.`);
            return null;
        }
        const engine = (0, aiStrategy_1.getEngineType)();
        const delay = engine === 'llm' ? 200 : AI_DELAY_MS;
        await sleep(delay);
        const freshDoc = await gameRef.get();
        if (!freshDoc.exists) {
            await gameRef.update({ aiProcessing: false });
            return null;
        }
        const gameState = freshDoc.data();
        gameState.id = gameId;
        if (!(0, aiStrategy_1.isAIPlayer)(gameState.currentTurn)) {
            await gameRef.update({ aiProcessing: false });
            return null;
        }
        if (gameState.status === ludoLogic_1.LudoStatus.PLAYING_DICE) {
            await handleDiceRoll(db, gameRef, gameState, gameId);
        }
        else if (gameState.status === ludoLogic_1.LudoStatus.PLAYING_TOKEN) {
            await handleTokenMove(db, gameRef, gameState, gameId);
        }
        return null;
    }
    catch (error) {
        console.error(`[AI] Error processing AI turn for game ${gameId}:`, error);
        try {
            await gameRef.update({ aiProcessing: false });
        }
        catch (unlockError) {
            console.error(`[AI] Failed to release lock for game ${gameId}:`, unlockError);
        }
        return null;
    }
});
async function handleDiceRoll(db, gameRef, gameState, gameId) {
    const aiPlayerId = gameState.currentTurn;
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(gameRef);
        if (!doc.exists)
            throw new Error('Game not found');
        const state = doc.data();
        if (state.currentTurn !== aiPlayerId)
            throw new Error('No longer AI turn');
        if (state.status !== ludoLogic_1.LudoStatus.PLAYING_DICE)
            throw new Error('Not in dice rolling state');
        const results = [
            crypto.randomInt(1, 7),
            crypto.randomInt(1, 7),
        ];
        const player = state.players.find((p) => p.id === aiPlayerId);
        const playerColors = player?.tokens || [];
        const myTokens = playerColors.flatMap((color) => state.tokens[color] || []);
        const hasSix = results.includes(6);
        const hasTokensAtHome = myTokens.some((t) => !t.active && !t.isFinished);
        let usableDice = [];
        if (hasSix && hasTokensAtHome) {
            usableDice = results;
        }
        else {
            usableDice = results.filter((diceVal) => {
                return playerColors.some((color) => {
                    const tokensOfColor = state.tokens[color] || [];
                    return (0, ludoLogic_1.getMovableTokens)(diceVal, tokensOfColor, color).length > 0;
                });
            });
        }
        if (usableDice.length === 0) {
            const nextPlayerId = (0, ludoLogic_1.getNextPlayerId)(state.players, state.currentTurn);
            console.log(`[AI] No valid moves for ${aiPlayerId} in game ${gameId}. Dice: [${results}]. Skipping to ${nextPlayerId}.`);
            transaction.update(gameRef, {
                diceValue: results,
                status: ludoLogic_1.LudoStatus.PLAYING_DICE,
                currentTurn: nextPlayerId,
                usedDiceValues: [],
                activeDiceConfig: null,
                lastMoverId: aiPlayerId,
                aiProcessing: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
        }
        console.log(`[AI] ${aiPlayerId} rolled [${results}] in game ${gameId}. Usable: [${usableDice}].`);
        transaction.update(gameRef, {
            diceValue: results,
            status: ludoLogic_1.LudoStatus.PLAYING_TOKEN,
            currentTurn: aiPlayerId,
            usedDiceValues: [],
            activeDiceConfig: null,
            lastMoverId: aiPlayerId,
            aiProcessing: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
}
async function handleTokenMove(db, gameRef, gameState, gameId) {
    const aiPlayerId = gameState.currentTurn;
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(gameRef);
        if (!doc.exists)
            throw new Error('Game not found');
        const state = doc.data();
        state.id = gameId;
        if (state.currentTurn !== aiPlayerId)
            throw new Error('No longer AI turn');
        if (state.status !== ludoLogic_1.LudoStatus.PLAYING_TOKEN)
            throw new Error('Not in token move state');
        const aiMove = await (0, aiStrategy_1.pickMoveStrategy)(state);
        if (!aiMove) {
            const nextPlayerId = (0, ludoLogic_1.getNextPlayerId)(state.players, state.currentTurn);
            console.log(`[AI] No valid token moves for ${aiPlayerId} in game ${gameId}. Skipping.`);
            transaction.update(gameRef, {
                status: ludoLogic_1.LudoStatus.PLAYING_DICE,
                currentTurn: nextPlayerId,
                usedDiceValues: [],
                activeDiceConfig: null,
                lastMoverId: aiPlayerId,
                aiProcessing: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
        }
        console.log(`[AI] ${aiPlayerId} picks move: color=${aiMove.color}, token=${aiMove.tokenId}, dice=[${aiMove.diceValues}] in game ${gameId}`);
        const tokenColor = aiMove.color;
        const tokenId = aiMove.tokenId;
        const player = state.players.find((p) => p.id === aiPlayerId);
        if (!player || !player.tokens.includes(tokenColor)) {
            throw new Error('[AI] Invalid move — wrong color for player');
        }
        const tokens = state.tokens[tokenColor] || [];
        const token = tokens.find((t) => t.sn === tokenId);
        if (!token)
            throw new Error('[AI] Token not found');
        const availableDiceValues = [...state.diceValue];
        (state.usedDiceValues || []).forEach((usedVal) => {
            const idx = availableDiceValues.indexOf(usedVal);
            if (idx !== -1)
                availableDiceValues.splice(idx, 1);
        });
        const diceToUse = aiMove.diceValues;
        if (!token.active) {
            const hasSix = diceToUse.includes(6);
            if (!hasSix)
                throw new Error('[AI] Need 6 to activate');
            const finalDiceToConsume = [...diceToUse];
            const pool = [...availableDiceValues];
            finalDiceToConsume.forEach((val) => {
                const idx = pool.indexOf(val);
                if (idx !== -1)
                    pool.splice(idx, 1);
            });
            for (const d of pool) {
                const hasOtherTokensAtHome = player.tokens.some((color) => {
                    const tokensOfColor = state.tokens[color] || [];
                    return tokensOfColor.some((t) => !t.active && !t.isFinished && !(t.sn === tokenId && t.color === tokenColor));
                });
                if (d === 6 && hasOtherTokensAtHome)
                    continue;
                const canOthersUse = player.tokens.some((color) => {
                    const tokensOfColor = state.tokens[color] || [];
                    const otherTokens = tokensOfColor.filter((t) => !(t.sn === tokenId && t.color === tokenColor));
                    return (0, ludoLogic_1.getMovableTokens)(d, otherTokens, color).length > 0;
                });
                if (!canOthersUse) {
                    const startPos = ludoLogic_1.START_PATHS[tokenColor];
                    const { position: proj, willBeSafe: wbs } = (0, ludoLogic_1.getProjectedPosition)({ ...token, active: true, position: startPos, isSafePath: false }, d);
                    const homePos = ludoLogic_1.HOME_POSITIONS[tokenColor];
                    if (!wbs || proj <= homePos) {
                        finalDiceToConsume.push(d);
                    }
                }
            }
            const totalMoveAmount = finalDiceToConsume.reduce((sum, val) => sum + val, 0);
            const extraSteps = totalMoveAmount - 6;
            const { position: finalPosition, willBeSafe } = (0, ludoLogic_1.getProjectedPosition)({ ...token, active: true, position: ludoLogic_1.START_PATHS[tokenColor], isSafePath: false }, extraSteps);
            const updatedState = (0, ludoLogic_1.calculateMoveUpdate)(state, tokenColor, tokenId, finalPosition, finalDiceToConsume, availableDiceValues, willBeSafe);
            const { id: __, aiProcessing: ___, ...stateToUpdate } = updatedState;
            transaction.update(gameRef, {
                ...stateToUpdate,
                aiProcessing: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
        }
        const finalDiceToConsume = [...diceToUse];
        const remainingPool = [...availableDiceValues];
        finalDiceToConsume.forEach((val) => {
            const idx = remainingPool.indexOf(val);
            if (idx !== -1)
                remainingPool.splice(idx, 1);
        });
        let currentTempToken = { ...token };
        const { position: startPos, willBeSafe: startWbs } = (0, ludoLogic_1.getProjectedPosition)(token, diceToUse.reduce((s, v) => s + v, 0));
        currentTempToken.position = startPos;
        currentTempToken.isSafePath = startWbs || token.isSafePath;
        for (const d of remainingPool) {
            const hasTokensAtHome = player.tokens.some((color) => {
                const tokensOfColor = state.tokens[color] || [];
                return tokensOfColor.some((t) => !t.active && !t.isFinished);
            });
            if (d === 6 && hasTokensAtHome)
                continue;
            const canOthersUse = player.tokens.some((color) => {
                const tokensOfColor = state.tokens[color] || [];
                const otherTokens = tokensOfColor.filter((t) => !(t.sn === tokenId && t.color === tokenColor));
                return (0, ludoLogic_1.getMovableTokens)(d, otherTokens, color).length > 0;
            });
            if (!canOthersUse) {
                const { position: proj, willBeSafe } = (0, ludoLogic_1.getProjectedPosition)(currentTempToken, d);
                const hPos = ludoLogic_1.HOME_POSITIONS[tokenColor];
                if (!willBeSafe || proj <= hPos) {
                    finalDiceToConsume.push(d);
                    currentTempToken.position = proj;
                    currentTempToken.isSafePath = willBeSafe || currentTempToken.isSafePath;
                }
            }
        }
        const moveAmount = finalDiceToConsume.reduce((sum, val) => sum + val, 0);
        const { position: finalPosition, willBeSafe } = (0, ludoLogic_1.getProjectedPosition)(token, moveAmount);
        const updatedState = (0, ludoLogic_1.calculateMoveUpdate)(state, tokenColor, tokenId, finalPosition, finalDiceToConsume, availableDiceValues, willBeSafe);
        const { id: __, aiProcessing: ___, ...stateToUpdate } = updatedState;
        transaction.update(gameRef, {
            ...stateToUpdate,
            aiProcessing: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
}
//# sourceMappingURL=aiOrchestrator.js.map