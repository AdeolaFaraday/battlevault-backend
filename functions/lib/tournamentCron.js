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
exports.tournamentNotificationCron = void 0;
const functions = __importStar(require("firebase-functions"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
const mailgun_js_1 = __importDefault(require("mailgun.js"));
const form_data_1 = __importDefault(require("form-data"));
const templateLoader_1 = require("./helpers/templateLoader");
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });
dotenv.config();
const MONGO_URI = process.env.DB_CLOUD_CONNECTION || process.env.MONGO_URI || '';
const MAILGUN_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
const MAILGUN_BASE = process.env.MAILGUN_BASE || 'https://api.eu.mailgun.net';
let isConnected = false;
const connectDB = async () => {
    if (isConnected)
        return;
    if (!MONGO_URI)
        throw new Error('MONGO_URI is not defined in .env');
    await mongoose_1.default.connect(MONGO_URI);
    isConnected = true;
};
const tournamentStageSchema = new mongoose_1.default.Schema({
    tournamentId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Tournament' },
    name: { type: String },
    status: { type: String },
    scheduledDate: { type: Date },
    notificationCount: { type: Number, default: 0 },
    gameIds: [{ type: String }]
}, { timestamps: true });
const gameSchema = new mongoose_1.default.Schema({
    stageId: { type: mongoose_1.default.Schema.Types.Mixed },
    status: { type: String },
    name: { type: String },
    players: [{ id: String, name: String }]
}, { timestamps: true });
const userSchema = new mongoose_1.default.Schema({
    email: { type: String }
}, { strict: false });
const Tournament = mongoose_1.default.models.Tournament || mongoose_1.default.model('Tournament', new mongoose_1.default.Schema({ title: String }));
const TournamentStage = mongoose_1.default.models.TournamentStage || mongoose_1.default.model('TournamentStage', tournamentStageSchema);
const Game = mongoose_1.default.models.Game || mongoose_1.default.model('Game', gameSchema);
const User = mongoose_1.default.models.User || mongoose_1.default.model('User', userSchema);
const mailgun = new mailgun_js_1.default(form_data_1.default);
const client = mailgun.client({
    username: 'api',
    key: MAILGUN_KEY,
    url: MAILGUN_BASE
});
exports.tournamentNotificationCron = functions.pubsub
    .schedule('0 */12 * * *')
    .onRun(async (context) => {
    console.log('Running Tournament Notification Cron...');
    try {
        await connectDB();
        const now = new Date();
        const activeStages = await TournamentStage.find({
            status: 'ACTIVE',
            scheduledDate: { $lte: now }
        });
        console.log(`Found ${activeStages.length} active stages with passed scheduled dates.`);
        for (const stage of activeStages) {
            const pendingGames = await Game.find({
                stageId: { $in: [stage._id, stage._id.toString()] },
                status: 'waiting'
            });
            if (pendingGames.length === 0) {
                console.log(`All games in stage ${stage.name} have started or finished.`);
                continue;
            }
            const tournament = await Tournament.findById(stage.tournamentId);
            const tournamentTitle = tournament?.title || 'a Tournament';
            if ((stage.notificationCount ?? 0) < 3) {
                const playerIds = new Set();
                pendingGames.forEach((game) => {
                    game.players.forEach((p) => p.id && playerIds.add(p.id));
                });
                const players = await User.find({ _id: { $in: Array.from(playerIds) } });
                const emails = players.map((u) => u.email).filter((e) => !!e);
                if (emails.length > 0) {
                    console.log(`Sending warning #${(stage.notificationCount ?? 0) + 1} to ${emails.length} players for stage ${stage.name}.`);
                    const template = await (0, templateLoader_1.loadTemplate)('tournamentWarning');
                    const gameLink = `${process.env.CLIENT_URL}/tournaments`;
                    const html = template({
                        tournamentTitle,
                        stageName: stage.name,
                        warningNumber: (stage.notificationCount ?? 0) + 1,
                        gameLink
                    });
                    await client.messages.create(MAILGUN_DOMAIN, {
                        from: `BattleVault <noreply@${MAILGUN_DOMAIN}>`,
                        to: emails,
                        subject: `Match Warning: ${tournamentTitle} - ${stage.name}`,
                        html
                    });
                }
            }
            else if (stage.notificationCount === 3) {
                const adminEmail = 'adexconly@gmail.com';
                const gameNames = pendingGames.map((g) => g.name);
                console.log(`Notifying Admin of delayed games in stage ${stage.name}.`);
                const template = await (0, templateLoader_1.loadTemplate)('adminAlert');
                const html = template({
                    tournamentTitle,
                    stageName: stage.name,
                    gameNames
                });
                await client.messages.create(MAILGUN_DOMAIN, {
                    from: `BattleVault <noreply@${MAILGUN_DOMAIN}>`,
                    to: [adminEmail],
                    subject: `URGENT: Delayed Tournament Games - ${tournamentTitle}`,
                    html
                });
            }
            stage.notificationCount = (stage.notificationCount || 0) + 1;
            await stage.save();
        }
    }
    catch (error) {
        console.error('Error in Tournament Notification Cron:', error);
    }
    return null;
});
//# sourceMappingURL=tournamentCron.js.map