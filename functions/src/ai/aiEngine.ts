/**
 * AI Engine - Rule-Based Move Selection (v2)
 *
 * Evaluates all legal moves for the current AI player and
 * selects the best one based on difficulty-scaled weights.
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

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface AIMove {
    color: string;
    tokenId: number;
    diceValues: number[];
    reasoning?: string; // For debugging/logging
}

interface ScoredMove {
    move: AIMove;
    score: number;
}

// ─── Score Constants ─────────────────────────────────────────────

// Difficulty Weights (relative importance of each factor)
const WEIGHTS = {
    easy: { capture: 500, finish: 400, activate: 300, advance: 100, risk: 0, safe: 20, randomness: 50 },
    medium: { capture: 1000, finish: 800, activate: 400, advance: 200, risk: -150, safe: 100, randomness: 10 },
    hard: { capture: 2000, finish: 1500, activate: 600, advance: 300, risk: -400, safe: 200, randomness: 0 },
};

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Checks if moving a token to a position would capture an opponent.
 */
function wouldCapture(
    tokens: TokenMap,
    playerColors: string[],
    targetPos: number,
    isSafePath: boolean
): boolean {
    if (isSafePath) return false; // Safe path tokens are NEVER capturable or can capture

    for (const colorKey of Object.keys(tokens)) {
        if (playerColors.includes(colorKey)) continue; // Skip own tokens
        const opponentTokens = tokens[colorKey] || [];
        // Important: check only tokens on the MAIN BOARD
        const hasVictim = opponentTokens.some(
            (t) => t.active && !t.isSafePath && t.position === targetPos
        );
        if (hasVictim) return true;
    }
    return false;
}

/**
 * Checks how much "risk" a position has (if an opponent is behind it).
 * Returns the number of opponent tokens within 6 steps behind targetPos.
 */
function calculateRiskAt(
    tokens: TokenMap,
    playerColors: string[],
    targetPos: number,
    isSafePath: boolean
): number {
    if (isSafePath) return 0; // Risk-free zone

    let riskCount = 0;
    for (const colorKey of Object.keys(tokens)) {
        if (playerColors.includes(colorKey)) continue;
        const opponentTokens = tokens[colorKey] || [];

        opponentTokens.forEach(t => {
            if (t.active && !t.isSafePath) {
                // Check if opponent is within 1-6 steps behind
                let dist = targetPos - t.position;
                if (dist < 0) dist += 52;
                if (dist >= 1 && dist <= 6) {
                    riskCount++;
                }
            }
        });
    }
    return riskCount;
}

/**
 * Calculate distance to home (accurate for all colors).
 */
function distanceToFinish(token: Token): number {
    const gatePositions: { [key: string]: number } = {
        red: 53,
        green: 14,
        yellow: 27,
        blue: 40,
    };

    if (!token.active) return 52 + 5; // Inactive
    if (token.isFinished) return 0;

    const homePos = HOME_POSITIONS[token.color];

    if (token.isSafePath) {
        return homePos - token.position;
    }

    const gate = gatePositions[token.color];
    let stepsToGate = gate - token.position;
    if (stepsToGate < 0) stepsToGate += 52;
    const stepsInHomeStretch = homePos - gate;

    return stepsToGate + stepsInHomeStretch;
}

// ─── AI Engine ───────────────────────────────────────────────────

/**
 * Pick the best move for the AI player based on difficulty.
 */
export function pickMove(gameState: LudoGameState, difficulty: AIDifficulty = 'medium'): AIMove | null {
    const aiPlayerId = gameState.currentTurn;
    const player = gameState.players.find((p: LudoPlayer) => p.id === aiPlayerId);
    if (!player) return null;

    const playerColors = player.tokens || [];
    const config = WEIGHTS[difficulty];

    const availableDice = [...gameState.diceValue];
    (gameState.usedDiceValues || []).forEach((usedVal) => {
        const idx = availableDice.indexOf(usedVal);
        if (idx !== -1) availableDice.splice(idx, 1);
    });

    if (availableDice.length === 0) return null;

    const scoredMoves: ScoredMove[] = [];

    for (const diceVal of availableDice) {
        for (const color of playerColors) {
            const tokensOfColor = gameState.tokens[color] || [];
            const movable = getMovableTokens(diceVal, tokensOfColor, color);

            for (const token of movable) {
                let score = 0;
                let reason = "";

                // 1. BASE: Activation
                if (!token.active) {
                    const startPos = START_PATHS[color];
                    score = config.activate;
                    reason = "Activate";
                    if (wouldCapture(gameState.tokens, playerColors, startPos, false)) {
                        score += config.capture;
                        reason += " + Capture on Start";
                    }
                } else {
                    // 2. NORMAL MOVE EVALUATION
                    const { position: projPos, willBeSafe } = getProjectedPosition(token, diceVal);
                    const homePos = HOME_POSITIONS[color];

                    // Factor: Finishing
                    if (willBeSafe && projPos === homePos) {
                        score += config.finish;
                        reason += "FINISH! ";
                    }

                    // Factor: Capuring
                    if (wouldCapture(gameState.tokens, playerColors, projPos, willBeSafe)) {
                        score += config.capture;
                        reason += "Capture Opponent! ";
                    }

                    // Factor: Progress
                    const distBefore = distanceToFinish(token);
                    const distAfter = distBefore - diceVal;
                    const progressScore = Math.round((config.advance / 52) * (52 - distAfter));
                    score += progressScore;

                    // Factor: Entering Safe Path
                    if (willBeSafe && !token.isSafePath) {
                        score += config.safe;
                        reason += "Enter Safe Zone ";
                    } else if (token.isSafePath) {
                        score += config.safe / 2; // Moving within safe zone is also good
                    }

                    // Factor: Risk Assessment
                    const riskCount = calculateRiskAt(gameState.tokens, playerColors, projPos, willBeSafe);
                    if (riskCount > 0) {
                        score += (riskCount * config.risk);
                        reason += `Risk Penalty (Hit by ${riskCount}) `;
                    }
                }

                // 3. Randomness (mostly for 'easy' mode)
                if (config.randomness > 0) {
                    score += Math.floor(Math.random() * config.randomness);
                }

                scoredMoves.push({
                    move: { color, tokenId: token.sn, diceValues: [diceVal], reasoning: reason.trim() },
                    score,
                });
            }
        }
    }

    if (scoredMoves.length === 0) return null;

    // Pick best scored move
    scoredMoves.sort((a, b) => b.score - a.score);
    const topScore = scoredMoves[0].score;
    const bestMoves = scoredMoves.filter(m => m.score === topScore);
    const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];

    console.log(`[AI-Rules] Difficulty: ${difficulty} | Scoring: ${chosen.score} | Reason: ${chosen.move.reasoning}`);
    return chosen.move;
}

/**
 * Convention: AI player IDs start with "ai-".
 */
export function isAIPlayer(playerId: string | undefined): boolean {
    return !!playerId && playerId.startsWith('ai-');
}
