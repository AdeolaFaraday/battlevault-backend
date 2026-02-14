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
exports.dailyBlitzWinTracker = void 0;
const functions = __importStar(require("firebase-functions"));
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
const WIN_1_REWARD = 100;
const WIN_3_REWARD = 300;
exports.dailyBlitzWinTracker = functions.firestore
    .document('games/{gameId}')
    .onUpdate(async (change, context) => {
    const gameId = context.params.gameId;
    const newData = change.after.data() || {};
    const oldData = change.before.data() || {};
    if (oldData.status === 'finished' || newData.status !== 'finished') {
        return null;
    }
    const winnerId = newData.winner;
    if (!winnerId) {
        console.log(`Game ${gameId} finished but no winner found.`);
        return null;
    }
    console.log(`Processing Daily Blitz Win for User ${winnerId} in Game ${gameId}`);
    try {
        await connectDB();
        const today = new Date().toISOString().split('T')[0];
        const dailyBlitzSchema = new mongoose_1.default.Schema({
            userId: { type: mongoose_1.default.Schema.Types.ObjectId, required: true, index: true },
            date: { type: String, required: true },
            loginRewardClaimed: { type: Boolean, default: false },
            winsToday: { type: Number, default: 0 },
            win1RewardClaimed: { type: Boolean, default: false },
            win3RewardClaimed: { type: Boolean, default: false }
        }, { timestamps: true });
        dailyBlitzSchema.index({ userId: 1, date: 1 }, { unique: true });
        const DailyBlitz = mongoose_1.default.models.DailyBlitz || mongoose_1.default.model('DailyBlitz', dailyBlitzSchema);
        const walletSchema = new mongoose_1.default.Schema({
            userId: { type: mongoose_1.default.Schema.Types.ObjectId, required: true, unique: true },
            rewards: { type: Number, default: 0 },
            withdrawable: { type: Number, default: 0 },
        }, { strict: false });
        const Wallet = mongoose_1.default.models.Wallet || mongoose_1.default.model('Wallet', walletSchema);
        const transactionSchema = new mongoose_1.default.Schema({
            userId: { type: mongoose_1.default.Schema.Types.ObjectId, required: true },
            type: { type: String, required: true },
            amount: { type: Number, required: true },
            reference: { type: String },
            description: { type: String },
            previousBalance: { type: Number },
            newBalance: { type: Number },
            status: { type: String },
            metadata: { type: mongoose_1.default.Schema.Types.Mixed }
        }, { timestamps: true });
        const Transaction = mongoose_1.default.models.Transaction || mongoose_1.default.model('Transaction', transactionSchema);
        let dailyBlitz = await DailyBlitz.findOne({ userId: winnerId, date: today });
        if (!dailyBlitz) {
            dailyBlitz = new DailyBlitz({
                userId: winnerId,
                date: today,
                winsToday: 0
            });
        }
        dailyBlitz.winsToday += 1;
        console.log(`User ${winnerId} now has ${dailyBlitz.winsToday} wins today.`);
        let rewardAmount = 0;
        let rewardType = '';
        if (dailyBlitz.winsToday >= 1 && !dailyBlitz.win1RewardClaimed) {
            rewardAmount += WIN_1_REWARD;
            dailyBlitz.win1RewardClaimed = true;
            rewardType = 'DAILY_BLITZ_WIN_1';
            console.log(`User ${winnerId} qualified for Win 1 Reward.`);
        }
        if (dailyBlitz.winsToday >= 3 && !dailyBlitz.win3RewardClaimed) {
            rewardAmount += WIN_3_REWARD;
            dailyBlitz.win3RewardClaimed = true;
            rewardType = rewardType ? 'DAILY_BLITZ_WIN_1_AND_3' : 'DAILY_BLITZ_WIN_3';
            console.log(`User ${winnerId} qualified for Win 3 Reward.`);
        }
        await dailyBlitz.save();
        if (rewardAmount > 0) {
            const wallet = await Wallet.findOne({ userId: winnerId });
            if (wallet) {
                const previousRewards = wallet.rewards || 0;
                wallet.rewards = previousRewards + rewardAmount;
                await wallet.save();
                const newTransaction = new Transaction({
                    userId: winnerId,
                    type: 'DEPOSIT',
                    amount: rewardAmount,
                    reference: `${rewardType}_${today}_${winnerId}`,
                    description: `Daily Blitz Reward - ${rewardType}`,
                    previousBalance: previousRewards,
                    newBalance: wallet.rewards,
                    status: 'SUCCESS',
                    metadata: {
                        type: rewardType,
                        date: today,
                        gameId: gameId
                    }
                });
                await newTransaction.save();
                console.log(`Awarded ${rewardAmount} coins to ${winnerId}.`);
            }
            else {
                console.error(`Wallet not found for user ${winnerId}, could not award coins.`);
            }
        }
    }
    catch (error) {
        console.error(`Error in DailyBlitz function for game ${gameId}:`, error);
    }
    return null;
});
//# sourceMappingURL=dailyBlitz.js.map