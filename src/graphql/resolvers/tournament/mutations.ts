import authenticatedRequest from "../../authenticatedRequest";
import TournamentService from "../../services/tournament/tournament";

const tournamentMutations = {
    createTournament: async (_: any, { input }: { input: any }) => {
        return await TournamentService.createTournament(input);
    },
    registerForTournament: async (_: any, { tournamentId, password }: { tournamentId: string, password?: string }, context: any) => {
        return await TournamentService.registerForTournament(tournamentId, password, context);
    },
    startTournament: authenticatedRequest(async (_: any, { tournamentId }: { tournamentId: string }, context: any) => {
        return await TournamentService.startTournament(tournamentId, context);
    }),
    advanceUserInTournament: authenticatedRequest(async (_: any, { tournamentId, userId }: { tournamentId: string, userId: string }, context: any) => {
        return await TournamentService.advanceUserInTournament(tournamentId, userId, context);
    })
};

export default tournamentMutations;
