import TournamentService from "../../services/tournament/tournament";

const tournamentQueries = {
    getTournaments: async () => {
        return await TournamentService.getTournaments();
    },
    getTournament: async (_: any, { id }: { id: string }) => {
        return await TournamentService.getTournament(id);
    },
    getTournamentBracket: async (_: any, { tournamentId }: { tournamentId: string }) => {
        return await TournamentService.getTournamentBracket(tournamentId);
    }
};

export default tournamentQueries;
