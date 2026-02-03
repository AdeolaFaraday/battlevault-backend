import { Document, Types } from 'mongoose';

export interface IBank {
    userId: Types.ObjectId;
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankCode: string;
    recipientCode: string;
    currency: string;
    isDefault: boolean;
}

export default interface BankDoc extends IBank, Document {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
