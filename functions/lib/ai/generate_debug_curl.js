"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ludoLogic_1 = require("./ludoLogic");
const llmEngine_1 = require("./llmEngine");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.join(__dirname, '../../.env') });
const apiKey = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const mockPlayer = {
    id: 'p1',
    name: 'Red AI',
    color: 'red',
    tokens: ['red'],
};
const mockState = {
    id: 'debug-game-123',
    status: ludoLogic_1.LudoStatus.PLAYING_DICE,
    currentTurn: 'p1',
    players: [mockPlayer],
    diceValue: [6],
    usedDiceValues: [],
    tokens: {
        red: [
            { sn: 1, position: -1, active: false, isSafePath: false, isFinished: false, color: 'red' },
            { sn: 2, position: 48, active: true, isSafePath: false, isFinished: false, color: 'red' },
            { sn: 3, position: -1, active: false, isSafePath: false, isFinished: false, color: 'red' },
            { sn: 4, position: -1, active: false, isSafePath: false, isFinished: false, color: 'red' },
        ],
        green: [
            { sn: 1, position: 2, active: true, isSafePath: false, isFinished: false, color: 'green' }
        ]
    },
    logs: []
};
function generateDebugCurl() {
    console.log('--- Generating Debug Curl Command ---\n');
    const legalMoves = (0, llmEngine_1.generateLegalMoves)(mockState, mockPlayer);
    const stateDesc = (0, llmEngine_1.buildGameStateDescription)(mockState, mockPlayer);
    const movesDesc = (0, llmEngine_1.buildLegalMovesDescription)(legalMoves);
    const prompt = (0, llmEngine_1.buildPrompt)(stateDesc, movesDesc, legalMoves.length);
    const safePrompt = prompt.replace(/'/g, "'\\''");
    const curlCommand = `curl "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}" \\
-H "Content-Type: application/json" \\
-X POST \\
-d '{
  "contents": [{
    "parts": [{
      "text": "${safePrompt.replace(/\n/g, '\\n')}"
    }]
  }],
  "generationConfig": {
    "temperature": 0.3,
    "maxOutputTokens": 8192,
    "responseMimeType": "application/json"
  }
}'`;
    console.log(curlCommand);
    console.log('\n--- End of Curl Command ---');
}
generateDebugCurl();
//# sourceMappingURL=generate_debug_curl.js.map