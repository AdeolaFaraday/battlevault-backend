import { Model } from 'mongoose';
import TransactionDoc from './transactionDoc';

export default interface TransactionModel extends Model<TransactionDoc> {
    // Add any static methods here if needed in the future
}
