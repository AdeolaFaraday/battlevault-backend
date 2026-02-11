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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncGameToMongo = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
const isFinalGame_1 = require("./helpers/isFinalGame");
const awardTournamentPrize_1 = require("./helpers/awardTournamentPrize");
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || '';
let isConnected = false;
const connectDB = async () => {
    if (isConnected)
        return;
    await mongoose_1.default.connect(MONGO_URI);
    isConnected = true;
};
exports.syncGameToMongo = functions.firestore
    .document('games/{gameId}')
    .onUpdate(async (change, context) => {
    const gameId = context.params.gameId;
    const newData = change.after.data() || {};
    const oldData = change.before.data() || {};
    const { lastSyncedToMongo: _, ...actualNew } = newData;
    const { lastSyncedToMongo: __, ...actualOld } = oldData;
    if (JSON.stringify(actualNew) === JSON.stringify(actualOld)) {
        console.log(`No functional data change for game ${gameId}, skipping sync.`);
        return null;
    }
    const oldStatus = oldData.status;
    const newStatus = newData.status;
    const isGameStart = oldStatus === 'waiting' && newStatus === 'playingDice';
    const isGameEnd = newStatus === 'finished';
    if (!isGameStart && !isGameEnd) {
        console.log(`Skipping Mongo sync for game ${gameId}: Status transition '${oldStatus}' -> '${newStatus}' is not critical.`);
        return null;
    }
    try {
        await connectDB();
        const { createdAt, updatedAt, id: _, ...sanitizedData } = newData;
        const mappedData = {
            ...sanitizedData,
            startDate: newData.startDate ? new Date(newData.startDate) : undefined,
            updatedAt: new Date(),
        };
        const gameSchema = new mongoose_1.default.Schema({}, { strict: false, timestamps: true });
        const Game = mongoose_1.default.models.Game || mongoose_1.default.model('Game', gameSchema);
        await Game.findByIdAndUpdate(gameId, { $set: mappedData }, { upsert: true, new: true });
        console.log(`Successfully synced game ${gameId} to MongoDB.`, { gameId, newData: newData?.players, isGameStart, isGameEnd });
        if (isGameEnd && newData.players) {
            const userSchema = new mongoose_1.default.Schema({}, { strict: false, timestamps: true });
            const User = mongoose_1.default.models.User || mongoose_1.default.model('User', userSchema);
            const winnerId = newData.winner;
            if (newData.type === 'TOURNAMENT' && newData.nextGameId && newData.nextGameSlot !== undefined) {
                try {
                    console.log(`Processing Tournament Progression for Game ${gameId} -> Next Game ${newData.nextGameId}`);
                    const winnerPlayer = newData.players.find((p) => p.id === winnerId);
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
                    const nextMongoGame = await Game.findById(newData.nextGameId);
                    if (nextMongoGame) {
                        const players = nextMongoGame.players || [];
                        while (players.length <= slot) {
                            players.push({ slot: players.length });
                        }
                        players[slot] = winnerData;
                        const mongoUpdates = { players };
                        const activePlayers = players.filter((p) => p.id);
                        if (activePlayers.length === 2 && nextMongoGame.status === 'waiting') {
                            mongoUpdates.status = 'playingDice';
                            mongoUpdates.currentTurn = activePlayers[0].id;
                        }
                        await Game.findByIdAndUpdate(newData.nextGameId, { $set: mongoUpdates });
                        console.log(`Updated MongoDB for next game ${newData.nextGameId}`);
                    }
                    else {
                        console.warn(`Next game ${newData.nextGameId} not found in MongoDB for progression.`);
                    }
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
                        const updates = {
                            players: players,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        };
                        const activePlayers = players.filter((p) => p.id);
                        if (activePlayers.length === 2 && nextGameData.status === 'waiting') {
                            updates.status = 'playingDice';
                            updates.currentTurn = activePlayers[0].id;
                        }
                        t.update(nextGameRef, updates);
                    });
                    console.log(`Successfully advanced winner ${winnerId} to next game ${newData.nextGameId} slot ${newData.nextGameSlot}`);
                }
                catch (progressionError) {
                    console.error(`Error processing tournament progression for game ${gameId}:`, progressionError);
                }
            }
            if (newData.type === 'TOURNAMENT') {
                try {
                    const isFinal = await (0, isFinalGame_1.isFinalGame)({ ...newData, id: gameId });
                    console.log({ isFinal });
                    if (isFinal) {
                        console.log(`Game ${gameId} identified as TOURNAMENT FINAL. Processing prize...`);
                        if (newData.tournamentId && winnerId) {
                            await (0, awardTournamentPrize_1.awardTournamentPrize)(winnerId, newData.tournamentId);
                        }
                        else {
                            console.warn(`Cannot award prize: Missing tournamentId (${newData.tournamentId}) or winnerId (${winnerId})`);
                        }
                    }
                }
                catch (prizeError) {
                    console.error(`Error processing tournament prize for game ${gameId}:`, prizeError);
                }
            }
            if (newData.type === 'TOURNAMENT' && newData.stageId) {
                try {
                    console.log(`Checking Stage Completion for Stage ${newData.stageId}`);
                    const stageSchema = new mongoose_1.default.Schema({}, { strict: false, timestamps: true });
                    const TournamentStage = mongoose_1.default.models.TournamentStage || mongoose_1.default.model('TournamentStage', stageSchema);
                    const tournamentSchema = new mongoose_1.default.Schema({}, { strict: false, timestamps: true });
                    const Tournament = mongoose_1.default.models.Tournament || mongoose_1.default.model('Tournament', tournamentSchema);
                    const stageId = newData.stageId;
                    const stage = await TournamentStage.findById(stageId);
                    if (stage && stage.status !== 'COMPLETED') {
                        const gamesInStage = await Game.find({ stageId: stageId });
                        const allFinished = gamesInStage.every((g) => g.status === 'finished');
                        if (allFinished) {
                            await TournamentStage.findByIdAndUpdate(stageId, { status: 'COMPLETED' });
                            console.log(`Stage ${stageId} marked as COMPLETED`);
                            const nextStage = await TournamentStage.findOne({
                                tournamentId: stage.tournamentId,
                                index: stage.index + 1
                            });
                            if (nextStage) {
                                await TournamentStage.findByIdAndUpdate(nextStage._id, { status: 'ACTIVE' });
                                await Tournament.findByIdAndUpdate(stage.tournamentId, { currentStage: nextStage._id });
                                console.log(`Next stage ${nextStage._id} marked as ACTIVE`);
                            }
                            else {
                                await Tournament.findByIdAndUpdate(stage.tournamentId, { status: 'COMPLETED' });
                                console.log(`Tournament ${stage.tournamentId} marked as COMPLETED`);
                            }
                        }
                    }
                }
                catch (stageError) {
                    console.error(`Error processing stage completion for game ${gameId}:`, stageError);
                }
            }
            const playerIds = newData.players
                .map((p) => p.id);
            for (const odooUserId of playerIds) {
                console.log(`Processing user ${odooUserId} for game ${gameId}`);
                try {
                    const user = await User.findById(odooUserId);
                    if (!user) {
                        console.log(`User ${odooUserId} not found, skipping stats update.`);
                        continue;
                    }
                    const isWinner = odooUserId === winnerId;
                    const currentStreak = user.currentStreak || 0;
                    const bestStreak = user.bestStreak || 0;
                    if (isWinner) {
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
                    }
                    else {
                        await User.findByIdAndUpdate(odooUserId, {
                            $inc: {
                                totalGamesPlayed: 1,
                                totalLosses: 1,
                            },
                            $set: { currentStreak: 0 }
                        });
                        console.log(`Updated stats for loser ${odooUserId}: losses+1, gamesPlayed+1, streak=0`);
                    }
                }
                catch (userError) {
                    console.error(`Error updating stats for user ${odooUserId}:`, userError);
                }
            }
        }
        return change.after.ref.update({
            lastSyncedToMongo: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    catch (error) {
        console.error(`Sync error for game ${gameId}:`, error);
        return null;
    }
});
//# sourceMappingURL=syncGameToMongo.js.map