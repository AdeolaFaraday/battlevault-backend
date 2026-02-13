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

export function buildGameStateDescription(state: LudoGameState, player: LudoPlayer): string {
    const playerColors = player.tokens || [];
    const opponentColors = Object.keys(state.tokens).filter((c) => !playerColors.includes(c));

    // Define safe zone entry positions for each color
    const SAFE_ZONE_ENTRIES: { [key: string]: number } = {
        red: 53,
        green: 14,
        yellow: 27,
        blue: 40,
    };

    // Describe AI's tokens
    const aiTokenDescriptions = playerColors.flatMap((color) => {
        const tokens = state.tokens[color] || [];
        const entryPos = SAFE_ZONE_ENTRIES[color];

        return tokens.map((t) => {
            if (t.isFinished) return `  ${color} #${t.sn}: FINISHED`;
            if (!t.active) return `  ${color} #${t.sn}: AT HOME (inactive)`;

            let distToFinish: number;
            if (t.isSafePath) {
                distToFinish = HOME_POSITIONS[color] - t.position;
            } else {
                // Calculation for main board: steps to entry + steps in home stretch
                // Example: green token at pos 10, entry at 14, home at 19.
                // Steps to entry = 14 - 10 = 4. Steps from entry to home = 19 - 14 = 5. Total = 9.
                let stepsToEntry: number;
                if (color === 'red') {
                    stepsToEntry = entryPos - t.position;
                } else {
                    // For colors that wrap around (green, yellow, blue)
                    // if current pos > entry pos, they must wrap around 52
                    if (t.position < entryPos) {
                        stepsToEntry = entryPos - t.position;
                    } else {
                        stepsToEntry = (52 - t.position) + entryPos;
                    }
                }
                const stepsInHomeStretch = HOME_POSITIONS[color] - entryPos;
                distToFinish = stepsToEntry + stepsInHomeStretch;
            }

            return `  ${color} #${t.sn}: position ${t.position}, ${t.isSafePath ? 'SAFE PATH (HIDDEN FROM OPPONENTS)' : 'main board (EXPOSED)'}, distance to finish: ${distToFinish}${!t.isSafePath ? `, entry to safe path at: ${entryPos}` : ''}`;
        });
    });

    // Describe opponent tokens (visible positions)
    const opponentDescriptions = opponentColors.flatMap((color) => {
        const tokens = state.tokens[color] || [];
        return tokens
            .filter((t) => t.active && !t.isFinished)
            .map((t) => `  ${color} #${t.sn}: position ${t.position}${t.isSafePath ? ' (on their SAFE PATH - cannot be captured)' : ''}`);
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

export function buildLegalMovesDescription(legalMoves: LegalMove[]): string {
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

export function buildPrompt(stateDesc: string, movesDesc: string, moveCount: number): string {
    return `You are an expert Ludo game AI. Analyze the board state and pick the BEST move.

GAME STATE:
${stateDesc}

AVAILABLE MOVES:
${movesDesc}

CRITICAL RULES & STRATEGY:
- THERE ARE NO SAFE SPOTS (STARS) ON THE MAIN BOARD. Every position from 1 to 52 is dangerous.
- A token is ONLY safe once it enters its "SAFE PATH" (Home Stretch). 
- Opponents CANNOT capture your tokens if they are on your SAFE PATH.
- You CANNOT capture opponent tokens if they are on their SAFE PATH.
- Capturing opponent tokens sends them back home — this is the HIGHEST priority if it doesn't put you at extreme risk.
- Finishing tokens (reaching home) is permanent progress.
- Activating new tokens when you roll a 6 is usually better than moving a token that is already safe.
- Moving tokens on the SAFE PATH is 100% risk-free.
- Tokens on the main board (positions 1-52) can be captured by any opponent that lands on the same position.
- Risk Assessment: If you move a token on the main board, check if an opponent is behind it and could roll to reach its new position.

INSTRUCTIONS:
Pick the single best move number (0 to ${moveCount - 1}).
Respond with ONLY a valid JSON object. Do not include any markdown formatting, code blocks, or conversational text.
Format:
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
export function generateLegalMoves(state: LudoGameState, player: LudoPlayer): LegalMove[] {
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
    const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
                // responseMimeType: 'application/json',
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

// ─── JSON Parsing Helper ─────────────────────────────────────────

/**
 * Robustly parses JSON from LLM response.
 * Handles "thinking" blocks, markdown code fences, and conversational text.
 */
function cleanAndParseJSON(text: string): any {
    try {
        // 1. Try direct parsing first
        return JSON.parse(text);
    } catch (e) {
        // 2. Find the first '{' and last '}'
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');

        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            const jsonCandidate = text.substring(firstOpen, lastClose + 1);
            try {
                return JSON.parse(jsonCandidate);
            } catch (innerError) {
                console.warn('[AI-LLM] Failed to parse extracted JSON candidate:', jsonCandidate);
            }
        }

        // Log the full text for debugging if parsing fails
        console.error('[AI-LLM] JSON Parse Failure. Full Text received:', text);
        throw new Error(`Failed to parse JSON from response. First 100 chars: ${text.substring(0, 100)}...`);
    }
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

        // Parse the JSON response securely
        const parsed = cleanAndParseJSON(rawResponse);
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
