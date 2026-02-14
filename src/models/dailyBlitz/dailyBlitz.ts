import { Schema, model } from 'mongoose';
import { directoryImport } from 'directory-import';
import { importFunctionsAndAppendToSchema } from '../../utlis/utlis';
import DailyBlitzDoc from './types/dailyBlitzDoc';
import DailyBlitzModel from './types/dailyBlitzModel';

const importedFunctions = directoryImport('./functions');

const dailyBlitzSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        date: {
            type: String,
            required: true,
            // Format: "YYYY-MM-DD"
        },
        loginRewardClaimed: {
            type: Boolean,
            default: false
        },
        winsToday: {
            type: Number,
            default: 0
        },
        win1RewardClaimed: {
            type: Boolean,
            default: false
        },
        win3RewardClaimed: {
            type: Boolean,
            default: false
        }
    },
    {
        toJSON: {
            transform(_: any, ret: any) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
            }
        },
        toObject: {
            transform(_: any, ret: any) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
            }
        },
        timestamps: true
    }
);

// Compound index to ensure one document per user per day
dailyBlitzSchema.index({ userId: 1, date: 1 }, { unique: true });

importFunctionsAndAppendToSchema(importedFunctions, dailyBlitzSchema);

const DailyBlitz = model<DailyBlitzDoc, DailyBlitzModel>('DailyBlitz', dailyBlitzSchema);

export default DailyBlitz;
