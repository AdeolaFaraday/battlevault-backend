import TournamentService from "../../services/tournament/tournament";

const tournamentQueries = {
    getTournaments: async () => {
        return await TournamentService.getTournaments();
    },
    getTournament: async (_: any, { id }: { id: string }) => {
        return await TournamentService.getTournament(id);
    }
};

export default tournamentQueries;
