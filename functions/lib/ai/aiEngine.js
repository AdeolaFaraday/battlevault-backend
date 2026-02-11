"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickMove = pickMove;
exports.isAIPlayer = isAIPlayer;
const ludoLogic_1 = require("./ludoLogic");
const SCORE_CAPTURE = 1000;
const SCORE_FINISH = 800;
const SCORE_ACTIVATE = 600;
const SCORE_ADVANCE_MAX = 400;
function wouldCapture(tokens, playerColors, targetColor, targetPos, isSafePath) {
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
function distanceToFinish(token) {
    const homePos = ludoLogic_1.HOME_POSITIONS[token.color];
    if (!token.active)
        return homePos + 52;
    if (token.isFinished)
        return 0;
    if (token.isSafePath)
        return homePos - token.position;
    const gatePositions = {
        red: 53,
        green: 14,
        yellow: 27,
        blue: 40,
    };
    const gate = gatePositions[token.color];
    let dist = gate - token.position;
    if (dist < 0)
        dist += 52;
    dist += homePos;
    return dist;
}
function pickMove(gameState) {
    const aiPlayerId = gameState.currentTurn;
    const player = gameState.players.find((p) => p.id === aiPlayerId);
    if (!player)
        return null;
    const playerColors = player.tokens || [];
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
                if (!token.active) {
                    const startPos = ludoLogic_1.START_PATHS[color];
                    if (wouldCapture(gameState.tokens, playerColors, color, startPos, false)) {
                        score = SCORE_CAPTURE + SCORE_ACTIVATE;
                    }
                    else {
                        score = SCORE_ACTIVATE;
                    }
                    scoredMoves.push({
                        move: { color, tokenId: token.sn, diceValues: [diceVal] },
                        score,
                    });
                    continue;
                }
                const { position: projPos, willBeSafe } = (0, ludoLogic_1.getProjectedPosition)(token, diceVal);
                const homePos = ludoLogic_1.HOME_POSITIONS[color];
                const wouldFinish = willBeSafe && projPos === homePos;
                if (wouldFinish) {
                    score = SCORE_FINISH;
                    scoredMoves.push({
                        move: { color, tokenId: token.sn, diceValues: [diceVal] },
                        score,
                    });
                    continue;
                }
                if (wouldCapture(gameState.tokens, playerColors, color, projPos, willBeSafe)) {
                    score = SCORE_CAPTURE;
                    scoredMoves.push({
                        move: { color, tokenId: token.sn, diceValues: [diceVal] },
                        score,
                    });
                    continue;
                }
                const currentDist = distanceToFinish(token);
                const maxDist = 52 + 20;
                const proximity = Math.max(0, maxDist - currentDist) / maxDist;
                score = Math.round(SCORE_ADVANCE_MAX * proximity);
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
    if (scoredMoves.length === 0)
        return null;
    scoredMoves.sort((a, b) => b.score - a.score);
    const topScore = scoredMoves[0].score;
    const topMoves = scoredMoves.filter((m) => m.score === topScore);
    const chosen = topMoves[Math.floor(Math.random() * topMoves.length)];
    return chosen.move;
}
function isAIPlayer(playerId) {
    return !!playerId && playerId.startsWith('ai-');
}
//# sourceMappingURL=aiEngine.js.map