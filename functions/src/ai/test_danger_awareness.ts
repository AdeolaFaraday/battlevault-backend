import { pickMove } from './aiEngine';
import { LudoGameState } from './ludoLogic';

const mockState: LudoGameState = {
    id: 'test-danger-game',
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
            { sn: 2, color: 'green', active: true, position: 19, isSafePath: false, isFinished: false } // Bunched up
        ],
        red: [
            { sn: 1, color: 'red', active: true, position: 15, isSafePath: false, isFinished: false } // 4-5 steps behind the cluster
        ]
    },
    usedDiceValues: [],
    activeDiceConfig: null
};

console.log("--- SCENARIO 1: CLUSTERING PENALTY (HARD) ---");
// Green #2 is at 19, Green #1 is at 20. Opponent is at 15.
// Moving #2 to 21 means it's still clustering with #1 (who is at 20).
// AI should slightly prefer moving #1 to spread out OR move #2 to get away if it's the back one.
// Actually, moving #1 to 22 spreads the distance to #2 (at 19).
mockState.diceValue = [2];
let move = pickMove(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);

console.log("\n--- SCENARIO 2: ESCAPE PRIORITY (HARD) ---");
// Green #1 at 20. Opponent at 18 (2 steps behind).
// Green #2 at 40. Opponent nowhere near.
// Dice 2. AI should definitely move #1 to escape or at least move away from the current risk.
mockState.tokens.green[0].position = 20;
mockState.tokens.green[1].position = 40;
mockState.tokens.red[0].position = 18; // Hits 20
mockState.diceValue = [2];

// Debugging: trace both options
for (const color of ['green']) {
    const tokens = mockState.tokens[color];
    for (const t of tokens) {
        // Calculation logic inside but just simulating here
        console.log(`Trace for #${t.sn} at ${t.position}...`);
    }
}

move = pickMove(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);
