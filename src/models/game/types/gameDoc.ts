import { Document } from 'mongoose';

export enum GameType {
    TOURNAMENT = 'TOURNAMENT',
    FREE = 'FREE',
    INSTANT_COMPETITIVE = 'INSTANT_COMPETITIVE'
}

export interface LudoPlayer {
    id?: string;
    name: string;
    color: string;
    tokens: string[];
}

export interface LudoGameState {
    players: LudoPlayer[];
    currentTurn: string;
    diceValue: number[];
    isRolling: boolean;
    status: string;
}

interface GameDoc extends Document, LudoGameState {
    name: string;
    type: GameType;
    tournamentId?: string;
    matchStage?: string;
    startDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export default GameDoc;
