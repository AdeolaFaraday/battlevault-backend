/**
 * AI Strategy — Unified Move Selection Interface
 *
 * Switch between rule-based and LLM-powered AI engines
 * using a single configuration variable.
 *
 * Config: Set `AI_ENGINE` environment variable
 *   - "llm"   → Use Gemini LLM (requires GEMINI_API_KEY)
 *   - "rules"  → Use rule-based priority engine (default)
 */

import { LudoGameState } from './ludoLogic';
import { AIMove, pickMove as ruleBasedPickMove } from './aiEngine';
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
 * Pick the best move using the configured AI engine.
 *
 * - "rules" → Synchronous, deterministic priority scoring
 * - "llm"   → Async Gemini API call with rule-based fallback
 */
export async function pickMoveStrategy(gameState: LudoGameState): Promise<AIMove | null> {
    const engine = getEngineType();

    console.log(`[AI-Strategy] Using "${engine}" engine for game ${gameState.id}`);

    switch (engine) {
        case 'llm':
            return llmPickMove(gameState);

        case 'rules':
        default:
            return ruleBasedPickMove(gameState);
    }
}
