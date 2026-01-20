import Tournament from "../../../models/tournament/tournament";

const tournamentQueries = {
    getTournaments: async () => {
        try {
            return await Tournament.find().populate('registeredUsers winner');
        } catch (error) {
            throw error;
        }
    },
    getTournament: async (_: any, { id }: { id: string }) => {
        try {
            const tournament = await Tournament.findById(id).populate('registeredUsers winner');
            if (!tournament) throw new Error("Tournament not found");
            return tournament;
        } catch (error) {
            throw error;
        }
    }
};

export default tournamentQueries;
