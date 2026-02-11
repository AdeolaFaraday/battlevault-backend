"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAIPlayer = void 0;
exports.getEngineType = getEngineType;
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
async function pickMoveStrategy(gameState) {
    const engine = getEngineType();
    console.log(`[AI-Strategy] Using "${engine}" engine for game ${gameState.id}`);
    switch (engine) {
        case 'llm':
            return (0, llmEngine_1.llmPickMove)(gameState);
        case 'rules':
        default:
            return (0, aiEngine_1.pickMove)(gameState);
    }
}
//# sourceMappingURL=aiStrategy.js.map