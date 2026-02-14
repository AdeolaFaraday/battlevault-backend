"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aiEngine_1 = require("./aiEngine");
const mockState = {
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
            { sn: 2, color: 'green', active: true, position: 19, isSafePath: false, isFinished: false }
        ],
        red: [
            { sn: 1, color: 'red', active: true, position: 15, isSafePath: false, isFinished: false }
        ]
    },
    usedDiceValues: [],
    activeDiceConfig: null
};
console.log("--- SCENARIO 1: CLUSTERING PENALTY (HARD) ---");
mockState.diceValue = [2];
let move = (0, aiEngine_1.pickMove)(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);
console.log("\n--- SCENARIO 2: ESCAPE PRIORITY (HARD) ---");
mockState.tokens.green[0].position = 20;
mockState.tokens.green[1].position = 40;
mockState.tokens.red[0].position = 18;
mockState.diceValue = [2];
for (const color of ['green']) {
    const tokens = mockState.tokens[color];
    for (const t of tokens) {
        console.log(`Trace for #${t.sn} at ${t.position}...`);
    }
}
move = (0, aiEngine_1.pickMove)(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);
//# sourceMappingURL=test_danger_awareness.js.map