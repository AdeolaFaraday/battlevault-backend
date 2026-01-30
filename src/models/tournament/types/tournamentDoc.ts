import { Document, Types } from 'mongoose';

export type GameType = 'LUDO' | 'CHESS';
export type TournamentStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type TournamentFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONE_TIME';

export default interface TournamentDoc extends Document {
    title: string;
    description?: string;
    gameType: GameType;
    entryFee: number;
    entryFeeCurrency: string;
    prize: string;
    status: TournamentStatus;
    frequency: TournamentFrequency;
    isPrivate: boolean;
    password?: string;
    minRating?: number;
    registeredUsers: {
        userId: Types.ObjectId;
        name: string;
    }[];
    maxUsers: number;
    winner?: Types.ObjectId | null;
    startDate: Date;
    endDate?: Date;
    currentStage?: Types.ObjectId;
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