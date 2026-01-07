/**
 * Abstraction layer for real-time game state management
 * Allows switching between different providers (Firebase, Socket.IO, etc.)
 */

export interface GameStateUpdate {
    gameId: string;
    players?: any[];
    currentTurn?: string;
    diceValue?: number[];
    isRolling?: boolean;
    status?: string;
    [key: string]: any;
}

export interface RealtimeProvider {
    /**
     * Initialize the realtime provider
     */
    initialize(): Promise<void>;

    /**
     * Create a new game document in the realtime store
     */
    createGameDocument(gameId: string, initialState: any): Promise<void>;

    /**
     * Update game state
     */
    updateGameState(gameId: string, updates: GameStateUpdate): Promise<void>;

    /**
     * Get current game state
     */
    getGameState(gameId: string): Promise<any>;

    /**
     * Delete a game document
     */
    deleteGameDocument(gameId: string): Promise<void>;

    /**
     * Add a player to a game
     */
    addPlayerToGame(gameId: string, player: any): Promise<void>;
}
