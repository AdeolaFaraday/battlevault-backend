
import { admin } from '../auth';
import { RealtimeProvider, GameStateUpdate } from './RealtimeProvider';

/**
 * Firebase Firestore implementation of the RealtimeProvider
 */
export class FirebaseRealtimeProvider implements RealtimeProvider {
    private db: admin.firestore.Firestore;
    private gamesCollection = 'games';

    constructor() {
        // Use the existing Firebase Admin instance
        this.db = admin.firestore();
    }

    async initialize(): Promise<void> {
        // Firebase is already initialized in services/auth/index.ts
        console.log('Firebase Realtime Provider initialized');
    }

    async createGameDocument(gameId: string, initialState: any): Promise<void> {
        try {
            const gameRef = this.db.collection(this.gamesCollection).doc(gameId);

            await gameRef.set({
                ...initialState,
                players: initialState.players?.map((p: any) => {
                    return {
                        id: p.id,
                        name: p.name,
                        color: p.color,
                        tokens: p.tokens
                    }
                }),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`Game document created: ${gameId}`);
        } catch (error) {
            console.error('Error creating game document:', error);
            throw error;
        }
    }

    async updateGameState(gameId: string, updates: GameStateUpdate): Promise<void> {
        try {
            const gameRef = this.db.collection(this.gamesCollection).doc(gameId);

            // Remove gameId from updates if present
            const { gameId: _, ...updateData } = updates;

            await gameRef.update({
                ...updateData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`Game state updated: ${gameId}`);
        } catch (error) {
            console.error('Error updating game state:', error);
            throw error;
        }
    }

    async getGameState(gameId: string): Promise<any> {
        try {
            const gameRef = this.db.collection(this.gamesCollection).doc(gameId);
            const doc = await gameRef.get();

            if (!doc.exists) {
                throw new Error(`Game not found: ${gameId}`);
            }

            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('Error getting game state:', error);
            throw error;
        }
    }

    async deleteGameDocument(gameId: string): Promise<void> {
        try {
            const gameRef = this.db.collection(this.gamesCollection).doc(gameId);
            await gameRef.delete();

            console.log(`Game document deleted: ${gameId}`);
        } catch (error) {
            console.error('Error deleting game document:', error);
            throw error;
        }
    }

    async addPlayerToGame(gameId: string, player: any): Promise<void> {
        try {
            const gameRef = this.db.collection(this.gamesCollection).doc(gameId);

            await gameRef.update({
                players: admin.firestore.FieldValue.arrayUnion(player),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`Player added to game: ${gameId}`);
        } catch (error) {
            console.error('Error adding player to game:', error);
            throw error;
        }
    }
}
