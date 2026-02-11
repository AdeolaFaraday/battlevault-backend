/**
 * AI Orchestrator — Firebase Cloud Function
 *
 * Listens to Firestore `games/{gameId}` document updates and
 * automatically plays turns for AI players.
 *
 * Guards against:
 *  - Infinite re-trigger loops (aiProcessing lock)
 *  - Double execution (atomic lock via transaction)
 *  - Non-AI turns (player ID prefix check)
 *  - Invalid game states (status check)
 *
 * Flow:
 *  1. Detect if current player is AI
 *  2. Acquire atomic lock
 *  3. If PLAYING_DICE → roll dice, update state
 *  4. If PLAYING_TOKEN → pick best move via AIEngine, process move
 *  5. Release lock
 *  6. Firestore update triggers this function again for next AI action
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { isAIPlayer, pickMoveStrategy } from './ai/aiStrategy';
import {
    LudoGameState,
    LudoStatus,
    getMovableTokens,
    getNextPlayerId,
    getProjectedPosition,
    calculateMoveUpdate,
    START_PATHS,
    HOME_POSITIONS,
} from './ai/ludoLogic';

// ─── Configuration ──────────────────────────────────────────────

/** Delay (ms) before AI acts — simulates natural play timing */
const AI_DELAY_MS = 800;

/** Helper to sleep */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Cloud Function ─────────────────────────────────────────────

export const aiOrchestrator = functions.firestore
    .document('games/{gameId}')
    .onUpdate(async (
        change: functions.Change<functions.firestore.DocumentSnapshot>,
        context: functions.EventContext
    ) => {
        const gameId = context.params.gameId;
        const newData = change.after.data() as LudoGameState | undefined;
        const oldData = change.before.data() as LudoGameState | undefined;

        if (!newData || !oldData) {
            console.log(`[AI] No data for game ${gameId}, skipping.`);
            return null;
        }

        // ── Guard 1: Skip if aiProcessing flag is being set/cleared ──
        // This prevents the orchestrator from re-triggering when it
        // sets/clears the lock itself.
        if (newData.aiProcessing) {
            console.log(`[AI] Game ${gameId} is already being processed by AI, skipping.`);
            return null;
        }

        // ── Guard 2: Only act on playable states ──
        const status = newData.status;
        if (status !== LudoStatus.PLAYING_DICE && status !== LudoStatus.PLAYING_TOKEN) {
            return null;
        }

        // ── Guard 3: Only act if current player is AI ──
        const currentTurnId = newData.currentTurn;
        if (!isAIPlayer(currentTurnId)) {
            return null;
        }

        // ── Guard 4: Skip if no meaningful change ──
        const { aiProcessing: _a, ...actualNew } = newData as any;
        const { aiProcessing: _b, ...actualOld } = oldData as any;
        if (JSON.stringify(actualNew) === JSON.stringify(actualOld)) {
            console.log(`[AI] No functional change for game ${gameId}, skipping.`);
            return null;
        }

        console.log(`[AI] Detected AI turn for game ${gameId}. Status: ${status}, Player: ${currentTurnId}`);

        const db = admin.firestore();
        const gameRef = db.collection('games').doc(gameId);

        try {
            // ── Acquire Lock (atomic) ──
            const lockAcquired = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(gameRef);
                if (!doc.exists) return false;

                const data = doc.data() as LudoGameState;

                // Double-check guards inside transaction
                if (data.aiProcessing) return false;
                if (!isAIPlayer(data.currentTurn)) return false;
                if (data.status !== LudoStatus.PLAYING_DICE && data.status !== LudoStatus.PLAYING_TOKEN) return false;

                transaction.update(gameRef, { aiProcessing: true });
                return true;
            });

            if (!lockAcquired) {
                console.log(`[AI] Failed to acquire lock for game ${gameId}, another instance may be handling.`);
                return null;
            }

            // ── Delay for natural feel ──
            await sleep(AI_DELAY_MS);

            // ── Re-fetch state after delay (read fresh, act outside transaction) ──
            const freshDoc = await gameRef.get();
            if (!freshDoc.exists) {
                await gameRef.update({ aiProcessing: false });
                return null;
            }

            const gameState = freshDoc.data() as LudoGameState;
            gameState.id = gameId;

            // Final safety check
            if (!isAIPlayer(gameState.currentTurn)) {
                await gameRef.update({ aiProcessing: false });
                return null;
            }

            // ── Execute AI Action ──
            if (gameState.status === LudoStatus.PLAYING_DICE) {
                await handleDiceRoll(db, gameRef, gameState, gameId);
            } else if (gameState.status === LudoStatus.PLAYING_TOKEN) {
                await handleTokenMove(db, gameRef, gameState, gameId);
            }

            return null;
        } catch (error) {
            console.error(`[AI] Error processing AI turn for game ${gameId}:`, error);
            // Always try to release lock on error
            try {
                await gameRef.update({ aiProcessing: false });
            } catch (unlockError) {
                console.error(`[AI] Failed to release lock for game ${gameId}:`, unlockError);
            }
            return null;
        }
    });

