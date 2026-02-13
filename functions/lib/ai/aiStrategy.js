"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAIPlayer = void 0;
exports.getEngineType = getEngineType;
exports.getDifficulty = getDifficulty;
exports.pickMoveStrategy = pickMoveStrategy;
const aiEngine_1 = require("./aiEngine");
const llmEngine_1 = require("./llmEngine");
var aiEngine_2 = require("./aiEngine");
Object.defineProperty(exports, "isAIPlayer", { enumerable: true, get: function () { return aiEngine_2.isAIPlayer; } });
function getEngineType() {
    const engine = (process.env.AI_ENGINE || 'rules').toLowerCase();
    if (engine === 'llm')
        return 'llm';
    return 'rules';
}
function getDifficulty() {
    const diff = (process.env.AI_DIFFICULTY || 'medium').toLowerCase();
    if (['easy', 'medium', 'hard'].includes(diff))
        return diff;
    return 'medium';
}
async function pickMoveStrategy(gameState) {
    const engine = getEngineType();
    const difficulty = getDifficulty();
    console.log(`[AI-Strategy] Using "${engine}" engine (${difficulty}) for game ${gameState.id}`);
    switch (engine) {
        case 'llm':
            return (0, llmEngine_1.llmPickMove)(gameState);
        case 'rules':
        default:
            return (0, aiEngine_1.pickMove)(gameState, difficulty);
    }
}
//# sourceMappingURL=aiStrategy.js.map