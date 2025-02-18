import { FilterQuery, Model } from "mongoose";
import TournamentDoc, { CrateTournamentInput } from "./tournamentDoc";


export default interface TournamentModel extends Model<TournamentDoc> {
    createTournament(data: CrateTournamentInput): Promise<TournamentDoc | null>;
    getTournaments(data: {
        find: FilterQuery<TournamentDoc>;
        populate?: any;
    }): Promise<TournamentDoc | null>;
}