// ─── Dice Roll Handler ──────────────────────────────────────────

/**
 * Handles the PLAYING_DICE state for AI.
 * Mirrors the logic in GameService.rollDice but runs outside the
 * initial trigger transaction.
 */
async function handleDiceRoll(
    db: admin.firestore.Firestore,
    gameRef: admin.firestore.DocumentReference,
    gameState: LudoGameState,
    gameId: string
): Promise<void> {
    const aiPlayerId = gameState.currentTurn;

    await db.runTransaction(async (transaction) => {
        // Re-read state inside transaction for consistency
        const doc = await transaction.get(gameRef);
        if (!doc.exists) throw new Error('Game not found');

        const state = doc.data() as LudoGameState;
        if (state.currentTurn !== aiPlayerId) throw new Error('No longer AI turn');
        if (state.status !== LudoStatus.PLAYING_DICE) throw new Error('Not in dice rolling state');

        // Roll dice
        const results = [
            crypto.randomInt(1, 7),
            crypto.randomInt(1, 7),
        ];

        const player = state.players.find((p) => p.id === aiPlayerId);
        const playerColors = player?.tokens || [];
        const myTokens = playerColors.flatMap((color) => state.tokens[color] || []);

        const hasSix = results.includes(6);
        const hasTokensAtHome = myTokens.some((t) => !t.active && !t.isFinished);

        let usableDice: number[] = [];

        if (hasSix && hasTokensAtHome) {
            usableDice = results;
        } else {
            usableDice = results.filter((diceVal) => {
                return playerColors.some((color) => {
                    const tokensOfColor = state.tokens[color] || [];
                    return getMovableTokens(diceVal, tokensOfColor, color).length > 0;
                });
            });
        }

        if (usableDice.length === 0) {
            // No valid moves — skip turn
            const nextPlayerId = getNextPlayerId(state.players, state.currentTurn);
            console.log(`[AI] No valid moves for ${aiPlayerId} in game ${gameId}. Dice: [${results}]. Skipping to ${nextPlayerId}.`);

            transaction.update(gameRef, {
                diceValue: results,
                status: LudoStatus.PLAYING_DICE,
                currentTurn: nextPlayerId,
                usedDiceValues: [],
                activeDiceConfig: null,
                lastMoverId: aiPlayerId,
                aiProcessing: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
        }

        // Valid dice — transition to PLAYING_TOKEN
        console.log(`[AI] ${aiPlayerId} rolled [${results}] in game ${gameId}. Usable: [${usableDice}].`);

        transaction.update(gameRef, {
            diceValue: results,
            status: LudoStatus.PLAYING_TOKEN,
            currentTurn: aiPlayerId,
            usedDiceValues: [],
            activeDiceConfig: null,
            lastMoverId: aiPlayerId,
            aiProcessing: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
}

// ─── Token Move Handler ─────────────────────────────────────────

/**
 * Handles the PLAYING_TOKEN state for AI.
 * Uses AIEngine.pickMove() to select the best move, then applies
 * the move logic from GameService.processMove.
 */
async function handleTokenMove(
    db: admin.firestore.Firestore,
    gameRef: admin.firestore.DocumentReference,
    gameState: LudoGameState,
    gameId: string
): Promise<void> {
    const aiPlayerId = gameState.currentTurn;

    await db.runTransaction(async (transaction) => {
        // Re-read state inside transaction
        const doc = await transaction.get(gameRef);
        if (!doc.exists) throw new Error('Game not found');

        const state = doc.data() as LudoGameState;
        state.id = gameId;

        if (state.currentTurn !== aiPlayerId) throw new Error('No longer AI turn');
        if (state.status !== LudoStatus.PLAYING_TOKEN) throw new Error('Not in token move state');

        // Use AI Engine to pick the best move
        const aiMove = await pickMoveStrategy(state);
        if (!aiMove) {
            // No valid moves — skip turn
            const nextPlayerId = getNextPlayerId(state.players, state.currentTurn);
            console.log(`[AI] No valid token moves for ${aiPlayerId} in game ${gameId}. Skipping.`);

            transaction.update(gameRef, {
                status: LudoStatus.PLAYING_DICE,
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
        if (!token) throw new Error('[AI] Token not found');

        // Calculate available dice
        const availableDiceValues = [...state.diceValue];
        (state.usedDiceValues || []).forEach((usedVal) => {
            const idx = availableDiceValues.indexOf(usedVal);
            if (idx !== -1) availableDiceValues.splice(idx, 1);
        });

        const diceToUse = aiMove.diceValues;

        // ── Activation Move (token not active) ──
        if (!token.active) {
            const hasSix = diceToUse.includes(6);
            if (!hasSix) throw new Error('[AI] Need 6 to activate');

            const finalDiceToConsume = [...diceToUse];

            // Check if remaining dice can be auto-consumed by this token
            const pool = [...availableDiceValues];
            finalDiceToConsume.forEach((val) => {
                const idx = pool.indexOf(val);
                if (idx !== -1) pool.splice(idx, 1);
            });

            for (const d of pool) {
                const hasOtherTokensAtHome = player.tokens.some((color) => {
                    const tokensOfColor = state.tokens[color] || [];
                    return tokensOfColor.some(
                        (t) => !t.active && !t.isFinished && !(t.sn === tokenId && t.color === tokenColor)
                    );
                });

                if (d === 6 && hasOtherTokensAtHome) continue;

                const canOthersUse = player.tokens.some((color) => {
                    const tokensOfColor = state.tokens[color] || [];
                    const otherTokens = tokensOfColor.filter(
                        (t) => !(t.sn === tokenId && t.color === tokenColor)
                    );
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
                state,
                tokenColor,
                tokenId,
                finalPosition,
                finalDiceToConsume,
                availableDiceValues,
                willBeSafe
            );

            const { id: __, aiProcessing: ___, ...stateToUpdate } = updatedState as any;
            transaction.update(gameRef, {
                ...stateToUpdate,
                aiProcessing: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
        }

        // ── Normal Move (token is active) ──
        const finalDiceToConsume = [...diceToUse];

        // Check if remaining dice can be auto-consumed
        const remainingPool = [...availableDiceValues];
        finalDiceToConsume.forEach((val) => {
            const idx = remainingPool.indexOf(val);
            if (idx !== -1) remainingPool.splice(idx, 1);
        });

        let currentTempToken = { ...token };
        const { position: startPos, willBeSafe: startWbs } = getProjectedPosition(
            token,
            diceToUse.reduce((s, v) => s + v, 0)
        );
        currentTempToken.position = startPos;
        currentTempToken.isSafePath = startWbs || token.isSafePath;

        for (const d of remainingPool) {
            const hasTokensAtHome = player.tokens.some((color) => {
                const tokensOfColor = state.tokens[color] || [];
                return tokensOfColor.some((t) => !t.active && !t.isFinished);
            });

            if (d === 6 && hasTokensAtHome) continue;

            const canOthersUse = player.tokens.some((color) => {
                const tokensOfColor = state.tokens[color] || [];
                const otherTokens = tokensOfColor.filter(
                    (t) => !(t.sn === tokenId && t.color === tokenColor)
                );
                return getMovableTokens(d, otherTokens, color).length > 0;
            });

            if (!canOthersUse) {
                const { position: proj, willBeSafe } = getProjectedPosition(currentTempToken, d);
                const hPos = HOME_POSITIONS[tokenColor];
                if (!willBeSafe || proj <= hPos) {
                    finalDiceToConsume.push(d);
                    currentTempToken.position = proj;
                    currentTempToken.isSafePath = willBeSafe || currentTempToken.isSafePath;
                }
            }
        }

        const moveAmount = finalDiceToConsume.reduce((sum, val) => sum + val, 0);
        const { position: finalPosition, willBeSafe } = getProjectedPosition(token, moveAmount);

        const updatedState = calculateMoveUpdate(
            state,
            tokenColor,
            tokenId,
            finalPosition,
            finalDiceToConsume,
            availableDiceValues,
            willBeSafe
        );

        const { id: __, aiProcessing: ___, ...stateToUpdate } = updatedState as any;
        transaction.update(gameRef, {
            ...stateToUpdate,
            aiProcessing: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
}
