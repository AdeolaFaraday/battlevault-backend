
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { isFinalGame } from './helpers/isFinalGame';
import { awardTournamentPrize } from './helpers/awardTournamentPrize';

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

            console.log(`Successfully synced game ${gameId} to MongoDB.`, { gameId, newData: newData?.players, isGameStart, isGameEnd });

            // 5. Update user stats and streaks if game finished
            if (isGameEnd && newData.players) {
                const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
                const User = mongoose.models.User || mongoose.model('User', userSchema);

                const winnerId = newData.winner;

                // --- TOURNAMENT PROGRESSION LOGIC ---
                if (newData.type === 'TOURNAMENT' && newData.nextGameId && newData.nextGameSlot !== undefined) {
                    try {
                        console.log(`Processing Tournament Progression for Game ${gameId} -> Next Game ${newData.nextGameId}`);

                        // Fetch winner details
                        const winnerPlayer = newData.players.find((p: any) => p.id === winnerId);
                        if (!winnerPlayer) {
                            throw new Error(`Winner player ${winnerId} not found in game ${gameId}`);
                        }

                        const slot = Number(newData.nextGameSlot);
                        const colorPairs = [
                            { color: 'red', tokens: ['red', 'green'] },
                            { color: 'blue', tokens: ['blue', 'yellow'] }
                        ];
                        const assignedPair = colorPairs[slot] || colorPairs[0];

                        const winnerData = {
                            id: winnerId,
                            name: winnerPlayer.name,
                            color: assignedPair.color,
                            tokens: assignedPair.tokens,
                            slot: slot
                        };

                        // 1. Update MongoDB for Next Game
                        const nextMongoGame = await Game.findById(newData.nextGameId);
                        if (nextMongoGame) {
                            const players = (nextMongoGame as any).players || [];
                            while (players.length <= slot) {
                                players.push({ slot: players.length });
                            }
                            players[slot] = winnerData;

                            const mongoUpdates: any = { players };
                            const activePlayers = players.filter((p: any) => p.id);
                            if (activePlayers.length === 2 && (nextMongoGame as any).status === 'waiting') {
                                mongoUpdates.status = 'playingDice';
                                mongoUpdates.currentTurn = activePlayers[0].id;
                            }

                            await Game.findByIdAndUpdate(newData.nextGameId, { $set: mongoUpdates });
                            console.log(`Updated MongoDB for next game ${newData.nextGameId}`);
                        } else {
                            console.warn(`Next game ${newData.nextGameId} not found in MongoDB for progression.`);
                        }

                        // 2. Update Firestore for Next Game (if exists)
                        const db = admin.firestore();
                        const nextGameRef = db.collection('games').doc(newData.nextGameId);

                        await db.runTransaction(async (t) => {
                            const nextGameDoc = await t.get(nextGameRef);
                            if (!nextGameDoc.exists) {
                                console.log(`Next game ${newData.nextGameId} not in Firestore yet. Skipping Firestore update.`);
                                return;
                            }

                            const nextGameData = nextGameDoc.data() || {};
                            const players = nextGameData.players || [];

                            while (players.length <= slot) {
                                players.push({ slot: players.length });
                            }
                            players[slot] = winnerData;

                            const updates: any = {
                                players: players,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            };

                            const activePlayers = players.filter((p: any) => p.id);
                            if (activePlayers.length === 2 && nextGameData.status === 'waiting') {
                                updates.status = 'playingDice';
                                updates.currentTurn = activePlayers[0].id;
                            }

                            t.update(nextGameRef, updates);
                        });
                        console.log(`Successfully advanced winner ${winnerId} to next game ${newData.nextGameId} slot ${newData.nextGameSlot}`);
                    } catch (progressionError) {
                        console.error(`Error processing tournament progression for game ${gameId}:`, progressionError);
                    }
                }
                // --- END TOURNAMENT PROGRESSION LOGIC ---

                // --- TOURNAMENT FINAL PRIZE LOGIC ---
                // If it's a TOURNAMENT game and finished, check if it's the final
                if (newData.type === 'TOURNAMENT') {
                    try {
                        // Check if this game is a final
                        // We pass the full game data object which has stageId, nextGameId, etc.
                        const isFinal = await isFinalGame({ ...newData, id: gameId });

                        console.log({ isFinal })

                        if (isFinal) {
                            console.log(`Game ${gameId} identified as TOURNAMENT FINAL. Processing prize...`);
                            if (newData.tournamentId && winnerId) {
                                await awardTournamentPrize(winnerId, newData.tournamentId);
                            } else {
                                console.warn(`Cannot award prize: Missing tournamentId (${newData.tournamentId}) or winnerId (${winnerId})`);
                            }
                        }
                    } catch (prizeError) {
                        console.error(`Error processing tournament prize for game ${gameId}:`, prizeError);
                    }
                }
                // --- END TOURNAMENT FINAL PRIZE LOGIC ---

                // --- TOURNAMENT STAGE COMPLETION LOGIC ---
                if (newData.type === 'TOURNAMENT' && newData.stageId) {
                    try {
                        console.log(`Checking Stage Completion for Stage ${newData.stageId}`);
                        const stageSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
                        const TournamentStage = mongoose.models.TournamentStage || mongoose.model('TournamentStage', stageSchema);
                        const tournamentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
                        const Tournament = mongoose.models.Tournament || mongoose.model('Tournament', tournamentSchema);

                        const stageId = newData.stageId;
                        const stage = await TournamentStage.findById(stageId);

                        if (stage && stage.status !== 'COMPLETED') {
                            const gamesInStage = await Game.find({ stageId: stageId });
                            const allFinished = gamesInStage.every((g: any) => g.status === 'finished');

                            if (allFinished) {
                                await TournamentStage.findByIdAndUpdate(stageId, { status: 'COMPLETED' });
                                console.log(`Stage ${stageId} marked as COMPLETED`);

                                const nextStage = await TournamentStage.findOne({
                                    tournamentId: stage.tournamentId,
                                    index: (stage as any).index + 1
                                });

                                if (nextStage) {
                                    await TournamentStage.findByIdAndUpdate(nextStage._id, { status: 'ACTIVE' });
                                    await Tournament.findByIdAndUpdate(stage.tournamentId, { currentStage: nextStage._id });
                                    console.log(`Next stage ${nextStage._id} marked as ACTIVE`);
                                } else {
                                    await Tournament.findByIdAndUpdate(stage.tournamentId, { status: 'COMPLETED' });
                                    console.log(`Tournament ${stage.tournamentId} marked as COMPLETED`);
                                }
                            }
                        }
                    } catch (stageError) {
                        console.error(`Error processing stage completion for game ${gameId}:`, stageError);
                    }
                }
                // --- END TOURNAMENT STAGE COMPLETION LOGIC ---

                const playerIds = newData.players
                    .map((p: any) => p.id)

                for (const odooUserId of playerIds) {
                    console.log(`Processing user ${odooUserId} for game ${gameId}`);
                    try {
                        const user = await User.findById(odooUserId);
                        if (!user) {
                            console.log(`User ${odooUserId} not found, skipping stats update.`);
                            continue;
                        }

                        const isWinner = odooUserId === winnerId;
                        const currentStreak = (user as any).currentStreak || 0;
                        const bestStreak = (user as any).bestStreak || 0;

                        if (isWinner) {
                            // Winner: increment wins, games played, current streak, update best streak if needed
                            const newCurrentStreak = currentStreak + 1;
                            const newBestStreak = Math.max(bestStreak, newCurrentStreak);
                            await User.findByIdAndUpdate(odooUserId, {
                                $inc: {
                                    totalGamesPlayed: 1,
                                    totalWins: 1,
                                },
                                $set: {
                                    currentStreak: newCurrentStreak,
                                    bestStreak: newBestStreak,
                                }
                            });
                            console.log(`Updated stats for winner ${odooUserId}: wins+1, gamesPlayed+1, streak=${newCurrentStreak}, best=${newBestStreak}`);
                        } else {
                            // Loser: increment losses, games played, reset current streak to 0
                            await User.findByIdAndUpdate(odooUserId, {
                                $inc: {
                                    totalGamesPlayed: 1,
                                    totalLosses: 1,
                                },
                                $set: { currentStreak: 0 }
                            });
                            console.log(`Updated stats for loser ${odooUserId}: losses+1, gamesPlayed+1, streak=0`);
                        }
                    } catch (userError) {
                        console.error(`Error updating stats for user ${odooUserId}:`, userError);
                    }
                }
            }

            // 4. Update Firestore to mark as synced (Optional, helps with idempotency)
            return change.after.ref.update({
                lastSyncedToMongo: admin.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            console.error(`Sync error for game ${gameId}:`, error);
            return null;
        }
    });
