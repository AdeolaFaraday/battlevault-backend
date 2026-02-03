import { v4 as uuidv4 } from 'uuid';
import authenticatedRequest from "../../authenticatedRequest";
import ClientResponse from "../../../services/response";
import PaystackService from "../../../services/paystack";
import User from "../../../models/user/user";
import Wallet from "../../../models/wallet/wallet";
import Transaction, { createTransaction } from "../../../models/transaction";

import Bank from "../../../models/bank";

const walletMutations = {
    createTransferRecipient: authenticatedRequest(
        async (
            _: any,
            { accountNumber, bankCode }: { accountNumber: string; bankCode: string },
            context: any
        ) => {
            try {
                const user = await User.findById(context.currentUser.id);
                if (!user) {
                    return new ClientResponse(404, false, 'User not found');
                }

                // Check if account already exists for user
                const existingBank = await Bank.findOne({
                    userId: user._id,
                    accountNumber,
                    bankCode
                });

                if (existingBank) {
                    return new ClientResponse(200, true, 'Bank account already saved', existingBank);
                }

                const name = `${user.firstName} ${user.lastName}`;
                const recipientData = await PaystackService.createRecipient(
                    name,
                    accountNumber,
                    bankCode
                );

                const newBank = new Bank({
                    userId: user._id,
                    accountName: recipientData.details.account_name || name,
                    accountNumber,
                    bankName: recipientData.details.bank_name,
                    bankCode,
                    recipientCode: recipientData.recipient_code,
                    currency: recipientData.currency || 'NGN'
                });

                await newBank.save();

                return new ClientResponse(200, true, 'Transfer recipient created successfully', newBank);
            } catch (error: any) {
                return new ClientResponse(400, false, error.message);
            }
        }
    ),

    withdrawWinnings: authenticatedRequest(
        async (
            _: any,
            { amount, bankId }: { amount: number; bankId: string },
            context: any
        ) => {
            try {
                const userId = context.currentUser.id;

                const bank = await Bank.findOne({ _id: bankId, userId });
                if (!bank) {
                    return new ClientResponse(404, false, 'Bank account not found');
                }

                const wallet = await Wallet.findOne({ userId });
                if (!wallet || wallet.withdrawable < amount) {
                    return new ClientResponse(400, false, 'Insufficient withdrawable balance');
                }

                // Note: Paystack amount is in kobo (NGN * 100)
                const paystackAmount = Math.round(amount * 100);
                const reference = `BV_${uuidv4().replace(/-/g, '').substring(0, 20)}`;

                const transfer = await PaystackService.initiateTransfer(
                    paystackAmount,
                    bank.recipientCode,
                    reference,
                    'BattleVault Withdrawal'
                );

                // Deduct from withdrawable and add to locked (held funds)
                const previousBalance = wallet.withdrawable;
                wallet.withdrawable -= amount;
                wallet.locked += amount;
                await wallet.save();

                await createTransaction({
                    userId,
                    type: 'WITHDRAWAL',
                    amount,
                    reference,
                    description: 'Withdrawal to bank account',
                    previousBalance,
                    newBalance: wallet.withdrawable,
                    status: 'PENDING',
                    metadata: {
                        bank: bank.bankName,
                        accountNumber: bank.accountNumber,
                        transferCode: transfer.data.transfer_code
                    }
                });

                return new ClientResponse(200, true, 'Withdrawal initiated successfully', transfer);
            } catch (error: any) {
                return new ClientResponse(400, false, error.message);
            }
        }
    ),
};

export default walletMutations;
