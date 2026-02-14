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

// CONSTANTS (Mirroring Service)
const WIN_1_REWARD = 100;
const WIN_3_REWARD = 300;

export const dailyBlitzWinTracker = functions.firestore
    .document('games/{gameId}')
    .onUpdate(async (change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) => {
        const gameId = context.params.gameId;
        const newData = change.after.data() || {};
        const oldData = change.before.data() || {};

        // 1. Check if Game Finished just now
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

            // Define Inline Schemas (to avoid importing from outside functions folder)
            const dailyBlitzSchema = new mongoose.Schema({
                userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
                date: { type: String, required: true },
                loginRewardClaimed: { type: Boolean, default: false },
                winsToday: { type: Number, default: 0 },
                win1RewardClaimed: { type: Boolean, default: false },
                win3RewardClaimed: { type: Boolean, default: false }
            }, { timestamps: true });
            // Compound index
            dailyBlitzSchema.index({ userId: 1, date: 1 }, { unique: true });

            const DailyBlitz = mongoose.models.DailyBlitz || mongoose.model('DailyBlitz', dailyBlitzSchema);

            const walletSchema = new mongoose.Schema({
                userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
                rewards: { type: Number, default: 0 },
                withdrawable: { type: Number, default: 0 },
                // ... other fields not needed for update
            }, { strict: false });
            const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

            const transactionSchema = new mongoose.Schema({
                userId: { type: mongoose.Schema.Types.ObjectId, required: true },
                type: { type: String, required: true },
                amount: { type: Number, required: true },
                reference: { type: String },
                description: { type: String },
                previousBalance: { type: Number },
                newBalance: { type: Number },
                status: { type: String },
                metadata: { type: mongoose.Schema.Types.Mixed }
            }, { timestamps: true });
            const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

            // Fetch or Create DailyBlitz Doc
            let dailyBlitz = await DailyBlitz.findOne({ userId: winnerId, date: today });
            if (!dailyBlitz) {
                // If they won a game before logging in (?) - unlikely but possible
                dailyBlitz = new DailyBlitz({
                    userId: winnerId,
                    date: today,
                    winsToday: 0
                });
            }

            // Increment Wins
            dailyBlitz.winsToday += 1;
            console.log(`User ${winnerId} now has ${dailyBlitz.winsToday} wins today.`);

            let rewardAmount = 0;
            let rewardType = '';

            // Check Win 1 Reward
            if (dailyBlitz.winsToday >= 1 && !dailyBlitz.win1RewardClaimed) {
                rewardAmount += WIN_1_REWARD;
                dailyBlitz.win1RewardClaimed = true;
                rewardType = 'DAILY_BLITZ_WIN_1';
                console.log(`User ${winnerId} qualified for Win 1 Reward.`);
            }

            // Check Win 3 Reward
            if (dailyBlitz.winsToday >= 3 && !dailyBlitz.win3RewardClaimed) {
                rewardAmount += WIN_3_REWARD;
                dailyBlitz.win3RewardClaimed = true;
                rewardType = rewardType ? 'DAILY_BLITZ_WIN_1_AND_3' : 'DAILY_BLITZ_WIN_3'; // unlikely to be both at once unless wins jump, but safe
                console.log(`User ${winnerId} qualified for Win 3 Reward.`);
            }

            await dailyBlitz.save();

            // Distribute Reward if any
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
                } else {
                    console.error(`Wallet not found for user ${winnerId}, could not award coins.`);
                }
            }

        } catch (error) {
            console.error(`Error in DailyBlitz function for game ${gameId}:`, error);
        }

        return null;
    });
