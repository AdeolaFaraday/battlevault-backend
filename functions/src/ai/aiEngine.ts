/**
 * AI Engine - Rule-Based Move Selection (v1)
 *
 * Evaluates all legal moves for the current AI player and
 * selects the best one using a priority-based strategy.
 *
 * Priority Order:
 *  1. Capture an opponent token
 *  2. Move a token to the finish (home) position
 *  3. Activate a new token (if dice includes 6)
 *  4. Advance the token closest to finishing
 *  5. Random valid move (fallback)
 */

import {
    LudoGameState,
    LudoPlayer,
    Token,
    TokenMap,
    HOME_POSITIONS,
    START_PATHS,
    getMovableTokens,
    getProjectedPosition,
} from './ludoLogic';

// ─── Types ───────────────────────────────────────────────────────

export interface AIMove {
    color: string;
    tokenId: number;
    diceValues: number[];
}

interface ScoredMove {
    move: AIMove;
    score: number;
}

// ─── Score Constants ─────────────────────────────────────────────

const SCORE_CAPTURE = 1000;
const SCORE_FINISH = 800;
const SCORE_ACTIVATE = 600;
const SCORE_ADVANCE_MAX = 400;  // Scaled by proximity to finish

// ─── AI Engine ───────────────────────────────────────────────────

/**
 * Checks if moving a token to a position would capture an opponent.
 */
function wouldCapture(
    tokens: TokenMap,
    playerColors: string[],
    targetColor: string,
    targetPos: number,
    isSafePath: boolean
): boolean {
    if (isSafePath) return false;

    for (const colorKey of Object.keys(tokens)) {
        if (playerColors.includes(colorKey)) continue; // Skip own colors
        const opponentTokens = tokens[colorKey] || [];
        const hasVictim = opponentTokens.some(
            (t) => t.active && !t.isSafePath && t.position === targetPos
        );
        if (hasVictim) return true;
    }
    return false;
}

/**
 * Calculate how far a token is from finishing (lower = closer).
 * Used to prioritize advancing tokens that are already far along.
 */
function distanceToFinish(token: Token): number {
    const homePos = HOME_POSITIONS[token.color];
    if (!token.active) return homePos + 52; // Very far — inactive
    if (token.isFinished) return 0;
    if (token.isSafePath) return homePos - token.position;

    // For tokens on the main board, we estimate distance
    // based on how far they need to travel to reach their gate
    const gatePositions: { [key: string]: number } = {
        red: 53,
        green: 14,
        yellow: 27,
        blue: 40,
    };
    const gate = gatePositions[token.color];
    let dist = gate - token.position;
    if (dist < 0) dist += 52;
    // Add safe path distance
    dist += homePos;
    return dist;
}

/**
 * Pick the best move for the AI player.
 *
 * Examines all available dice values and all movable tokens,
 * scores each option, and returns the highest-scoring move.
 */
export function pickMove(gameState: LudoGameState): AIMove | null {
    const aiPlayerId = gameState.currentTurn;
    const player = gameState.players.find((p: LudoPlayer) => p.id === aiPlayerId);
    if (!player) return null;

    const playerColors = player.tokens || [];

    // Calculate remaining dice values
    const availableDice = [...gameState.diceValue];
    (gameState.usedDiceValues || []).forEach((usedVal) => {
        const idx = availableDice.indexOf(usedVal);
        if (idx !== -1) availableDice.splice(idx, 1);
    });

    if (availableDice.length === 0) return null;

    const scoredMoves: ScoredMove[] = [];

    // Evaluate each dice value against each movable token
    for (const diceVal of availableDice) {
        for (const color of playerColors) {
            const tokensOfColor = gameState.tokens[color] || [];
            const movable = getMovableTokens(diceVal, tokensOfColor, color);

            for (const token of movable) {
                let score = 0;

                // ── Activation Move (token not active, dice is 6) ──
                if (!token.active) {
                    const startPos = START_PATHS[color];

                    // Check if activating would capture
                    if (wouldCapture(gameState.tokens, playerColors, color, startPos, false)) {
                        score = SCORE_CAPTURE + SCORE_ACTIVATE;
                    } else {
                        score = SCORE_ACTIVATE;
                    }

                    scoredMoves.push({
                        move: { color, tokenId: token.sn, diceValues: [diceVal] },
                        score,
                    });
                    continue;
                }

                // ── Normal Move (token is active) ──
                const { position: projPos, willBeSafe } = getProjectedPosition(token, diceVal);
                const homePos = HOME_POSITIONS[color];

                // Check finishing
                const wouldFinish = willBeSafe && projPos === homePos;
                if (wouldFinish) {
                    score = SCORE_FINISH;
                    scoredMoves.push({
                        move: { color, tokenId: token.sn, diceValues: [diceVal] },
                        score,
                    });
                    continue;
                }

                // Check capture
                if (wouldCapture(gameState.tokens, playerColors, color, projPos, willBeSafe)) {
                    score = SCORE_CAPTURE;
                    scoredMoves.push({
                        move: { color, tokenId: token.sn, diceValues: [diceVal] },
                        score,
                    });
                    continue;
                }

                // Advance score — inversely proportional to distance (closer = higher)
                const currentDist = distanceToFinish(token);
                const maxDist = 52 + 20; // approximate max distance
                const proximity = Math.max(0, maxDist - currentDist) / maxDist;
                score = Math.round(SCORE_ADVANCE_MAX * proximity);

                // Small bonus for entering safe path
                if (willBeSafe && !token.isSafePath) {
                    score += 50;
                }

                scoredMoves.push({
                    move: { color, tokenId: token.sn, diceValues: [diceVal] },
                    score,
                });
            }
        }
    }

    if (scoredMoves.length === 0) return null;

    // Sort by score descending, pick the best
    scoredMoves.sort((a, b) => b.score - a.score);

    // If there are ties at the top, pick randomly among them
    const topScore = scoredMoves[0].score;
    const topMoves = scoredMoves.filter((m) => m.score === topScore);
    const chosen = topMoves[Math.floor(Math.random() * topMoves.length)];

    return chosen.move;
}

/**
 * Check if a player ID represents an AI player.
 * Convention: AI player IDs start with "ai-".
 */
export function isAIPlayer(playerId: string | undefined): boolean {
    return !!playerId && playerId.startsWith('ai-');
}
