import { Schema, model, Types, Document } from 'mongoose';

export interface TournamentStageDoc extends Document {
    tournamentId: Types.ObjectId;
    name: string;
    index: number;
    gameIds: string[];
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
}

const tournamentStageSchema = new Schema(
    {
        tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
        name: { type: String, required: true },
        index: { type: Number, required: true }, // 0 = first round
        gameIds: [{ type: String }],
        status: {
            type: String,
            enum: ['PENDING', 'ACTIVE', 'COMPLETED'],
            default: 'PENDING'
        }
    },
    { timestamps: true }
);

const TournamentStage = model<TournamentStageDoc>('TournamentStage', tournamentStageSchema);
export default TournamentStage;
