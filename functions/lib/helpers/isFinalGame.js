"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFinalGame = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const isFinalGame = async (gameData) => {
    if (gameData.nextGameId || gameData.nextGameSlot !== null) {
        return false;
    }
    if (!gameData.stageId) {
        return false;
    }
    try {
        const stageSchema = new mongoose_1.default.Schema({
            name: String
        }, { strict: false });
        const TournamentStage = mongoose_1.default.models.TournamentStage || mongoose_1.default.model('TournamentStage', stageSchema);
        const stage = await TournamentStage.findById(gameData.stageId);
        if (!stage) {
            console.warn(`Stage ${gameData.stageId} not found for game verification.`);
            return false;
        }
        const stageName = stage.name?.toLowerCase() || '';
        return stageName.includes('final');
    }
    catch (error) {
        console.error('Error checking isFinalGame:', error);
        return false;
    }
};
exports.isFinalGame = isFinalGame;
//# sourceMappingURL=isFinalGame.js.map