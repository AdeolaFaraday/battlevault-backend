import {
    LudoGameState,
    LudoPlayer,
    LudoStatus
} from './ludoLogic';
import {
    buildGameStateDescription,
    buildLegalMovesDescription,
    buildPrompt,
    generateLegalMoves
} from './llmEngine';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables for the API key
dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// MOCK GAME STATE
// Scenario:
// - Red player needs to move.
// - Red has one token at home (inactive), one on the board nearing home.
// - Dice shows a 6 (can activate or move).
const mockPlayer: LudoPlayer = {
    id: 'p1',
    name: 'Red AI',
    color: 'red', // assuming single color for simplicity, or token mapping handles it
    tokens: ['red'],
};

const mockState: LudoGameState = {
    id: 'debug-game-123',
    status: LudoStatus.PLAYING_DICE,
    currentTurn: 'p1',
    players: [mockPlayer],
    diceValue: [6],
    usedDiceValues: [],
    tokens: {
        red: [
            { sn: 1, position: -1, active: false, isSafePath: false, isFinished: false, color: 'red' }, // At home
            { sn: 2, position: 48, active: true, isSafePath: false, isFinished: false, color: 'red' },  // Near home
            { sn: 3, position: -1, active: false, isSafePath: false, isFinished: false, color: 'red' },
            { sn: 4, position: -1, active: false, isSafePath: false, isFinished: false, color: 'red' },
        ],
        green: [
            { sn: 1, position: 2, active: true, isSafePath: false, isFinished: false, color: 'green' } // Potential victim at red start?
        ]
    },
    // Adding required properties for a complete mock (even if empty)
    // @ts-ignore - simplistic mock
    logs: []
};

function generateDebugCurl() {
    console.log('--- Generating Debug Curl Command ---\n');

    // 1. Generate Legal Moves
    const legalMoves = generateLegalMoves(mockState, mockPlayer);

    // 2. Build Descriptions
    const stateDesc = buildGameStateDescription(mockState, mockPlayer);
    const movesDesc = buildLegalMovesDescription(legalMoves);

    // 3. Build Prompt
    const prompt = buildPrompt(stateDesc, movesDesc, legalMoves.length);

    // 4. Construct Curl
    // Escape single quotes for shell safety
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
