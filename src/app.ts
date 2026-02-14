import express from "express"
import httpServer from "http"
import { graphqlUploadExpress } from "graphql-upload";
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';

import graphqlServer from './graphql';
import { expressPlayground } from "graphql-playground-middleware";
import loadAppEnvs, { env, port, db, whitelist } from "./config/environment";
import startDB from "./startup/db";
import RealtimeProviderFactory from "./services/realtime";
import PaystackService from "./services/paystack";
import Wallet from "./models/wallet/wallet";
import User from "./models/user/user";
import Transaction from "./models/transaction";
import GoogleAuthService from "./services/auth/googleAuth";
import { setCookie } from "./graphql/services/auth/functions/authenticate";
import uploadRoutes from "./routes/upload";
import DailyBlitzService from "./services/dailyBlitz";



const App = async () => {
    let appEnv = { port, env, db };
    if (!env.development) {
        appEnv = loadAppEnvs();
    }
    const app = express();
    const graphqlHttpServer = httpServer.createServer(app);
    const PORT = process.env.PORT || appEnv.port || 8080;

    // Initialize realtime provider
    await RealtimeProviderFactory.initialize();

    const corsOptions = {
        origin(origin: string | undefined, callback: (arg0: Error | null, arg1: boolean) => void) {
            if (
                ((origin && whitelist.includes(origin)) || !origin) ||
                (process.env.NODE_ENV !== 'production' &&
                    /^https?:\/\/localhost:\d{4,5}/.test(origin as string))
            ) {
                callback(null, true);
            } else {
                console.error(`Origin not allowed by CORS: ${origin}`);
                callback(new Error('Not allowed by CORS'), false);
            }
        },
        credentials: true,
    };

    app.use(cors(corsOptions))

    app.use(cookieParser());
    app.set('trust proxy', 1);
    console.log({ ENV: process.env.NODE_ENV });
    const isProd = process.env.NODE_ENV === "production";
    app.use(
        session({
            name: 'cookie',
            secret: appEnv.db.sessionSecret as string,
            resave: false,
            saveUninitialized: true,
            proxy: true,
            // secure: process.env.NODE_ENV !== "development",
            cookie: {
                maxAge: 1000 * 60 * 60 * 24, // One day
                sameSite: isProd ? 'none' : 'lax',
                secure: isProd,
            },
            // store,
            unset: 'destroy',
        })
    );

    app.use(
        express.urlencoded({
            limit: '50mb',
            parameterLimit: 100000,
            extended: true,
        })
    );

    app.use(express.json());

    app.post('/webhooks/paystack', async (req: any, res: any) => {
        const signature = req.headers['x-paystack-signature'] as string;
        if (!PaystackService.verifySignature(signature, req.body)) {
            return res.status(401).send('Invalid signature');
        }

        const event = req.body;
        const { event: eventType, data } = event;

        try {
            if (eventType === 'transfer.success') {
                const { reference, amount: amountKobo, recipient } = data;
                const amount = amountKobo / 100;

                // Find user by recipient code or transaction by reference
                const transaction = await Transaction.findOne({ reference });

                if (transaction) {
                    transaction.status = 'SUCCESS';
                    await transaction.save();

                    const wallet = await Wallet.findOne({ userId: transaction.userId });
                    if (wallet) {
                        wallet.locked -= amount;
                        await wallet.save();
                        console.log(`Transfer successful for user ${transaction.userId}. Locked balance released.`);
                    }
                } else {
                    // Fallback to finding user if transaction not found (legacy support)
                    const user = await User.findOne({ paystackRecipientCode: recipient.recipient_code });
                    if (user) {
                        const wallet = await Wallet.findOne({ userId: user._id });
                        if (wallet) {
                            wallet.locked -= amount;
                            await wallet.save();
                            console.log(`Transfer successful for user ${user._id} (Legacy). Locked balance updated.`);
                        }
                    }
                }
            } else if (eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
                const { reference, amount: amountKobo, recipient } = data;
                const amount = amountKobo / 100;

                const transaction = await Transaction.findOne({ reference });

                if (transaction) {
                    transaction.status = 'FAILED';
                    await transaction.save();

                    const wallet = await Wallet.findOne({ userId: transaction.userId });
                    if (wallet) {
                        // Return money to withdrawable
                        wallet.locked -= amount;
                        wallet.withdrawable += amount;
                        await wallet.save();
                        console.log(`Transfer ${eventType} for user ${transaction.userId}. Funds returned to withdrawable balance.`);
                    }
                } else {
                    // Fallback
                    const user = await User.findOne({ paystackRecipientCode: recipient.recipient_code });
                    if (user) {
                        const wallet = await Wallet.findOne({ userId: user._id });
                        if (wallet) {
                            // Return money to withdrawable
                            wallet.locked -= amount;
                            wallet.withdrawable += amount;
                            await wallet.save();
                            console.log(`Transfer ${eventType} for user ${user._id} (Legacy). Funds returned to withdrawable balance.`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error processing Paystack webhook:', error);
            // Return 200 to Paystack to avoid retries, but log the error
        }

        res.sendStatus(200);
    });

    app.get("/auth/google/callback", async (req, res) => {
        const code = req.query.code as string;

        if (!code) {
            return res.redirect(
                `${process.env.CLIENT_URL}/signin?error=missing_code`
            );
        }

        try {
            // 1. Verify code and get Google payload
            const payload = await GoogleAuthService.verifyCode(code);

            // 2. Find or create user
            const user = await GoogleAuthService.findOrCreateUser(payload);

            // 3. Generate token
            const token = GoogleAuthService.generateToken(user);

            // 4. Set cookie
            // setCookie(token, user, res);

            // 5. Check Daily Blitz Login Reward (Fire and Forget)
            if (user && user.id) {
                DailyBlitzService.checkLoginReward(user.id).catch(e => console.error("DailyBlitz Login Check Failed:", e));
            }

            // 6. Redirect to frontend with token
            return res.redirect(
                `${process.env.CLIENT_URL}/auth/callback?token=${token}`
            );
        } catch (err) {
            console.error("Google OAuth error:", err);
            return res.redirect(
                `${process.env.CLIENT_URL}/signin?error=google_auth_failed`
            );
        }
    });

    app.use(
        '/graphql',
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 })
    );

    app.use('/api', uploadRoutes);

    await graphqlServer.start();

    graphqlServer.applyMiddleware({ app, path: '/graphql', cors: false });

    app.use(
        '/graphql',
        expressPlayground({
            endpoint: '/graphql',
        })
    );

    app.use('*', (req, res) => {
        res.send(`route not found for ${req.originalUrl}`)
    });

    graphqlHttpServer.listen(Number(PORT), '0.0.0.0', async () => {
        startDB(appEnv.db.uri);
        console.log(
            `Server started on http://localhost:${appEnv.port}${graphqlServer.graphqlPath}`
        );
    });
}

App();