import { Schema, model, Types } from 'mongoose';
import GameDoc, { GameType } from './types/gameDoc';
import GameModel from './types/gameModel';

const gameSchema: Schema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            enum: Object.values(GameType),
            default: GameType.FREE,
            required: true
        },
        tournamentId: {
            type: String,
            required: function (this: GameDoc) {
                return this.type === GameType.TOURNAMENT;
            }
        },
        matchStage: {
            type: String,
            required: function (this: GameDoc) {
                return this.type === GameType.TOURNAMENT;
            }
        },
        startDate: { type: Date, required: false },
        players: [
            {
                id: {
                    type: String,
                    default: () => new Types.ObjectId().toString()
                },
                name: { type: String, required: true },
                color: {
                    type: String,
                    required: true,
                    lowercase: true // Enforce colors to be lowercase
                },
                tokens: [{ type: String }]
            }
        ],
        currentTurn: { type: String, required: false },
        diceValue: [{ type: Number }],
        isRolling: { type: Boolean, default: false },
        status: {
            type: String,
            default: 'playingDice'
        },
        tokens: {
            blue: [{ type: Schema.Types.Mixed }],
            yellow: [{ type: Schema.Types.Mixed }],
            green: [{ type: Schema.Types.Mixed }],
            red: [{ type: Schema.Types.Mixed }]
        },
        usedDiceValues: [{ type: Number }],
        activeDiceConfig: [{ type: Number }],
        lastMoverId: { type: String }
    },
    {
        timestamps: true,
        toJSON: {
            transform(_: any, ret: any) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
            },
        }
    }
);

const Game = model<GameDoc, GameModel>('Game', gameSchema);
export default Game;
