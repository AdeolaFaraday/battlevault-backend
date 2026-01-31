import WalletDoc, { WalletField } from '../types/walletDoc';
import { Schema } from 'mongoose';

/**
 * Get a user's wallet or create one if it doesn't exist
 * @param userId - The user's ID
 * @returns The wallet document
 */
export async function getOrCreateWallet(
    this: any,
    userId: string
): Promise<WalletDoc> {
    const wallet = await this.findOneAndUpdate(
        { userId },
        {
            $setOnInsert: {
                userId,
                withdrawable: 0,
                pending: 0,
                rewards: 0,
                currency: 'NGN'
            }
        },
        {
            new: true,
            upsert: true
        }
    );
    return wallet;
}

export default function attachGetOrCreateWallet(schema: Schema) {
    schema.statics.getOrCreateWallet = getOrCreateWallet;
}
