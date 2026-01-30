import Tournament from "../../../models/tournament/tournament";
import Game from "../../../models/game/game";
import TournamentStage from "../../../models/tournament/tournamentStage";
import ClientResponse from "../../../services/response";

export default class TournamentService {
    static async createTournament(input: any) {
        try {
            const tournament = new Tournament(input);
            const savedTournament = await tournament.save();
            return new ClientResponse(201, true, "Tournament created successfully", savedTournament);
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async startTournament(tournamentId: string) {
        try {
            const tournament = await Tournament.findById(tournamentId);
            if (!tournament) return new ClientResponse(404, false, "Tournament not found");

            if (tournament.status !== 'UPCOMING') {
                return new ClientResponse(400, false, "Tournament is not in UPCOMING state");
            }

            if (tournament.registeredUsers.length < tournament.maxUsers) {
                // Strict power of 2 check can also be added here
                return new ClientResponse(400, false, "Tournament is not full yet");
            }

            const totalPlayers = tournament.maxUsers;
            const totalRounds = Math.log2(totalPlayers);

            if (!Number.isInteger(totalRounds)) {
                return new ClientResponse(400, false, "Max users must be a power of 2 (e.g. 4, 8, 16, 32)");
            }

            // Shuffle players for random seeding
            const shuffledPlayers = tournament.registeredUsers.sort(() => Math.random() - 0.5);

            // Temporary storage to link games [roundIndex][gameIndex] => GameDoc
            const bracket: any[][] = [];
            const stages: any[] = [];

            // 1. Create all games for all rounds first (without IDs yet, but distinct objects)
            // Actually, we need IDs to link. So we should instantiate them or save them.
            // Let's generate objects with new IDs first.

            for (let round = 0; round < totalRounds; round++) {
                const numGames = totalPlayers / Math.pow(2, round + 1);
                const roundGames: any[] = [];
                const stageName = round === totalRounds - 1 ? "Final" :
                    round === totalRounds - 2 ? "Semi-Final" :
                        round === totalRounds - 3 ? "Quarter-Final" :
                            `Round of ${totalPlayers / Math.pow(2, round)}`;

                const stage = new TournamentStage({
                    tournamentId: tournament._id,
                    name: stageName,
                    index: round,
                    gameIds: [],
                    status: round === 0 ? 'ACTIVE' : 'PENDING'
                });

                // We'll save the stage after collecting game IDs

                for (let i = 0; i < numGames; i++) {
                    const game = new Game({
                        name: `${stageName} - Match ${i + 1}`,
                        type: 'TOURNAMENT',
                        status: 'waiting',
                        matchStage: stageName,
                        // Initial status 'waiting'. Logic will set active ones to 'playingDice'/'playingToken' via separate process or here.
                        // For now, let's keep them 'waiting' unless it's round 0 and ready.
                        tournamentId: tournament._id,
                        stageId: stage._id,
                        players: [],
                        tokens: { blue: [], yellow: [], green: [], red: [] }, // Initialize empty
                        diceValue: [],
                        usedDiceValues: [],
                        activeDiceConfig: []
                    });
                    roundGames.push(game);
                }
                bracket.push(roundGames);
                stages.push(stage);
            }

            // 2. Link Games (Next Game Logic)
            // Round 0 games feed into Round 1 games, etc.
            // Game i in Round r feeds into Game floor(i/2) in Round r+1.
            // Slot is i % 2.

            for (let round = 0; round < totalRounds - 1; round++) {
                const currentRoundGames = bracket[round];
                const nextRoundGames = bracket[round + 1];

                for (let i = 0; i < currentRoundGames.length; i++) {
                    const currentGame = currentRoundGames[i];
                    const targetGameIndex = Math.floor(i / 2);
                    const targetSlot = i % 2; // 0 or 1
                    const targetGame = nextRoundGames[targetGameIndex];

                    currentGame.nextGameId = targetGame._id.toString();
                    currentGame.nextGameSlot = targetSlot;
                }
            }

            // 3. Seed Players into 1st Round (Round 0)
            const firstRoundGames = bracket[0];
            const LudoColor = { RED: 'red', GREEN: 'green', BLUE: 'blue', YELLOW: 'yellow' }; // Basic definition

            // Tokens need to be initialized if the game is active immediately, 
            // but the GameService usually handles token initialization on create. 
            // We manually set basic structure here.

            for (let i = 0; i < firstRoundGames.length; i++) {
                const game = firstRoundGames[i];
                const p1Id = shuffledPlayers[i * 2];
                const p2Id = shuffledPlayers[i * 2 + 1];

                const P1_COLORS = [LudoColor.RED, LudoColor.GREEN];
                const P2_COLORS = [LudoColor.BLUE, LudoColor.YELLOW];

                game.players = [
                    {
                        id: p1Id.toString(),
                        name: "Player 1", // Name should ideally be fetched or synced from User
                        color: P1_COLORS[0],
                        tokens: P1_COLORS,
                        slot: 0
                    },
                    {
                        id: p2Id.toString(),
                        name: "Player 2",
                        color: P2_COLORS[0],
                        tokens: P2_COLORS,
                        slot: 1
                    }
                ];

                // Also initialize the tokens structure properly if needed by the game logic
                // For now, relying on game service to potentially "start" them, 
                // but setting status to 'waiting' is safe.
            }

            // 4. Save Everything
            const allGamesToSave: any[] = bracket.flat();
            await Game.insertMany(allGamesToSave);

            for (let r = 0; r < stages.length; r++) {
                stages[r].gameIds = bracket[r].map(g => g._id.toString());
                await stages[r].save();
            }

            tournament.status = 'ONGOING';
            tournament.currentStage = stages[0]._id;
            tournament.startDate = new Date();
            await tournament.save();

            return new ClientResponse(200, true, "Tournament started successfully", tournament);

        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async registerForTournament(tournamentId: string, password: string | undefined, context: any) {
        try {
            const user = await context.getUserLocal();
            if (!user) return new ClientResponse(401, false, "Unauthorized");

            const tournament = await Tournament.findById(tournamentId);
            if (!tournament) return new ClientResponse(404, false, "Tournament not found");

            if (tournament.isPrivate) {
                if (!password || tournament.password !== password) {
                    return new ClientResponse(400, false, "Invalid password for private tournament");
                }
            }

            if (tournament.registeredUsers.some(id => id.toString() === user.id)) {
                return new ClientResponse(400, false, "Already registered for this tournament");
            }

            if (tournament.registeredUsers.length >= tournament.maxUsers) {
                return new ClientResponse(400, false, "Tournament is full");
            }

            tournament.registeredUsers.push(user.id);
            const savedTournament = await tournament.save();
            return new ClientResponse(200, true, "Registered for tournament successfully", savedTournament);
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async getTournaments() {
        try {
            const tournaments = await Tournament.find().populate('registeredUsers winner');
            // Return exactly what the TournamentList type expects: { tournaments: [Tournament] }
            return new ClientResponse(200, true, "Tournaments retrieved successfully", { tournaments });
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async getTournament(id: string) {
        try {
            const tournament = await Tournament.findById(id).populate('registeredUsers winner').lean();
            if (!tournament) return new ClientResponse(404, false, "Tournament not found");
            return new ClientResponse(200, true, "Tournament retrieved successfully", tournament);
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async getTournamentBracket(tournamentId: string) {
        try {
            const tournament = await Tournament.findById(tournamentId).lean();
            if (!tournament) return new ClientResponse(404, false, "Tournament not found");

            const stages = await TournamentStage.find({ tournamentId }).sort({ index: 1 }).lean();
            const games = await Game.find({ tournamentId }).sort({ createdAt: 1 }).lean();

            const bracketData = stages.map(stage => {
                const stageGames = games.filter(g => g.stageId?.toString() === stage._id.toString());
                return {
                    ...stage,
                    games: stageGames
                };
            });

            return new ClientResponse(200, true, "Bracket retrieved successfully", {
                tournament,
                stages: bracketData
            });
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }

    static async isUserRegistered(tournamentId: string, context: any) {
        try {
            const user = await context.getUserLocal();
            if (!user) return new ClientResponse(401, false, "Unauthorized");

            const tournament = await Tournament.findById(tournamentId);
            if (!tournament) return new ClientResponse(404, false, "Tournament not found");

            const isRegistered = tournament.registeredUsers.some(id => id.toString() === user.id);
            return new ClientResponse(200, true, "Registration status retrieved", { isRegistered });
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }
}
