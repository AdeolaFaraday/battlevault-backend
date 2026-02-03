import { Schema, model } from 'mongoose';
import TransactionDoc from './types/transactionDoc';
import TransactionModel from './types/transactionModel';

const transactionSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        type: {
            type: String,
            required: true,
            enum: ['DEPOSIT', 'WITHDRAWAL', 'GAME_ENTRY', 'GAME_WIN', 'REFUND', 'REFERRAL_REWARD', 'TRANSFER'],
            index: true
        },
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'NGN'
        },
        status: {
            type: String,
            required: true,
            enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
            default: 'PENDING',
            index: true
        },
        reference: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        previousBalance: {
            type: Number,
            required: true
        },
        newBalance: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        metadata: {
            type: Map,
            of: Schema.Types.Mixed
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform(_: any, ret: any) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
            }
        }
    }
);

const Transaction = model<TransactionDoc, TransactionModel>('Transaction', transactionSchema);

export default Transaction;
