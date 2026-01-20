import { Schema, model, Types } from 'mongoose';
import { directoryImport } from 'directory-import';
import { importFunctionsAndAppendToSchema } from '../../utlis/utlis';
import TournamentDoc from './types/tournamentDoc';
import TournamentModel from './types/tournamentModel';

const importedFunctions = directoryImport('./functions');

const tournamentSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        gameType: { type: String, enum: ['LUDO', 'CHESS'], required: true },
        entryFee: { type: Number, default: 0, min: 0 },
        entryFeeCurrency: { type: String, default: 'USDT' },
        prize: { type: String, required: true },
        status: {
            type: String,
            enum: ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'],
            default: 'UPCOMING',
        },
        frequency: {
            type: String,
            enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'ONE_TIME'],
            default: 'ONE_TIME',
        },
        isPrivate: { type: Boolean, default: false },
        password: { type: String },
        minRating: { type: Number, default: 0 },
        registeredUsers: [{ type: Types.ObjectId, ref: 'User' }],
        maxUsers: { type: Number, required: true, min: 2 },
        winner: { type: Types.ObjectId, ref: 'User', default: null },
        startDate: { type: Date, required: true },
        endDate: { type: Date },
    },
    { timestamps: true }
);

importFunctionsAndAppendToSchema(importedFunctions, tournamentSchema);
const Tournament = model<TournamentDoc, TournamentModel>('Tournament', tournamentSchema);

export default Tournament;
