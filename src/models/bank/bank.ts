import { Schema, model } from 'mongoose';
import BankDoc from './types/bankDoc';
import BankModel from './types/bankModel';

const bankSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        accountName: {
            type: String,
            required: true,
            trim: true
        },
        accountNumber: {
            type: String,
            required: true,
            trim: true
        },
        bankName: {
            type: String,
            required: true,
            trim: true
        },
        bankCode: {
            type: String,
            required: true,
            trim: true
        },
        recipientCode: {
            type: String,
            required: true,
            trim: true
        },
        currency: {
            type: String,
            default: 'NGN'
        },
        isDefault: {
            type: Boolean,
            default: false
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

// Ensure a user doesn't save the same account number for the same bank twice
bankSchema.index({ userId: 1, accountNumber: 1, bankCode: 1 }, { unique: true });

const Bank = model<BankDoc, BankModel>('Bank', bankSchema);

export default Bank;
