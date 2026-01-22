
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

// Configure dotenv - look for .env in current or parent directory
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });
dotenv.config(); // Backup check for local functions folder .env

const MONGO_URI = process.env.MONGO_URI || '';

// Lazy initialization of MongoDB connection
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    await mongoose.connect(MONGO_URI);
    isConnected = true;
};

/**
 * Idempotent Firestore to MongoDB Sync Trigger
 * Triggers on update to any game document.
 */
export const syncGameToMongo = functions.firestore
    .document('games/{gameId}')
    .onUpdate(async (change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) => {
        const gameId = context.params.gameId;
        const newData = change.after.data() || {};
        const oldData = change.before.data() || {};

        // 1. Recursive update prevention & Minimal change check
        // Ignore the sync timestamp when comparing for changes
        const { lastSyncedToMongo: _, ...actualNew } = newData;
        const { lastSyncedToMongo: __, ...actualOld } = oldData;

        if (JSON.stringify(actualNew) === JSON.stringify(actualOld)) {
            console.log(`No functional data change for game ${gameId}, skipping sync.`);
            return null;
        }

        // 2. CRITICAL STATE CHECK
        // Only sync if Game Start (WAITING -> PLAYING_DICE) or Game End (-> FINISHED)
        const oldStatus = oldData.status;
        const newStatus = newData.status;

        const isGameStart = oldStatus === 'waiting' && newStatus === 'playingDice';
        // Check if we are transitioning INTO finished state (or already in it and updating, though typically it happens once)
        const isGameEnd = newStatus === 'finished';

        if (!isGameStart && !isGameEnd) {
            console.log(`Skipping Mongo sync for game ${gameId}: Status transition '${oldStatus}' -> '${newStatus}' is not critical.`);
            return null;
        }

        try {
            await connectDB();

            // 2. Data Cleaning & Mapping
            // Remove fields that can break Mongoose or are Firestore-specific
            const {
                createdAt,
                updatedAt,
                id: _,
                ...sanitizedData
            } = newData as any;

            // Map Firestore Timestamps to JS Dates for MongoDB
            const mappedData = {
                ...sanitizedData,
                startDate: newData.startDate ? new Date(newData.startDate) : undefined,
                updatedAt: new Date(), // Local sync time
            };

            // 3. Idempotent Update in MongoDB
            // We use findOneAndUpdate with upsert: true to handle both new and existing records
            // In a real tournament, the game record usually exists in Mongo first.

            // Note: We need the Game model. Since we are in a separate package, 
            // we'll use mongoose.connection.model if it exists, or define a minimal schema.
            const gameSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
            const Game = mongoose.models.Game || mongoose.model('Game', gameSchema);

            await Game.findByIdAndUpdate(
                gameId,
                { $set: mappedData },
                { upsert: true, new: true }
            );

            console.log(`Successfully synced game ${gameId} to MongoDB.`);

            // 4. Update Firestore to mark as synced (Optional, helps with idempotency)
            return change.after.ref.update({
                lastSyncedToMongo: admin.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            console.error(`Sync error for game ${gameId}:`, error);
            return null;
        }
    });
