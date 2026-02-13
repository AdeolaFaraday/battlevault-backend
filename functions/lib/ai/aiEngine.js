"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickMove = pickMove;
exports.isAIPlayer = isAIPlayer;
const ludoLogic_1 = require("./ludoLogic");
const WEIGHTS = {
    easy: { capture: 500, finish: 400, activate: 300, advance: 100, risk: 0, safe: 20, randomness: 50 },
    medium: { capture: 1000, finish: 800, activate: 400, advance: 200, risk: -150, safe: 100, randomness: 10 },
    hard: { capture: 2000, finish: 1500, activate: 600, advance: 300, risk: -400, safe: 200, randomness: 0 },
};
function wouldCapture(tokens, playerColors, targetPos, isSafePath) {
    if (isSafePath)
        return false;
    for (const colorKey of Object.keys(tokens)) {
        if (playerColors.includes(colorKey))
            continue;
        const opponentTokens = tokens[colorKey] || [];
        const hasVictim = opponentTokens.some((t) => t.active && !t.isSafePath && t.position === targetPos);
        if (hasVictim)
            return true;
    }
    return false;
}
function calculateRiskAt(tokens, playerColors, targetPos, isSafePath) {
    if (isSafePath)
        return 0;
    let riskCount = 0;
    for (const colorKey of Object.keys(tokens)) {
        if (playerColors.includes(colorKey))
            continue;
        const opponentTokens = tokens[colorKey] || [];
        opponentTokens.forEach(t => {
            if (t.active && !t.isSafePath) {
                let dist = targetPos - t.position;
                if (dist < 0)
                    dist += 52;
                if (dist >= 1 && dist <= 6) {
                    riskCount++;
                }
            }
        });
    }
    return riskCount;
}
function distanceToFinish(token) {
    const gatePositions = {
        red: 53,
        green: 14,
        yellow: 27,
        blue: 40,
    };
    if (!token.active)
        return 52 + 5;
    if (token.isFinished)
        return 0;
    const homePos = ludoLogic_1.HOME_POSITIONS[token.color];
    if (token.isSafePath) {
        return homePos - token.position;
    }
    const gate = gatePositions[token.color];
    let stepsToGate = gate - token.position;
    if (stepsToGate < 0)
        stepsToGate += 52;
    const stepsInHomeStretch = homePos - gate;
    return stepsToGate + stepsInHomeStretch;
}
function pickMove(gameState, difficulty = 'medium') {
    const aiPlayerId = gameState.currentTurn;
    const player = gameState.players.find((p) => p.id === aiPlayerId);
    if (!player)
        return null;
    const playerColors = player.tokens || [];
    const config = WEIGHTS[difficulty];
    const availableDice = [...gameState.diceValue];
    (gameState.usedDiceValues || []).forEach((usedVal) => {
        const idx = availableDice.indexOf(usedVal);
        if (idx !== -1)
            availableDice.splice(idx, 1);
    });
    if (availableDice.length === 0)
        return null;
    const scoredMoves = [];
    for (const diceVal of availableDice) {
        for (const color of playerColors) {
            const tokensOfColor = gameState.tokens[color] || [];
            const movable = (0, ludoLogic_1.getMovableTokens)(diceVal, tokensOfColor, color);
            for (const token of movable) {
                let score = 0;
                let reason = "";
                if (!token.active) {
                    const startPos = ludoLogic_1.START_PATHS[color];
                    score = config.activate;
                    reason = "Activate";
                    if (wouldCapture(gameState.tokens, playerColors, startPos, false)) {
                        score += config.capture;
                        reason += " + Capture on Start";
                    }
                }
                else {
                    const { position: projPos, willBeSafe } = (0, ludoLogic_1.getProjectedPosition)(token, diceVal);
                    const homePos = ludoLogic_1.HOME_POSITIONS[color];
                    if (willBeSafe && projPos === homePos) {
                        score += config.finish;
                        reason += "FINISH! ";
                    }
                    if (wouldCapture(gameState.tokens, playerColors, projPos, willBeSafe)) {
                        score += config.capture;
                        reason += "Capture Opponent! ";
                    }
                    const distBefore = distanceToFinish(token);
                    const distAfter = distBefore - diceVal;
                    const progressScore = Math.round((config.advance / 52) * (52 - distAfter));
                    score += progressScore;
                    if (willBeSafe && !token.isSafePath) {
                        score += config.safe;
                        reason += "Enter Safe Zone ";
                    }
                    else if (token.isSafePath) {
                        score += config.safe / 2;
                    }
                    const riskCount = calculateRiskAt(gameState.tokens, playerColors, projPos, willBeSafe);
                    if (riskCount > 0) {
                        score += (riskCount * config.risk);
                        reason += `Risk Penalty (Hit by ${riskCount}) `;
                    }
                }
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
    if (scoredMoves.length === 0)
        return null;
    scoredMoves.sort((a, b) => b.score - a.score);
    const topScore = scoredMoves[0].score;
    const bestMoves = scoredMoves.filter(m => m.score === topScore);
    const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    console.log(`[AI-Rules] Difficulty: ${difficulty} | Scoring: ${chosen.score} | Reason: ${chosen.move.reasoning}`);
    return chosen.move;
}
function isAIPlayer(playerId) {
    return !!playerId && playerId.startsWith('ai-');
}
//# sourceMappingURL=aiEngine.js.map