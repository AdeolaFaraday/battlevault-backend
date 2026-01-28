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
console.log('MONGO_URI', MONGO_URI);
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
        console.log(`Successfully synced game ${gameId} to MongoDB.`);
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