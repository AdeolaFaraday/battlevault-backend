import { pickMove } from './aiEngine';
import { LudoGameState } from './ludoLogic';

const mockState: LudoGameState = {
    id: 'test-boundary-game',
    players: [
        { id: 'ai-1', name: 'AI Player', color: 'green', tokens: ['green'] },
        { id: 'p2', name: 'Opponent Red', color: 'red', tokens: ['red'] }
    ],
    currentTurn: 'ai-1',
    diceValue: [2],
    isRolling: false,
    status: 'playingToken',
    tokens: {
        green: [
            { sn: 1, color: 'green', active: true, position: 52, isSafePath: false, isFinished: false },
            { sn: 2, color: 'green', active: true, position: 14, isSafePath: false, isFinished: false } // At gate
        ],
        red: [
            { sn: 1, color: 'red', active: false, position: 0, isSafePath: false, isFinished: false }
        ]
    },
    usedDiceValues: [],
    activeDiceConfig: null
};

console.log("--- SCENARIO: 52 -> 1 WRAP-AROUND RISK ---");
// Green #1 at 52. Moves to 2. Red start is at 2.
// If Red has tokens at home, Green should avoid pos 2.
mockState.tokens.green[0].position = 52;
mockState.tokens.red[0].active = false; // Red at home
mockState.diceValue = [2];

let move = pickMove(mockState, 'hard');
console.log(`Chosen (Hard): Token ${move?.tokenId} with reason: ${move?.reasoning}`);

console.log("\n--- SCENARIO: START EXIT BONUS ---");
// Both tokens safe from hits, but one is at start (15), other is further ahead (25).
// AI should slightly prefer moving the one at start to "clear" it.
mockState.tokens.green[0].position = 15; // Green start
mockState.tokens.green[1].position = 25;
mockState.tokens.red[0].active = true;
mockState.tokens.red[0].position = 50; // Far behind
mockState.diceValue = [4];

move = pickMove(mockState, 'hard');
console.log(`Chosen (Hard): Token ${move?.tokenId} with reason: ${move?.reasoning}`);
