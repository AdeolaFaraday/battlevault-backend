import mongoose from 'mongoose';

/**
 * Checks if the game is the final game of the tournament.
 * Criteria:
 * 1. Game has a stageId
 * 2. Stage name contains "Final" (case insensitive)
 * 3. Game has NO nextGameId AND NO nextGameSlot
 */
export const isFinalGame = async (gameData: any): Promise<boolean> => {
    // Check structural criteria first (no next game)
    if (gameData.nextGameId || gameData.nextGameSlot !== undefined) {
        return false;
    }

    if (!gameData.stageId) {
        return false;
    }

    try {
        // Define minimal interface/schema for Stage if not exists
        const stageSchema = new mongoose.Schema({
            name: String
        }, { strict: false });

        const TournamentStage = mongoose.models.TournamentStage || mongoose.model('TournamentStage', stageSchema);

        const stage = await TournamentStage.findById(gameData.stageId);

        if (!stage) {
            console.warn(`Stage ${gameData.stageId} not found for game verification.`);
            return false;
        }

        const stageName = stage.name?.toLowerCase() || '';
        return stageName.includes('final');

    } catch (error) {
        console.error('Error checking isFinalGame:', error);
        return false;
    }
};
