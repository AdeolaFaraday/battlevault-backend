import { Model } from 'mongoose';
import BankDoc from './bankDoc';

export default interface BankModel extends Model<BankDoc> {
    // Add static methods if needed
}
