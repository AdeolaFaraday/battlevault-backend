import { Schema, model, Types } from 'mongoose';
import { directoryImport } from 'directory-import';
import { importFunctionsAndAppendToSchema } from '../../utlis/utlis';
import TournamentDoc from './types/tournamentDoc';
import TournamentModel from './types/tournamentModel';

const importedFunctions = directoryImport('./functions');

const tournamentSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        gameType: { type: String, enum: ['LUDO', 'CHESS'], required: true },
        entryFee: { type: Number, required: true, min: 0 },
        prizePool: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: ['UPCOMING', 'ONGOING', 'COMPLETED'],
            default: 'UPCOMING',
        },
        participants: [{ type: Types.ObjectId, ref: 'User' }],
        maxParticipants: { type: Number, required: true, min: 2 },
        winner: { type: Types.ObjectId, ref: 'User', default: null },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
    },
    { timestamps: true }
);

importFunctionsAndAppendToSchema(importedFunctions, tournamentSchema);
const Tournament = model<TournamentDoc, TournamentModel>('Tournament', tournamentSchema);

export default Tournament;
