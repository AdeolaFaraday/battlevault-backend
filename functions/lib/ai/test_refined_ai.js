"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aiEngine_1 = require("./aiEngine");
const mockState = {
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
            { sn: 2, color: 'green', active: true, position: 14, isSafePath: false, isFinished: false }
        ],
        red: [
            { sn: 1, color: 'red', active: false, position: 0, isSafePath: false, isFinished: false }
        ]
    },
    usedDiceValues: [],
    activeDiceConfig: null
};
console.log("--- SCENARIO: 52 -> 1 WRAP-AROUND RISK ---");
mockState.tokens.green[0].position = 52;
mockState.tokens.red[0].active = false;
mockState.diceValue = [2];
let move = (0, aiEngine_1.pickMove)(mockState, 'hard');
console.log(`Chosen (Hard): Token ${move?.tokenId} with reason: ${move?.reasoning}`);
console.log("\n--- SCENARIO: START EXIT BONUS ---");
mockState.tokens.green[0].position = 15;
mockState.tokens.green[1].position = 25;
mockState.tokens.red[0].active = true;
mockState.tokens.red[0].position = 50;
mockState.diceValue = [4];
move = (0, aiEngine_1.pickMove)(mockState, 'hard');
console.log(`Chosen (Hard): Token ${move?.tokenId} with reason: ${move?.reasoning}`);
//# sourceMappingURL=test_refined_ai.js.map