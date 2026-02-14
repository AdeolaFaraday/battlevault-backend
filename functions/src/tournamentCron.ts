import * as functions from 'firebase-functions';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { loadTemplate } from './helpers/templateLoader';

// Configure dotenv
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });
dotenv.config();

const MONGO_URI = process.env.DB_CLOUD_CONNECTION || process.env.MONGO_URI || '';
const MAILGUN_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';

let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    if (!MONGO_URI) throw new Error('MONGO_URI is not defined in .env');
    await mongoose.connect(MONGO_URI);
    isConnected = true;
};

// Inline Schemas
const tournamentStageSchema = new mongoose.Schema({
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
    name: { type: String },
    status: { type: String },
    scheduledDate: { type: Date },
    notificationCount: { type: Number, default: 0 },
    gameIds: [{ type: String }]
}, { timestamps: true });

const gameSchema = new mongoose.Schema({
    stageId: { type: String },
    status: { type: String },
    name: { type: String },
    players: [{ id: String, name: String }]
}, { timestamps: true });

const userSchema = new mongoose.Schema({
    email: { type: String }
}, { strict: false });

const Tournament = mongoose.models.Tournament || mongoose.model('Tournament', new mongoose.Schema({ title: String }));
const TournamentStage = mongoose.models.TournamentStage || mongoose.model('TournamentStage', tournamentStageSchema);
const Game = mongoose.models.Game || mongoose.model('Game', gameSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Email Client
const mailgun = new Mailgun(FormData);
const client = mailgun.client({ username: 'api', key: MAILGUN_KEY });

export const tournamentNotificationCron = functions.pubsub
    .schedule('0 */12 * * *') // Every 12 hours
    .onRun(async (context) => {
        console.log('Running Tournament Notification Cron...');

        try {
            await connectDB();

            const now = new Date();

            // 1. Find ACTIVE stages where scheduledDate has passed
            const activeStages = await TournamentStage.find({
                status: 'ACTIVE',
                scheduledDate: { $lte: now }
            });

            console.log(`Found ${activeStages.length} active stages with passed scheduled dates.`);

            for (const stage of activeStages) {
                // Find games in this stage that have not started
                const pendingGames = await Game.find({
                    stageId: (stage._id as any).toString(),
                    status: 'waiting'
                });

                if (pendingGames.length === 0) {
                    console.log(`All games in stage ${stage.name} have started or finished.`);
                    continue;
                }

                const tournament = await Tournament.findById(stage.tournamentId);
                const tournamentTitle = tournament?.title || 'a Tournament';

                if ((stage.notificationCount ?? 0) < 3) {
                    // Send notification to participants
                    const playerIds = new Set<string>();
                    pendingGames.forEach((game: any) => {
                        game.players.forEach((p: any) => p.id && playerIds.add(p.id));
                    });

                    const players = await User.find({ _id: { $in: Array.from(playerIds) } });
                    const emails = players.map((u: any) => u.email).filter((e: any) => !!e);

                    if (emails.length > 0) {
                        console.log(`Sending warning #${(stage.notificationCount ?? 0) + 1} to ${emails.length} players for stage ${stage.name}.`);

                        const template = await loadTemplate('tournamentWarning');
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
                } else if (stage.notificationCount === 3) {
                    // Notify Admin
                    const adminEmail = 'adexconly@gmail.com';
                    const gameNames = pendingGames.map((g: any) => g.name);
                    console.log(`Notifying Admin of delayed games in stage ${stage.name}.`);

                    const template = await loadTemplate('adminAlert');
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

                // Increment notification count
                stage.notificationCount = (stage.notificationCount || 0) + 1;
                await stage.save();
            }

        } catch (error) {
            console.error('Error in Tournament Notification Cron:', error);
        }

        return null;
    });
