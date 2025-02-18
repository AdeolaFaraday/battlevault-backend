import { Types } from 'mongoose';

export type GameType = 'LUDO' | 'CHESS';
export type TournamentStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED';

export default interface TournamentDoc extends Document {
    name: string;
    gameType: GameType;
    entryFee: number;
    prizePool: number;
    status: TournamentStatus;
    participants: Types.ObjectId[];
    maxParticipants: number;
    winner?: Types.ObjectId | null;
    startDate: Date;
    endDate: Date;
}

export interface CrateTournamentInput {
    name: string;
    gameType: GameType;
    entryFee: number;
    prizePool: number;
    maxParticipants: number;
    startDate: Date;
    endDate: Date;
}