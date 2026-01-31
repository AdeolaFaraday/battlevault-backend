import mongoose from 'mongoose';

/**
 * Parses prize string to number. 
 * Handles formats like "100", "100 USDT", "$100"
 */
const parsePrize = (prize: string): number => {
    if (!prize) return 0;
    // Remove non-numeric characters except dot
    const cleanPrize = prize.replace(/[^0-9.]/g, '');
    return parseFloat(cleanPrize) || 0;
};
export const awardTournamentPrize = async (winnerId: string, tournamentId: string) => {
    console.log(`Awarding tournament prize for tournament ${tournamentId} to winner ${winnerId}`);

    try {
        // 1. Get Tournament Model
        const tournamentSchema = new mongoose.Schema({
            prize: {
                amount: Number,
                currency: String
            },
            winner: mongoose.Schema.Types.ObjectId
        }, { strict: false });
        const Tournament = mongoose.models.Tournament || mongoose.model('Tournament', tournamentSchema);

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            console.error(`Tournament ${tournamentId} not found.`);
            return;
        }

        const prizeAmount = tournament.prize?.amount || 0;
        if (prizeAmount <= 0) {
            console.warn(`Tournament ${tournamentId} has invalid prize amount: ${prizeAmount}`);
            return;
        }

        // 2. Update Tournament Winner
        await Tournament.findByIdAndUpdate(tournamentId, {
            $set: { winner: winnerId, status: 'COMPLETED' }
        });
        console.log(`Updated tournament ${tournamentId} winner to ${winnerId} and status to COMPLETED`);

        // 3. Credit Winner's Wallet (Pending Balance)
        // Define Wallet Model locally since we can't import easily
        // Use strict: false to ensure we don't mess up if schema changes, but we want to be safe with specific fields
        const walletSchema = new mongoose.Schema({
            userId: { type: mongoose.Schema.Types.ObjectId, unique: true },
            withdrawable: { type: Number, default: 0 },
            pending: { type: Number, default: 0 },
            rewards: { type: Number, default: 0 },
            currency: { type: String, default: 'NGN' }
        }, { strict: false, timestamps: true });

        const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

        // Atomic update: create if not exists, increment pending
        await Wallet.findOneAndUpdate(
            { userId: winnerId },
            {
                $inc: { pending: prizeAmount },
                $setOnInsert: {
                    userId: winnerId,
                    withdrawable: 0,
                    rewards: 0,
                    currency: 'NGN'
                }
            },
            { upsert: true, new: true }
        );

        console.log(`Credited wallet for user ${winnerId} with pending amount: ${prizeAmount}`);

    } catch (error) {
        console.error(`Error in awardTournamentPrize for tournament ${tournamentId}:`, error);
    }
};
