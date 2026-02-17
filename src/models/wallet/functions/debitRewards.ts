import WalletDoc from '../types/walletDoc';

/**
 * Debit rewards from a user's wallet if they have enough balance
 * @param userId - The user's ID
 * @param amount - Amount to debit
 * @returns The updated wallet document
 */
export async function debitRewards(
    this: any,
    userId: string,
    amount: number
): Promise<WalletDoc> {
    if (amount <= 0) {
        throw new Error('Debit amount must be positive');
    }

    const wallet = await this.findOne({ userId });
    if (!wallet) {
        throw new Error('Wallet not found');
    }

    if (wallet.rewards < amount) {
        throw new Error('Insufficient reward points');
    }

    wallet.rewards -= amount;
    return await wallet.save();
}

export default debitRewards;
