import { Document, Types } from 'mongoose';

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'GAME_ENTRY' | 'GAME_WIN' | 'REFUND' | 'REFERRAL_REWARD' | 'TRANSFER';

export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface ITransaction {
    userId: Types.ObjectId;
    type: TransactionType;
    amount: number;
    currency: string;
    status: TransactionStatus;
    reference: string;
    previousBalance: number;
    newBalance: number;
    description: string;
    metadata?: Record<string, any>;
}

export default interface TransactionDoc extends ITransaction, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
