export enum LudoColor {
    BLUE = 'blue',
    YELLOW = 'yellow',
    GREEN = 'green',
    RED = 'red',
}

export enum LudoStatus {
    WAITING = 'waiting',
    PLAYING_DICE = 'playingDice',
    PLAYING_TOKEN = 'playingToken',
    FINISHED = 'finished',
}

export interface Token {
    sn: number;
    color: string;
    active: boolean;
    position: number;
    isSafePath: boolean;
    isFinished: boolean;
}

export interface LudoPlayer {
    id: string;
    name: string;
    avatarUrl?: string;
    color: string;
    tokens: string[];
    capturedCount: number;
    finishedCount: number;
}

export interface TokenMap {
    [key: string]: Token[];
}

export interface LudoGameState {
    id: string;
    players: LudoPlayer[];
    currentTurn: string;
    diceValue: number[];
    isRolling: boolean;
    status: string;
    winner?: string;
    tokens: TokenMap;
    usedDiceValues: number[];
    activeDiceConfig: number[] | null;
    lastMoverId?: string;
    startDate?: string;
}

export const HOME_POSITIONS: { [key: string]: number } = {
    green: 19,
    yellow: 32,
    blue: 45,
    red: 58,
};

export const START_PATHS: { [key: string]: number } = {
    blue: 41,
    green: 15,
    yellow: 28,
    red: 2,
};

export const getNextPlayerId = (players: LudoPlayer[], currentTurnId: string) => {
    const currentIndex = players.findIndex((p) => p.id === currentTurnId);
    if (currentIndex === -1) return currentTurnId;
    const nextIndex = (currentIndex + 1) % players.length;
    return players[nextIndex].id;
};

export const getProjectedPosition = (token: Token, moveAmount: number) => {
    const { color, position, isSafePath } = token;
    const currentPos = position || 0;

    if (isSafePath) {
        return { position: currentPos + moveAmount, willBeSafe: true };
    }

    let projected = currentPos + moveAmount;
    let willBeSafe = false;

    // Gate checks
    if (color === 'red' && projected >= 53) willBeSafe = true;
    else if (color === 'green' && currentPos <= 13 && projected >= 14) willBeSafe = true;
    else if (color === 'yellow' && currentPos <= 26 && projected >= 27) willBeSafe = true;
    else if (color === 'blue' && currentPos <= 39 && projected >= 40) willBeSafe = true;

    if (!willBeSafe && projected > 52) projected -= 52;

    return { position: projected, willBeSafe };
};

export const getMovableTokens = (diceValue: number, tokens: Token[], color: string) => {
    const homePos = HOME_POSITIONS[color];

    return tokens.filter((token) => {
        if (!token.active) return diceValue === 6; // Activation
        if (token.isFinished) return false;

        const { position: projected, willBeSafe } = getProjectedPosition(token, diceValue);

        // Overshoot check only applies if safe or entering safe path
        if (token.isSafePath || willBeSafe) {
            return projected <= homePos;
        }

        return true; // Tokens on main path never overshoot
    });
};

export const isDiceValueUsable = (diceValue: number, tokens: Token[], color: string) => {
    return getMovableTokens(diceValue, tokens, color).length > 0;
};

/**
 * Backend adaptation of the updateGameState logic.
 * Returns the updated game state.
 */
export const calculateMoveUpdate = (
    gameState: LudoGameState,
    color: string,
    tokenSn: number,
    newPos: number,
    diceConsumed: number[],
    allAvailableDice: number[],
    isSafePath: boolean
): LudoGameState => {
    const currentTokens = gameState.tokens[color] || [];
    const existingToken = currentTokens.find((t: Token) => t.sn === tokenSn);
    const players = gameState.players || [];
    const currentPlayerIndex = players.findIndex((p) => p.color === color);

    if (!existingToken) throw new Error("Token not found");

    const isFinished = isSafePath && newPos === HOME_POSITIONS[color];

    // Create the updated token object
    const updatedToken: Token = {
        ...existingToken,
        position: newPos,
        active: true,
        isSafePath: isSafePath,
        isFinished: isFinished,
    };

    // COLLISION CHECK
    let killedOpponent: { color: string; sn: number } | null = null;
    const updatedTokensMap = { ...gameState.tokens };
    let killerPromoted = false;

    if (!isSafePath) {
        Object.keys(updatedTokensMap).forEach((key) => {
            if (key !== color) {
                const opponentTokens = [...updatedTokensMap[key]];
                const victimIndex = opponentTokens.findIndex(
                    (t) => t.active && !t.isSafePath && t.position === newPos
                );
                if (victimIndex !== -1) {
                    const victim = opponentTokens[victimIndex];
                    killedOpponent = { color: key, sn: victim.sn };

                    // Reset Victim
                    opponentTokens[victimIndex] = { ...victim, active: false, position: -1, isSafePath: false };
                    updatedTokensMap[key] = opponentTokens;

                    // KILL = FINISH RULE
                    killerPromoted = true;
                }
            }
        });
    }

    // Apply Promotion if Kill Happened
    if (killerPromoted) {
        updatedToken.position = HOME_POSITIONS[color];
        updatedToken.isSafePath = true;
        updatedToken.isFinished = true;
    }

    // UPDATE CURRENT PLAYER STATS
    const updatedPlayers = [...players];
    if (currentPlayerIndex !== -1) {
        const player = { ...updatedPlayers[currentPlayerIndex] };
        let statsChanged = false;

        if (killedOpponent) {
            player.capturedCount = (player.capturedCount || 0) + 1;
            if (killerPromoted) {
                player.finishedCount = (player.finishedCount || 0) + 1;
            }
            statsChanged = true;
        }

        if (!killerPromoted && isFinished) {
            player.finishedCount = (player.finishedCount || 0) + 1;
            statsChanged = true;
        }

        if (statsChanged) {
            updatedPlayers[currentPlayerIndex] = player;
        }
    }

    // Update Current Player Tokens in Map
    updatedTokensMap[color] = currentTokens.map((t) => (t.sn === tokenSn ? updatedToken : t));

    // Determine if Turn is Over
    const remainingDiceCount = allAvailableDice.length - diceConsumed.length;
    const isTurnOver = remainingDiceCount === 0;

    console.log({ isTurnOver })

    return {
        ...gameState,
        players: updatedPlayers,
        tokens: updatedTokensMap,
        usedDiceValues: [...(gameState.usedDiceValues || []), ...diceConsumed],
        activeDiceConfig: null,
        status: isTurnOver ? "playingDice" : "playingToken",
        currentTurn: isTurnOver ? getNextPlayerId(gameState.players, gameState.currentTurn) : gameState.currentTurn,
        // lastMoverId: isTurnOver ? gameState.currentTurn : undefined,
    };
};
