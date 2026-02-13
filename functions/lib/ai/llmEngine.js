"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGameStateDescription = buildGameStateDescription;
exports.buildLegalMovesDescription = buildLegalMovesDescription;
exports.buildPrompt = buildPrompt;
exports.generateLegalMoves = generateLegalMoves;
exports.llmPickMove = llmPickMove;
const ludoLogic_1 = require("./ludoLogic");
const aiEngine_1 = require("./aiEngine");
function buildGameStateDescription(state, player) {
    const playerColors = player.tokens || [];
    const opponentColors = Object.keys(state.tokens).filter((c) => !playerColors.includes(c));
    const SAFE_ZONE_ENTRIES = {
        red: 53,
        green: 14,
        yellow: 27,
        blue: 40,
    };
    const aiTokenDescriptions = playerColors.flatMap((color) => {
        const tokens = state.tokens[color] || [];
        const entryPos = SAFE_ZONE_ENTRIES[color];
        return tokens.map((t) => {
            if (t.isFinished)
                return `  ${color} #${t.sn}: FINISHED`;
            if (!t.active)
                return `  ${color} #${t.sn}: AT HOME (inactive)`;
            let distToFinish;
            if (t.isSafePath) {
                distToFinish = ludoLogic_1.HOME_POSITIONS[color] - t.position;
            }
            else {
                let stepsToEntry;
                if (color === 'red') {
                    stepsToEntry = entryPos - t.position;
                }
                else {
                    if (t.position < entryPos) {
                        stepsToEntry = entryPos - t.position;
                    }
                    else {
                        stepsToEntry = (52 - t.position) + entryPos;
                    }
                }
                const stepsInHomeStretch = ludoLogic_1.HOME_POSITIONS[color] - entryPos;
                distToFinish = stepsToEntry + stepsInHomeStretch;
            }
            return `  ${color} #${t.sn}: position ${t.position}, ${t.isSafePath ? 'SAFE PATH (HIDDEN)' : 'main board (EXPOSED)'}, dist to finish: ${distToFinish}${!t.isSafePath ? `, gate at: ${entryPos}` : ''}`;
        });
    });
    const opponentDescriptions = opponentColors.flatMap((color) => {
        const tokens = state.tokens[color] || [];
        return tokens
            .filter((t) => t.active && !t.isFinished)
            .map((t) => `  ${color} #${t.sn}: position ${t.position}${t.isSafePath ? ' (on their SAFE PATH)' : ''}`);
    });
    return [
        `You are playing Ludo as player "${player.name}" (ID: ${player.id}).`,
        `Your colors: ${playerColors.join(', ')}`,
        `Board scale: positions 1 to 52 (circular, 52 wraps back to 1).`,
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
function buildLegalMovesDescription(legalMoves) {
    if (legalMoves.length === 0)
        return 'No legal moves available.';
    const lines = legalMoves.map((m) => {
        const parts = [`Move ${m.index}: Use dice ${m.diceValue} on ${m.color} token #${m.tokenId}`];
        if (m.wouldActivate)
            parts.push('→ ACTIVATES token from home');
        else
            parts.push(`→ moves to position ${m.projectedPosition}`);
        if (m.wouldCapture)
            parts.push('⚔️ CAPTURES opponent!');
        if (m.wouldFinish)
            parts.push('🏠 FINISHES token!');
        if (m.willBeSafe && !m.wouldActivate)
            parts.push('🛡️ enters safe path (HIDDEN)');
        return parts.join(' ');
    });
    return lines.join('\n');
}
function buildPrompt(stateDesc, movesDesc, moveCount) {
    return `You are an expert Ludo game AI. Analyze the board state and pick the BEST move.

GAME STATE:
${stateDesc}

AVAILABLE MOVES:
${movesDesc}

STRATEGIC CONTEXT:
1. CIRCULAR BOARD: Position 52 wraps to 1. If you are at 51 and move 3, you land on 2. 
2. EXPOSED TOKENS: Any token on "main board" (positions 1-52) can be captured by any opponent. 
3. SAFE PATH: Tokens on "SAFE PATH" are permanent and hidden from opponents. No captures can happen here.
4. NO STARS: THERE ARE NO SAFE SPOTS ON THE MAIN BOARD. Every spot is dangerous.
5. WRAP-AROUND RISK: An opponent at 50 is physically 4 steps behind a token at 2. 
6. HOME THREAT: Landing on an opponent's start position is VERY RISKY if they have inactive tokens at home (they can activate and hit you).

TACTICAL PRIORITIES:
- CAPTURE opponents whenever possible (highest priority).
- FINISH tokens to secure points.
- Move tokens into the SAFE PATH to hide them from danger.
- Activate new tokens with 6s to increase board presence.
- Avoid landing in range of opponents (1-6 steps behind you, including wrap-around).

INSTRUCTIONS:
Pick the single best move number (0 to ${moveCount - 1}).
Respond with ONLY a valid JSON object. Do not include any markdown formatting, code blocks, or conversational text.
Format:
{"move": <number>, "reasoning": "<brief explanation>"}`;
}
function generateLegalMoves(state, player) {
    const playerColors = player.tokens || [];
    const availableDice = [...state.diceValue];
    (state.usedDiceValues || []).forEach((usedVal) => {
        const idx = availableDice.indexOf(usedVal);
        if (idx !== -1)
            availableDice.splice(idx, 1);
    });
    const moves = [];
    let index = 0;
    for (const diceVal of availableDice) {
        for (const color of playerColors) {
            const tokensOfColor = state.tokens[color] || [];
            const movable = (0, ludoLogic_1.getMovableTokens)(diceVal, tokensOfColor, color);
            for (const token of movable) {
                const wouldActivate = !token.active;
                let projectedPosition;
                let willBeSafe;
                let wouldCapture = false;
                let wouldFinish = false;
                if (wouldActivate) {
                    projectedPosition = ludoLogic_1.START_PATHS[color];
                    willBeSafe = false;
                    wouldCapture = checkCapture(state, playerColors, projectedPosition, false);
                }
                else {
                    const proj = (0, ludoLogic_1.getProjectedPosition)(token, diceVal);
                    projectedPosition = proj.position;
                    willBeSafe = proj.willBeSafe;
                    wouldFinish = willBeSafe && projectedPosition === ludoLogic_1.HOME_POSITIONS[color];
                    wouldCapture = !willBeSafe && checkCapture(state, playerColors, projectedPosition, willBeSafe);
                }
                const isDuplicate = moves.some((m) => m.color === color && m.tokenId === token.sn && m.diceValue === diceVal);
                if (isDuplicate)
                    continue;
                moves.push({
                    index: index++,
                    color,
                    tokenId: token.sn,
                    tokenPosition: token.position,
                    isActive: token.active,
                    diceValue: diceVal,
                    projectedPosition,
                    willBeSafe,
                    wouldCapture,
                    wouldFinish,
                    wouldActivate,
                });
            }
        }
    }
    return moves;
}
function checkCapture(state, playerColors, targetPos, isSafe) {
    if (isSafe)
        return false;
    for (const colorKey of Object.keys(state.tokens)) {
        if (playerColors.includes(colorKey))
            continue;
        const opponentTokens = state.tokens[colorKey] || [];
        if (opponentTokens.some((t) => t.active && !t.isSafePath && t.position === targetPos)) {
            return true;
        }
    }
    return false;
}
async function callGemini(prompt, apiKey) {
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
            },
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text)
        throw new Error('Empty response from Gemini');
    return text.trim();
}
function cleanAndParseJSON(text) {
    try {
        return JSON.parse(text);
    }
    catch (e) {
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            const jsonCandidate = text.substring(firstOpen, lastClose + 1);
            try {
                return JSON.parse(jsonCandidate);
            }
            catch (innerError) {
                console.warn('[AI-LLM] Failed to parse extracted JSON candidate:', jsonCandidate);
            }
        }
        console.error('[AI-LLM] JSON Parse Failure. Full Text received:', text);
        throw new Error(`Failed to parse JSON from response. First 100 chars: ${text.substring(0, 100)}...`);
    }
}
async function llmPickMove(gameState) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
        console.warn('[AI-LLM] No GEMINI_API_KEY set, falling back to rule-based engine.');
        return (0, aiEngine_1.pickMove)(gameState);
    }
    const player = gameState.players.find((p) => p.id === gameState.currentTurn);
    if (!player)
        return null;
    const legalMoves = generateLegalMoves(gameState, player);
    if (legalMoves.length === 0)
        return null;
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
        const parsed = cleanAndParseJSON(rawResponse);
        const moveIndex = parsed.move;
        if (typeof moveIndex !== 'number' || moveIndex < 0 || moveIndex >= legalMoves.length) {
            console.warn(`[AI-LLM] Invalid move index ${moveIndex}, falling back to rule-based.`);
            return (0, aiEngine_1.pickMove)(gameState);
        }
        const chosen = legalMoves[moveIndex];
        console.log(`[AI-LLM] Gemini chose move ${moveIndex}: ${chosen.color} #${chosen.tokenId} with dice ${chosen.diceValue}. Reason: ${parsed.reasoning || 'none'}`);
        return {
            color: chosen.color,
            tokenId: chosen.tokenId,
            diceValues: [chosen.diceValue],
        };
    }
    catch (error) {
        console.error('[AI-LLM] LLM failed, falling back to rule-based engine:', error);
        return (0, aiEngine_1.pickMove)(gameState);
    }
}
//# sourceMappingURL=llmEngine.js.map