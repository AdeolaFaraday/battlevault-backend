/**
 * LLM AI Engine — Gemini-Powered Move Selection
 *
 * Sends the current game state to Google Gemini and asks it
 * to pick the best move from the available legal options.
 * Falls back to the rule-based engine if the LLM fails.
 */

import {
    LudoGameState,
    LudoPlayer,
    Token,
    HOME_POSITIONS,
    START_PATHS,
    getMovableTokens,
    getProjectedPosition,
} from './ludoLogic';
import { AIMove, pickMove as ruleBasedPickMove } from './aiEngine';

// ─── Types ───────────────────────────────────────────────────────

interface LegalMove {
    index: number;
    color: string;
    tokenId: number;
    tokenPosition: number;
    isActive: boolean;
    diceValue: number;
    projectedPosition: number;
    willBeSafe: boolean;
    wouldCapture: boolean;
    wouldFinish: boolean;
    wouldActivate: boolean;
}

// ─── Prompt Construction ─────────────────────────────────────────

function buildGameStateDescription(state: LudoGameState, player: LudoPlayer): string {
    const playerColors = player.tokens || [];
    const opponentColors = Object.keys(state.tokens).filter((c) => !playerColors.includes(c));

    // Describe AI's tokens
    const aiTokenDescriptions = playerColors.flatMap((color) => {
        const tokens = state.tokens[color] || [];
        return tokens.map((t) => {
            if (t.isFinished) return `  ${color} #${t.sn}: FINISHED`;
            if (!t.active) return `  ${color} #${t.sn}: AT HOME (inactive)`;
            const distToFinish = t.isSafePath
                ? HOME_POSITIONS[color] - t.position
                : '~unknown (on main path)';
            return `  ${color} #${t.sn}: position ${t.position}, ${t.isSafePath ? 'SAFE PATH' : 'main board'}, distance to finish: ${distToFinish}`;
        });
    });

    // Describe opponent tokens (visible positions)
    const opponentDescriptions = opponentColors.flatMap((color) => {
        const tokens = state.tokens[color] || [];
        return tokens
            .filter((t) => t.active && !t.isFinished)
            .map((t) => `  ${color} #${t.sn}: position ${t.position}${t.isSafePath ? ' (SAFE PATH)' : ''}`);
    });

    return [
        `You are playing Ludo as player "${player.name}" (ID: ${player.id}).`,
        `Your colors: ${playerColors.join(', ')}`,
        ``,
        `YOUR TOKENS:`,
        ...aiTokenDescriptions,
        ``,
        `OPPONENT TOKENS ON BOARD:`,
        ...(opponentDescriptions.length > 0 ? opponentDescriptions : ['  None visible']),
        ``,
        `DICE ROLLED: [${state.diceValue.join(', ')}]`,
        `ALREADY USED: [${(state.usedDiceValues || []).join(', ')}]`,
    ].join('\n');
}

function buildLegalMovesDescription(legalMoves: LegalMove[]): string {
    if (legalMoves.length === 0) return 'No legal moves available.';

    const lines = legalMoves.map((m) => {
        const parts = [`Move ${m.index}: Use dice ${m.diceValue} on ${m.color} token #${m.tokenId}`];
        if (m.wouldActivate) parts.push('→ ACTIVATES token from home');
        else parts.push(`→ moves to position ${m.projectedPosition}`);
        if (m.wouldCapture) parts.push('⚔️ CAPTURES opponent!');
        if (m.wouldFinish) parts.push('🏠 FINISHES token!');
        if (m.willBeSafe && !m.wouldActivate) parts.push('🛡️ enters safe path');
        return parts.join(' ');
    });

    return lines.join('\n');
}

