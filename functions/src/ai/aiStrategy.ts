/**
 * AI Strategy — Unified Move Selection Interface
 *
 * Switch between rule-based and LLM-powered AI engines
 * using a single configuration variable.
 *
 * Config:
 *   - AI_ENGINE: "llm" or "rules" (default)
 *   - AI_DIFFICULTY: "easy", "medium" (default), or "hard"
 */

import { LudoGameState } from './ludoLogic';
import { AIMove, AIDifficulty, pickMove as ruleBasedPickMove } from './aiEngine';
import { llmPickMove } from './llmEngine';

// Re-export for convenience
export type { AIMove } from './aiEngine';
export { isAIPlayer } from './aiEngine';

export type AIEngineType = 'rules' | 'llm';

/**
 * Get the configured AI engine type from environment.
 * Defaults to 'rules' if not set.
 */
export function getEngineType(): AIEngineType {
    const engine = (process.env.AI_ENGINE || 'rules').toLowerCase();
    if (engine === 'llm') return 'llm';
    return 'rules';
}

/**
 * Get the configured AI difficulty from environment.
 * Defaults to 'medium'.
 */
export function getDifficulty(): AIDifficulty {
    const diff = (process.env.AI_DIFFICULTY || 'hard').toLowerCase();
    if (['easy', 'medium', 'hard'].includes(diff)) return diff as AIDifficulty;
    return 'hard';
}

/**
 * Pick the best move using the configured AI engine.
 */
export async function pickMoveStrategy(gameState: LudoGameState): Promise<AIMove | null> {
    const engine = getEngineType();
    const difficulty = getDifficulty();

    console.log(`[AI-Strategy] Using "${engine}" engine (${difficulty}) for game ${gameState.id}`);

    switch (engine) {
        case 'llm':
            return llmPickMove(gameState);

        case 'rules':
        default:
            return ruleBasedPickMove(gameState, difficulty);
    }
}
