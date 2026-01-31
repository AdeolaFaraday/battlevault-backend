import { Model } from 'mongoose';
import WalletDoc, { WalletField } from './walletDoc';

export default interface WalletModel extends Model<WalletDoc> {
    getOrCreateWallet(userId: string): Promise<WalletDoc>;
    creditWallet(userId: string, amount: number, field: WalletField): Promise<WalletDoc>;
}
