import TournamentService from "../../services/tournament/tournament";

const tournamentMutations = {
    createTournament: async (_: any, { input }: { input: any }) => {
        return await TournamentService.createTournament(input);
    },
    registerForTournament: async (_: any, { tournamentId, password }: { tournamentId: string, password?: string }, context: any) => {
        return await TournamentService.registerForTournament(tournamentId, password, context);
    },
    startTournament: async (_: any, { tournamentId }: { tournamentId: string }) => {
        return await TournamentService.startTournament(tournamentId);
    }
};

export default tournamentMutations;
