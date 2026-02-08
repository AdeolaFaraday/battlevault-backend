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
    slot: number | string;
}

export interface LudoGameState {
    type?: string;
    players: LudoPlayer[];
    currentTurn: string;
    diceValue: number[];
    isRolling: boolean;
    status: string;
    winner?: string;
    tokens?: any;
    usedDiceValues: number[];
    activeDiceConfig: number[];
}

interface GameDoc extends Document, LudoGameState {
    name: string;
    type: GameType;
    tournamentId?: string;
    matchStage?: string;
    stageId?: string;
    nextGameId?: string;
    nextGameSlot?: number | string;
    startDate?: Date;
    winner?: string;
    createdAt: Date;
    updatedAt: Date;
}

export default GameDoc;
