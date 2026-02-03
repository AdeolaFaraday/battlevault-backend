import { Document, Types } from 'mongoose';

export type WalletField = 'withdrawable' | 'pending' | 'rewards' | 'locked';

export interface IWallet {
    userId: Types.ObjectId;
    withdrawable: number;
    pending: number;
    rewards: number;
    locked: number;
    currency: string;
}

export default interface WalletDoc extends IWallet, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
