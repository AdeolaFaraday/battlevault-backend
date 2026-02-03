import Transaction from '../transaction';
import { TransactionType, TransactionStatus } from '../types/transactionDoc';

interface CreateTransactionParams {
    userId: string;
    type: TransactionType;
    amount: number;
    reference: string;
    description: string;
    previousBalance: number;
    newBalance: number;
    status?: TransactionStatus;
    metadata?: Record<string, any>;
}

export async function createTransaction(params: CreateTransactionParams) {
    const transaction = new Transaction({
        ...params
    });
    return await transaction.save();
}