function buildPrompt(stateDesc: string, movesDesc: string, moveCount: number): string {
    return `You are an expert Ludo game AI. Analyze the board state and pick the BEST move.

GAME STATE:
${stateDesc}

AVAILABLE MOVES:
${movesDesc}

LUDO STRATEGY TIPS:
- Capturing opponent tokens sends them back home — very powerful
- Finishing tokens (reaching home) is permanent progress
- Activating new tokens when you roll a 6 gives you more options
- Moving tokens on the safe path is risk-free
- Tokens on the main board can be captured by opponents
- Consider risk vs reward: advancing far-ahead tokens on main board is risky

INSTRUCTIONS:
Pick the single best move number (0 to ${moveCount - 1}). 
Respond with ONLY a JSON object in this exact format, no other text:
{"move": <number>, "reasoning": "<brief explanation>"}`;
}

// ─── Legal Move Generation ───────────────────────────────────────

/**
 * Generates ALL legal moves the AI can make right now.
 *
 * Think of it like this:
 *   "For each unused dice value, and for each of my tokens,
 *    CAN this token use this dice? If yes, WHAT would happen?"
 *
 * The result is a flat list of options the LLM can choose from,
 * each enriched with context (would it capture? finish? activate?).
 */
function generateLegalMoves(state: LudoGameState, player: LudoPlayer): LegalMove[] {
    // Step 1: Get the colors this player controls
    // e.g., Player 1 controls ['red', 'green'] — each color has 4 tokens
    const playerColors = player.tokens || [];

    // Step 2: Figure out which dice values haven't been used yet
    // Example: diceValue = [6, 3], usedDiceValues = [6]  →  availableDice = [3]
    const availableDice = [...state.diceValue];
    (state.usedDiceValues || []).forEach((usedVal) => {
        const idx = availableDice.indexOf(usedVal);
        if (idx !== -1) availableDice.splice(idx, 1);
    });

    const moves: LegalMove[] = [];
    let index = 0; // Sequential index so the LLM can say "I pick move 3"

    // Step 3: Try every combination of (dice value × color × token)
    // This is the core loop — it asks "what can each dice do with each token?"
    for (const diceVal of availableDice) {
        for (const color of playerColors) {
            // Get all tokens of this color
            const tokensOfColor = state.tokens[color] || [];

            // getMovableTokens filters down to ONLY the tokens that can
            // legally use this dice value. Rules:
            //   - Inactive token? Only a 6 can activate it
            //   - Already finished? Can't move
            //   - Would overshoot home? Can't move
            const movable = getMovableTokens(diceVal, tokensOfColor, color);

            // Step 4: For each movable token, calculate what WOULD happen
            for (const token of movable) {
                // Is this token currently sitting at home (inactive)?
                // If so, using a 6 on it means "activate" — bring it onto the board
                const wouldActivate = !token.active;

                let projectedPosition: number;
                let willBeSafe: boolean;
                let wouldCapture = false;
                let wouldFinish = false;

                if (wouldActivate) {
                    // ACTIVATION: Token goes to its color's start position
                    // e.g., red starts at position 2, blue at 41
                    projectedPosition = START_PATHS[color];
                    willBeSafe = false; // Start positions are on the main board (not safe)

                    // Check: is there an opponent token sitting at our start position?
                    // If yes, we'd capture them on activation — nice bonus!
                    wouldCapture = checkCapture(state, playerColors, projectedPosition, false);
                } else {
                    // NORMAL MOVE: Calculate where the token would land
                    // getProjectedPosition handles the circular board math and
                    // detects if the token would cross into its safe/home path
                    const proj = getProjectedPosition(token, diceVal);
                    projectedPosition = proj.position;
                    willBeSafe = proj.willBeSafe;

                    // Would this token reach EXACTLY its home position? That's a finish!
                    wouldFinish = willBeSafe && projectedPosition === HOME_POSITIONS[color];

                    // Check: would landing here capture an opponent?
                    // (Can't capture on the safe path — only on the main board)
                    wouldCapture = !willBeSafe && checkCapture(state, playerColors, projectedPosition, willBeSafe);
                }

                // Step 5: Deduplicate — avoid listing the same (token + dice) combo twice
                // This can happen if the same dice value appears twice (e.g., double 3s)
                const isDuplicate = moves.some(
                    (m) => m.color === color && m.tokenId === token.sn && m.diceValue === diceVal
                );
                if (isDuplicate) continue;

                // Step 6: Add this legal move to the list with all its context
                // The LLM will see all of these annotated moves and pick the best one
                moves.push({
                    index: index++,       // "Move 0", "Move 1", etc. for the LLM to reference
                    color,                // Which color token (e.g., 'red')
                    tokenId: token.sn,    // Which specific token (1-4)
                    tokenPosition: token.position,  // Where it currently is
                    isActive: token.active,         // Is it on the board?
                    diceValue: diceVal,             // Which dice value powers this move
                    projectedPosition,    // Where it would land
                    willBeSafe,           // Would it enter the safe home stretch?
                    wouldCapture,         // Would it capture an opponent? ⚔️
                    wouldFinish,          // Would it reach home? 🏠
                    wouldActivate,        // Would it come out of home base? 🚀
                });
            }
        }
    }

    // Return the complete list — the LLM picks one by index
    return moves;
}

