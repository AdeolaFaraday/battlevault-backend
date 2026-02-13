"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickMove = pickMove;
exports.isAIPlayer = isAIPlayer;
const ludoLogic_1 = require("./ludoLogic");
const WEIGHTS = {
    easy: {
        capture: 800, finish: 400, activate: 300, advance: 100,
        risk: 0, threatFromHome: 0, startExit: 10, safe: 20,
        pairing: 10, chasing: 5, randomness: 50
    },
    medium: {
        capture: 2500, finish: 1200, activate: 500, advance: 200,
        risk: -200, threatFromHome: -150, startExit: 80, safe: 150,
        pairing: 100, chasing: 50, randomness: 10
    },
    hard: {
        capture: 5000, finish: 2500, activate: 800, advance: 400,
        risk: -600, threatFromHome: -400, startExit: 150, safe: 300,
        pairing: 300, chasing: 150, randomness: 0
    },
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
function isPairing(tokens, playerColor, tokenId, targetPos, isSafePath) {
    if (isSafePath)
        return false;
    const myTokens = tokens[playerColor] || [];
    return myTokens.some(t => t.active && !t.isSafePath && t.sn !== tokenId && t.position === targetPos);
}
function checkThreatFromHome(tokens, playerColors, targetPos, isSafePath) {
    if (isSafePath)
        return false;
    const START_POSITIONS = {
        blue: 41, green: 15, yellow: 28, red: 2,
    };
    for (const colorKey of Object.keys(tokens)) {
        if (playerColors.includes(colorKey))
            continue;
        const startPos = START_POSITIONS[colorKey];
        if (targetPos === startPos) {
            const atHome = tokens[colorKey]?.some(t => !t.active && !t.isFinished);
            if (atHome)
                return true;
        }
    }
    return false;
}
function calculateScaledRisk(tokens, playerColors, targetPos, isSafePath) {
    if (isSafePath)
        return 0;
    let totalRisk = 0;
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
                    const weight = 1 + (7 - dist) / 10;
                    totalRisk += weight;
                }
            }
        });
    }
    return totalRisk;
}
function calculateChasingBonus(tokens, playerColors, targetPos, isSafePath) {
    if (isSafePath)
        return 0;
    let chaseCount = 0;
    for (const colorKey of Object.keys(tokens)) {
        if (playerColors.includes(colorKey))
            continue;
        const opponentTokens = tokens[colorKey] || [];
        opponentTokens.forEach(t => {
            if (t.active && !t.isSafePath) {
                let dist = t.position - targetPos;
                if (dist < 0)
                    dist += 52;
                if (dist >= 1 && dist <= 6) {
                    chaseCount++;
                }
            }
        });
    }
    return chaseCount;
}
function distanceToFinish(token) {
    const gatePositions = {
        red: 53, green: 14, yellow: 27, blue: 40,
    };
    if (!token.active)
        return 52 + 5;
    if (token.isFinished)
        return 0;
    const homePos = ludoLogic_1.HOME_POSITIONS[token.color];
    if (token.isSafePath)
        return homePos - token.position;
    const gate = gatePositions[token.color];
    let stepsToGate = gate - token.position;
    if (stepsToGate < 0)
        stepsToGate += 52;
    const stepsInHomeStretch = homePos - gate;
    return stepsToGate + stepsInHomeStretch;
}
function distanceMoved(token) {
    if (!token.active || token.isSafePath || token.isFinished)
        return 99;
    const startPos = ludoLogic_1.START_PATHS[token.color];
    let dist = token.position - startPos;
    if (dist < 0)
        dist += 52;
    return dist;
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
                        reason += " + Kill on Start";
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
                        reason += "KILL-PROMOTION! ";
                    }
                    if (isPairing(gameState.tokens, color, token.sn, projPos, willBeSafe)) {
                        score += config.pairing;
                        reason += "Pairing ";
                    }
                    const distBefore = distanceToFinish(token);
                    const distAfter = distBefore - diceVal;
                    const progressScore = Math.round((config.advance / 52) * (52 - distAfter));
                    score += progressScore;
                    if (willBeSafe && !token.isSafePath) {
                        const riskAtGate = calculateScaledRisk(gameState.tokens, playerColors, token.position, false);
                        const gateDefenseBonus = riskAtGate > 0 ? config.safe * 1.5 : config.safe;
                        score += gateDefenseBonus;
                        reason += riskAtGate > 0 ? "Defensive Entry " : "Enter Safe Zone ";
                    }
                    else if (token.isSafePath) {
                        score += config.safe / 2;
                    }
                    const distFromStart = distanceMoved(token);
                    if (distFromStart <= 10) {
                        score += config.startExit;
                        reason += "Clear Start ";
                    }
                    const scaledRisk = calculateScaledRisk(gameState.tokens, playerColors, projPos, willBeSafe);
                    if (scaledRisk > 0) {
                        score += Math.round(scaledRisk * config.risk);
                        reason += `Risk Penalty (${scaledRisk.toFixed(1)}) `;
                    }
                    const chasingCount = calculateChasingBonus(gameState.tokens, playerColors, projPos, willBeSafe);
                    if (chasingCount > 0) {
                        score += (chasingCount * config.chasing);
                        reason += `Chasing (${chasingCount}) `;
                    }
                    if (checkThreatFromHome(gameState.tokens, playerColors, projPos, willBeSafe)) {
                        score += config.threatFromHome;
                        reason += "Home Threat ";
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