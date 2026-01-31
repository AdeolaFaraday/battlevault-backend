import { Schema, model } from 'mongoose';
import { directoryImport } from 'directory-import';
import { importFunctionsAndAppendToSchema } from '../../utlis/utlis';
import WalletDoc from './types/walletDoc';
import WalletModel from './types/walletModel';

const importedFunctions = directoryImport('./functions');

const walletSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true
        },
        withdrawable: {
            type: Number,
            default: 0,
            min: 0
        },
        pending: {
            type: Number,
            default: 0,
            min: 0
        },
        rewards: {
            type: Number,
            default: 0,
            min: 0
        },
        currency: {
            type: String,
            default: 'NGN'
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
        timestamps: true
    }
);

importFunctionsAndAppendToSchema(importedFunctions, walletSchema);

const Wallet = model<WalletDoc, WalletModel>('Wallet', walletSchema);

export default Wallet;
