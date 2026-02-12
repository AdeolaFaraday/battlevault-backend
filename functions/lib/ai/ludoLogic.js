"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMoveUpdate = exports.isDiceValueUsable = exports.getMovableTokens = exports.getProjectedPosition = exports.getNextPlayerId = exports.START_PATHS = exports.HOME_POSITIONS = exports.LudoStatus = exports.LudoColor = void 0;
var LudoColor;
(function (LudoColor) {
    LudoColor["BLUE"] = "blue";
    LudoColor["YELLOW"] = "yellow";
    LudoColor["GREEN"] = "green";
    LudoColor["RED"] = "red";
})(LudoColor || (exports.LudoColor = LudoColor = {}));
var LudoStatus;
(function (LudoStatus) {
    LudoStatus["WAITING"] = "waiting";
    LudoStatus["PLAYING_DICE"] = "playingDice";
    LudoStatus["PLAYING_TOKEN"] = "playingToken";
    LudoStatus["FINISHED"] = "finished";
})(LudoStatus || (exports.LudoStatus = LudoStatus = {}));
exports.HOME_POSITIONS = {
    green: 19,
    yellow: 32,
    blue: 45,
    red: 58,
};
exports.START_PATHS = {
    blue: 41,
    green: 15,
    yellow: 28,
    red: 2,
};
const getNextPlayerId = (players, currentTurnId) => {
    const currentIndex = players.findIndex((p) => p.id === currentTurnId);
    if (currentIndex === -1)
        return currentTurnId;
    const nextIndex = (currentIndex + 1) % players.length;
    return players[nextIndex].id || "";
};
exports.getNextPlayerId = getNextPlayerId;
const getProjectedPosition = (token, moveAmount) => {
    const { color, position, isSafePath } = token;
    const currentPos = position || 0;
    if (isSafePath) {
        return { position: currentPos + moveAmount, willBeSafe: true };
    }
    let projected = currentPos + moveAmount;
    let willBeSafe = false;
    if (color === 'red' && projected >= 53)
        willBeSafe = true;
    else if (color === 'green' && currentPos <= 13 && projected >= 14)
        willBeSafe = true;
    else if (color === 'yellow' && currentPos <= 26 && projected >= 27)
        willBeSafe = true;
    else if (color === 'blue' && currentPos <= 39 && projected >= 40)
        willBeSafe = true;
    if (!willBeSafe && projected > 52)
        projected -= 52;
    return { position: projected, willBeSafe };
};
exports.getProjectedPosition = getProjectedPosition;
const getMovableTokens = (diceValue, tokens, color) => {
    const homePos = exports.HOME_POSITIONS[color];
    return tokens.filter((token) => {
        if (!token.active)
            return diceValue === 6;
        if (token.isFinished)
            return false;
        const { position: projected, willBeSafe } = (0, exports.getProjectedPosition)(token, diceValue);
        if (token.isSafePath || willBeSafe) {
            return projected <= homePos;
        }
        return true;
    });
};
exports.getMovableTokens = getMovableTokens;
const isDiceValueUsable = (diceValue, tokens, color) => {
    return (0, exports.getMovableTokens)(diceValue, tokens, color).length > 0;
};
exports.isDiceValueUsable = isDiceValueUsable;
const calculateMoveUpdate = (gameState, color, tokenSn, newPos, diceConsumed, allAvailableDice, isSafePath) => {
    const currentTokens = gameState.tokens[color] || [];
    const existingToken = currentTokens.find((t) => t.sn === tokenSn);
    const players = gameState.players || [];
    const currentPlayerIndex = players.findIndex((p) => p.tokens.includes(color));
    const player = currentPlayerIndex !== -1 ? players[currentPlayerIndex] : null;
    if (!existingToken)
        throw new Error("Token not found");
    const isFinished = isSafePath && newPos === exports.HOME_POSITIONS[color];
    const updatedToken = {
        ...existingToken,
        position: newPos,
        active: true,
        isSafePath: isSafePath,
        isFinished: isFinished,
    };
    let killedOpponent = null;
    const updatedTokensMap = { ...gameState.tokens };
    let killerPromoted = false;
    if (!isSafePath) {
        Object.keys(updatedTokensMap).forEach((key) => {
            const isOpponentColor = player ? !player.tokens.includes(key) : key !== color;
            if (isOpponentColor) {
                const opponentTokens = [...updatedTokensMap[key]];
                const victimIndex = opponentTokens.findIndex((t) => t.active && !t.isSafePath && t.position === newPos);
                if (victimIndex !== -1) {
                    const victim = opponentTokens[victimIndex];
                    killedOpponent = { color: key, sn: victim.sn };
                    opponentTokens[victimIndex] = { ...victim, active: false, position: 0, isSafePath: false };
                    updatedTokensMap[key] = opponentTokens;
                    killerPromoted = true;
                }
            }
        });
    }
    if (killerPromoted) {
        updatedToken.position = exports.HOME_POSITIONS[color];
        updatedToken.isSafePath = true;
        updatedToken.isFinished = true;
    }
    const updatedPlayers = [...players];
    if (currentPlayerIndex !== -1) {
        const updatedPlayer = { ...updatedPlayers[currentPlayerIndex] };
        let statsChanged = false;
        if (killedOpponent) {
            updatedPlayer.capturedCount = (updatedPlayer.capturedCount || 0) + 1;
            if (killerPromoted) {
                updatedPlayer.finishedCount = (updatedPlayer.finishedCount || 0) + 1;
            }
            statsChanged = true;
        }
        if (!killerPromoted && isFinished) {
            updatedPlayer.finishedCount = (updatedPlayer.finishedCount || 0) + 1;
            statsChanged = true;
        }
        if (statsChanged) {
            updatedPlayers[currentPlayerIndex] = updatedPlayer;
        }
    }
    updatedTokensMap[color] = currentTokens.map((t) => (t.sn === tokenSn ? updatedToken : t));
    let allTokensFinished = false;
    if (player) {
        allTokensFinished = player.tokens.every((tokenColor) => {
            const tokens = updatedTokensMap[tokenColor] || [];
            return tokens.length > 0 && tokens.every(t => t.isFinished);
        });
    }
    if (allTokensFinished) {
        return {
            ...gameState,
            players: updatedPlayers,
            tokens: updatedTokensMap,
            usedDiceValues: [...(gameState.usedDiceValues || []), ...diceConsumed],
            activeDiceConfig: null,
            status: LudoStatus.FINISHED,
            winner: player?.id,
            currentTurn: gameState.currentTurn,
        };
    }
    const remainingDiceCount = allAvailableDice.length - diceConsumed.length;
    let isTurnOver = remainingDiceCount === 0;
    if (!isTurnOver) {
        const remainingDiceValues = [...allAvailableDice];
        diceConsumed.forEach(val => {
            const idx = remainingDiceValues.indexOf(val);
            if (idx !== -1)
                remainingDiceValues.splice(idx, 1);
        });
        const canMakeAnyMove = remainingDiceValues.some(diceVal => player?.tokens.some((tokenColor) => (0, exports.isDiceValueUsable)(diceVal, updatedTokensMap[tokenColor] || [], tokenColor)) ?? (0, exports.isDiceValueUsable)(diceVal, updatedTokensMap[color] || [], color));
        if (!canMakeAnyMove) {
            isTurnOver = true;
        }
    }
    const isDoubleSix = gameState.diceValue.length === 2 && gameState.diceValue.every(v => v === 6);
    const grantsExtraTurn = isDoubleSix;
    return {
        ...gameState,
        players: updatedPlayers,
        tokens: updatedTokensMap,
        usedDiceValues: [...(gameState.usedDiceValues || []), ...diceConsumed],
        activeDiceConfig: null,
        status: isTurnOver ? "playingDice" : "playingToken",
        currentTurn: (isTurnOver && !grantsExtraTurn) ? (0, exports.getNextPlayerId)(gameState.players, gameState.currentTurn) : gameState.currentTurn,
    };
};
exports.calculateMoveUpdate = calculateMoveUpdate;
//# sourceMappingURL=ludoLogic.js.map