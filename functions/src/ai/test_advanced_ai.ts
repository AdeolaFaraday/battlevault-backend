import { pickMove } from './aiEngine';
import { LudoGameState } from './ludoLogic';

const mockState: LudoGameState = {
    id: 'test-advanced-game',
    players: [
        { id: 'ai-1', name: 'AI Player', color: 'green', tokens: ['green'] },
        { id: 'p2', name: 'Human', color: 'red', tokens: ['red'] }
    ],
    currentTurn: 'ai-1',
    diceValue: [2],
    isRolling: false,
    status: 'playingToken',
    tokens: {
        green: [
            { sn: 1, color: 'green', active: true, position: 20, isSafePath: false, isFinished: false },
            { sn: 2, color: 'green', active: true, position: 30, isSafePath: false, isFinished: false }
        ],
        red: [
            { sn: 1, color: 'red', active: true, position: 22, isSafePath: false, isFinished: false }
        ]
    },
    usedDiceValues: [],
    activeDiceConfig: null
};

console.log("--- SCENARIO 1: KILL-PROMOTION PRIORITY ---");
// Green #1 at 20. Dice 2. Opponent at 22. Capture!
mockState.diceValue = [2];
let move = pickMove(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);

console.log("\n--- SCENARIO 2: PAIRING/BLOCKADE ---");
// Green #1 at 20. Green #2 at 22. Dice 2.
// Moving #1 to 22 creates a pair.
mockState.tokens.red[0].position = 40; // No capture available
mockState.tokens.green[1].position = 22;
mockState.diceValue = [2];
move = pickMove(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);

console.log("\n--- SCENARIO 3: CHASING ---");
// Green #1 at 20. Opponent at 24. Dice 2.
// Moving #1 to 22 puts it exactly 2 steps behind opponent (chasing).
mockState.tokens.red[0].position = 24;
mockState.tokens.green[1].position = 45; // Far away
mockState.diceValue = [2];
move = pickMove(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);

console.log("\n--- SCENARIO 4: DEFENSIVE GATE ENTRY ---");
// Green #1 at 12. Gate is 14. Dice 2.
// Opponent at 10 (2 steps behind). AI should feel urgent to enter.
mockState.tokens.green[0].position = 12; // 2 steps to gate
mockState.tokens.red[0].position = 10; // 2 steps behind current
mockState.diceValue = [2];
move = pickMove(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);
