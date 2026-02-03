import WalletDoc, { WalletField } from '../types/walletDoc';
import { Schema } from 'mongoose';

/**
 * Credit a specific field in the user's wallet
 * Creates the wallet if it doesn't exist
 * @param userId - The user's ID
 * @param amount - Amount to credit (positive number)
 * @param field - Which field to credit: 'withdrawable', 'pending', or 'rewards'
 * @returns The updated wallet document
 */
export async function creditWallet(
    this: any,
    userId: string,
    amount: number,
    field: WalletField
): Promise<WalletDoc> {
    if (amount < 0) {
        throw new Error('Credit amount must be positive');
    }

    const updateField = `${field}`;

    const wallet = await this.findOneAndUpdate(
        { userId },
        {
            $inc: { [updateField]: amount },
            $setOnInsert: {
                userId,
                currency: 'NGN',
                // Set other fields to 0 if creating new wallet
                ...(field !== 'withdrawable' && { withdrawable: 0 }),
                ...(field !== 'pending' && { pending: 0 }),
                ...(field !== 'rewards' && { rewards: 0 }),
                ...(field !== 'locked' && { locked: 0 })
            }
        },
        {
            new: true,
            upsert: true
        }
    );

    return wallet;
}

export default creditWallet;
