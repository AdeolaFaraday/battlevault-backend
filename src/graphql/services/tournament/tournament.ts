import Tournament from "../../../models/tournament/tournament";
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
}
