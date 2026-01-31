"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.awardTournamentPrize = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const parsePrize = (prize) => {
    if (!prize)
        return 0;
    const cleanPrize = prize.replace(/[^0-9.]/g, '');
    return parseFloat(cleanPrize) || 0;
};
const awardTournamentPrize = async (winnerId, tournamentId) => {
    console.log(`Awarding tournament prize for tournament ${tournamentId} to winner ${winnerId}`);
    try {
        const tournamentSchema = new mongoose_1.default.Schema({
            prize: {
                amount: Number,
                currency: String
            },
            winner: mongoose_1.default.Schema.Types.ObjectId
        }, { strict: false });
        const Tournament = mongoose_1.default.models.Tournament || mongoose_1.default.model('Tournament', tournamentSchema);
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
        await Tournament.findByIdAndUpdate(tournamentId, {
            $set: { winner: winnerId, status: 'COMPLETED' }
        });
        console.log(`Updated tournament ${tournamentId} winner to ${winnerId} and status to COMPLETED`);
        const walletSchema = new mongoose_1.default.Schema({
            userId: { type: mongoose_1.default.Schema.Types.ObjectId, unique: true },
            withdrawable: { type: Number, default: 0 },
            pending: { type: Number, default: 0 },
            rewards: { type: Number, default: 0 },
            currency: { type: String, default: 'NGN' }
        }, { strict: false, timestamps: true });
        const Wallet = mongoose_1.default.models.Wallet || mongoose_1.default.model('Wallet', walletSchema);
        await Wallet.findOneAndUpdate({ userId: winnerId }, {
            $inc: { pending: prizeAmount },
            $setOnInsert: {
                userId: winnerId,
                withdrawable: 0,
                rewards: 0,
                currency: 'NGN'
            }
        }, { upsert: true, new: true });
        console.log(`Credited wallet for user ${winnerId} with pending amount: ${prizeAmount}`);
    }
    catch (error) {
        console.error(`Error in awardTournamentPrize for tournament ${tournamentId}:`, error);
    }
};
exports.awardTournamentPrize = awardTournamentPrize;
//# sourceMappingURL=awardTournamentPrize.js.map