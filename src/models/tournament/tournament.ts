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
        entryFee: {
            amount: { type: Number, default: 0, min: 0 },
            currency: { type: String, default: 'NGN' }
        },
        prize: {
            amount: { type: Number, required: true },
            currency: { type: String, default: 'NGN' }
        },
        status: {
            type: String,
            enum: ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'],
            default: 'UPCOMING',
        },
        currentStage: { type: Schema.Types.ObjectId, ref: 'TournamentStage' },
        frequency: {
            type: String,
            enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'ONE_TIME'],
            default: 'ONE_TIME',
        },
        isPrivate: { type: Boolean, default: false },
        password: { type: String },
        minRating: { type: Number, default: 0 },
        registeredUsers: [
            {
                userId: { type: Types.ObjectId, ref: 'User' },
                name: { type: String, required: true },
            },
        ],
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
