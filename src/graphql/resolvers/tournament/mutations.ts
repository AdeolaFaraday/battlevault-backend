import Tournament from "../../../models/tournament/tournament";

const tournamentMutations = {
    createTournament: async (_: any, { input }: { input: any }) => {
        try {
            const tournament = new Tournament(input);
            return await tournament.save();
        } catch (error) {
            throw error;
        }
    },
    registerForTournament: async (_: any, { tournamentId, password }: { tournamentId: string, password?: string }, context: any) => {
        const user = await context.getUserLocal();
        if (!user) throw new Error("Unauthorized");

        try {
            const tournament = await Tournament.findById(tournamentId);
            if (!tournament) throw new Error("Tournament not found");

            if (tournament.isPrivate) {
                if (!password || tournament.password !== password) {
                    throw new Error("Invalid password for private tournament");
                }
            }

            if (tournament.registeredUsers.some(id => id.toString() === user.id)) {
                throw new Error("Already registered for this tournament");
            }

            if (tournament.registeredUsers.length >= tournament.maxUsers) {
                throw new Error("Tournament is full");
            }

            tournament.registeredUsers.push(user.id);
            return await tournament.save();
        } catch (error) {
            throw error;
        }
    }
};

export default tournamentMutations;
