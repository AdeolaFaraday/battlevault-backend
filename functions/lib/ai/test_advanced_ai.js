"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aiEngine_1 = require("./aiEngine");
const mockState = {
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
mockState.diceValue = [2];
let move = (0, aiEngine_1.pickMove)(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);
console.log("\n--- SCENARIO 2: PAIRING/BLOCKADE ---");
mockState.tokens.red[0].position = 40;
mockState.tokens.green[1].position = 22;
mockState.diceValue = [2];
move = (0, aiEngine_1.pickMove)(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);
console.log("\n--- SCENARIO 3: CHASING ---");
mockState.tokens.red[0].position = 24;
mockState.tokens.green[1].position = 45;
mockState.diceValue = [2];
move = (0, aiEngine_1.pickMove)(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);
console.log("\n--- SCENARIO 4: DEFENSIVE GATE ENTRY ---");
mockState.tokens.green[0].position = 12;
mockState.tokens.red[0].position = 10;
mockState.diceValue = [2];
move = (0, aiEngine_1.pickMove)(mockState, 'hard');
console.log(`Chosen: Token ${move?.tokenId} (${move?.reasoning})`);
//# sourceMappingURL=test_advanced_ai.js.map