function checkCapture(
    state: LudoGameState,
    playerColors: string[],
    targetPos: number,
    isSafe: boolean
): boolean {
    if (isSafe) return false;
    for (const colorKey of Object.keys(state.tokens)) {
        if (playerColors.includes(colorKey)) continue;
        const opponentTokens = state.tokens[colorKey] || [];
        if (opponentTokens.some((t) => t.active && !t.isSafePath && t.position === targetPos)) {
            return true;
        }
    }
    return false;
}

// ─── Gemini API Call ─────────────────────────────────────────────

async function callGemini(prompt: string, apiKey: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 200,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text.trim();
}

// ─── LLM Pick Move ──────────────────────────────────────────────

/**
 * Use Gemini LLM to pick the best move.
 * Falls back to rule-based engine on any LLM failure.
 */
export async function llmPickMove(gameState: LudoGameState): Promise<AIMove | null> {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
        console.warn('[AI-LLM] No GEMINI_API_KEY set, falling back to rule-based engine.');
        return ruleBasedPickMove(gameState);
    }

    const player = gameState.players.find((p) => p.id === gameState.currentTurn);
    if (!player) return null;

    const legalMoves = generateLegalMoves(gameState, player);
    if (legalMoves.length === 0) return null;

    // If only one move available, skip LLM call
    if (legalMoves.length === 1) {
        const m = legalMoves[0];
        return { color: m.color, tokenId: m.tokenId, diceValues: [m.diceValue] };
    }

    try {
        const stateDesc = buildGameStateDescription(gameState, player);
        const movesDesc = buildLegalMovesDescription(legalMoves);
        const prompt = buildPrompt(stateDesc, movesDesc, legalMoves.length);

        console.log(`[AI-LLM] Calling Gemini for game ${gameState.id} with ${legalMoves.length} legal moves.`);

        const rawResponse = await callGemini(prompt, apiKey);
        console.log(`[AI-LLM] Gemini response: ${rawResponse}`);

        // Parse the JSON response
        const parsed = JSON.parse(rawResponse);
        const moveIndex = parsed.move;

        if (typeof moveIndex !== 'number' || moveIndex < 0 || moveIndex >= legalMoves.length) {
            console.warn(`[AI-LLM] Invalid move index ${moveIndex}, falling back to rule-based.`);
            return ruleBasedPickMove(gameState);
        }

        const chosen = legalMoves[moveIndex];
        console.log(`[AI-LLM] Gemini chose move ${moveIndex}: ${chosen.color} #${chosen.tokenId} with dice ${chosen.diceValue}. Reason: ${parsed.reasoning || 'none'}`);

        return {
            color: chosen.color,
            tokenId: chosen.tokenId,
            diceValues: [chosen.diceValue],
        };
    } catch (error) {
        console.error('[AI-LLM] LLM failed, falling back to rule-based engine:', error);
        return ruleBasedPickMove(gameState);
    }
}
