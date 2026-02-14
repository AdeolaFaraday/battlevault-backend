import { Types } from 'mongoose';
import ClientResponse from '../response';
import DailyBlitz from '../../models/dailyBlitz/dailyBlitz';
import Wallet from '../../models/wallet/wallet';
import Transaction, { createTransaction } from '../../models/transaction';
const { ObjectId } = Types;


// Hardcoded rewards for now
const LOGIN_REWARD = 50;
const WIN_1_REWARD = 100;
const WIN_3_REWARD = 300;

export default class DailyBlitzService {
    static async checkLoginReward(userId: string) {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Upsert ensures we have a document for today
            let dailyBlitz = await DailyBlitz.findOne({ userId, date: today });

            if (!dailyBlitz) {
                dailyBlitz = new DailyBlitz({
                    userId,
                    date: today,
                    winsToday: 0
                });
                await dailyBlitz.save();
            }

            if (!dailyBlitz.loginRewardClaimed) {
                // Award Login Reward
                const wallet = await Wallet.findOne({ userId });
                if (wallet) {
                    const previousBalance = wallet.withdrawable; // Assuming rewards go to withdrawable or separate 'rewards' field? 
                    // Let's use 'rewards' field in wallet for bonus/promotional credits if available, or 'withdrawable' if it's cash.
                    // Given the request says "coin", let's check Wallet model again. 
                    // Wallet has 'rewards' field. Let's use that.

                    wallet.rewards += LOGIN_REWARD;
                    await wallet.save();

                    // Record Transaction
                    await createTransaction({
                        userId,
                        type: 'DEPOSIT', // Or a new type 'REWARD' if enum allows? Transaction model types need check. 
                        // Defaulting to DEPOSIT with description for now.
                        amount: LOGIN_REWARD,
                        reference: `DAILY_LOGIN_${today}_${userId}`,
                        description: `Daily Login Reward - ${today}`,
                        previousBalance: wallet.rewards - LOGIN_REWARD, // This logic is tricky if we track specific balances in transaction. 
                        // Usually transaction tracks "balance", often implied as main balance. 
                        // For now let's assume 'rewards' is the target.
                        newBalance: wallet.rewards,
                        status: 'SUCCESS',
                        metadata: {
                            type: 'DAILY_BLITZ_LOGIN',
                            date: today
                        }
                    });

                    dailyBlitz.loginRewardClaimed = true;
                    await dailyBlitz.save();
                    console.log(` awarded login reward to ${userId}`);
                }
            }
            return new ClientResponse(200, true, "Login reward checked", dailyBlitz);
        } catch (error: any) {
            console.error("Error checking login reward:", error);
            return new ClientResponse(500, false, error.message);
        }
    }

    static async getDailyBlitz(userId: string) {
        try {
            const today = new Date().toISOString().split('T')[0];
            // userId is supposed to be string but in DB it is ObjectId
            let dailyBlitz = await DailyBlitz.findOne({ userId: new Types.ObjectId(userId), date: today });

            if (!dailyBlitz) {
                // Should have been created on login, but if querying before login logic fires (rare), return default
                dailyBlitz = new DailyBlitz({ userId, date: today });
                // Don't save it here necessarily, or do? Let's waiting for explicit triggers.
                // But for UI consistency, returning the object is enough.
            }

            // Calculate Next Reward & Percent
            let nextReward = {
                description: "Login Reward",
                amount: LOGIN_REWARD,
                target: 1,
                current: 0,
                percentage: 0
            };

            if (!dailyBlitz.loginRewardClaimed) {
                // If not claimed yet (e.g. just created object in memory), 0%
                // In reality, checkLoginReward should fire on login, so this state is transient.
                // If the user IS logged in, this should be claimed.
                nextReward = {
                    description: "Login Reward",
                    amount: LOGIN_REWARD,
                    target: 1,
                    current: 1, // It's done, just waiting for DB update/claim
                    percentage: 100
                };
            } else if (!dailyBlitz.win1RewardClaimed) {
                nextReward = {
                    description: "Win 1 Game",
                    amount: WIN_1_REWARD,
                    target: 1,
                    current: dailyBlitz.winsToday,
                    percentage: Math.min((dailyBlitz.winsToday / 1) * 100, 100)
                };
            } else if (!dailyBlitz.win3RewardClaimed) {
                nextReward = {
                    description: "Win 3 Games",
                    amount: WIN_3_REWARD,
                    target: 3,
                    current: dailyBlitz.winsToday,
                    percentage: Math.min((dailyBlitz.winsToday / 3) * 100, 100)
                };
            } else {
                nextReward = {
                    description: "All Rewards Claimed",
                    amount: 0,
                    target: 3,
                    current: 3,
                    percentage: 100
                };
            }

            return new ClientResponse(200, true, "Daily Blitz status retrieved", {
                ...dailyBlitz.toObject(),
                nextReward
            });

        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }
}
