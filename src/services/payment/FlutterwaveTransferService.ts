import axios from 'axios';
import { flutterwave } from '../../config/environment';
import {
    TransferProviderInterface,
    Bank,
    RecipientData,
    RecipientResponse,
    TransferData,
    TransferResponse
} from './TransferProviderInterface';
import { BankTestAccounts } from '../../utlis/utlis';

class FlutterwaveTransferService implements TransferProviderInterface {
    private readonly baseUrl = flutterwave.baseUrl;
    private readonly secretKey = flutterwave.secretKey;

    private get headers() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Fetch list of banks by country
     * @param countryCode - ISO-2 country code (e.g., NG)
     */
    async getBanks(countryCode: string = 'NG'): Promise<Bank[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/banks/${countryCode}`, {
                headers: this.headers,
            });

            if (response.data.status !== 'success') {
                throw new Error(response.data.message || 'Failed to fetch banks');
            }

            return response.data.data.map((bank: any) => ({
                id: bank.id,
                code: bank.code,
                name: bank.name,
            }));
        } catch (error: any) {
            console.error('Flutterwave Get Banks Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to fetch banks from Flutterwave');
        }
    }

    /**
     * Create a transfer recipient (Beneficiary in Flutterwave)
     */
    async createRecipient(data: RecipientData): Promise<RecipientResponse> {
        try {
            // Flutterwave uses 'beneficiaries' for recipients
            const response = await axios.post(
                `${this.baseUrl}/beneficiaries`,
                {
                    account_number: process.env.ENV === 'production' ? data.account_number : BankTestAccounts.account_number,
                    account_bank: process.env.ENV === 'production' ? data.bank_code : BankTestAccounts.bank_code,
                    beneficiary_name: data.name,
                },
                { headers: this.headers }
            );

            if (response.data.status !== 'success') {
                throw new Error(response.data.message || 'Failed to create beneficiary');
            }

            const beneficiary = response.data.data;

            return {
                recipient_code: beneficiary.id.toString(), // Using ID as recipient code
                name: beneficiary.full_name,
                account_number: beneficiary.account_number,
                bank_name: beneficiary.bank_name,
                bank_code: beneficiary.bank_code,
                currency: data.currency || 'NGN',
                details: beneficiary,
            };
        } catch (error: any) {
            console.error('Flutterwave Create Beneficiary Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to create transfer recipient on Flutterwave');
        }
    }

    /**
     * Send Instant Transfer
     */
    async initiateTransfer(data: TransferData): Promise<TransferResponse> {
        try {
            // Note: Flutterwave amount is in major units (NGN), but interface expects minor units (kobo)
            // We convert back to major units for Flutterwave API
            const amountInMajor = data.amount / 100;

            const response = await axios.post(
                `${this.baseUrl}/transfers`,
                {
                    account_bank: process.env.ENV === 'production' ? data.bank_code : BankTestAccounts.bank_code,
                    account_number: process.env.ENV === 'production' ? data.account_number : BankTestAccounts.account_number,
                    amount: amountInMajor,
                    currency: data.currency,
                    narration: data.narration,
                    reference: data.reference,
                    debit_currency: data.currency,
                },
                { headers: this.headers }
            );

            if (response.data.status !== 'success') {
                throw new Error(response.data.message || 'Failed to initiate transfer');
            }

            const transfer = response.data.data;

            return {
                transfer_code: transfer.id.toString(),
                reference: transfer.reference,
                status: transfer.status,
                amount: data.amount,
                currency: data.currency,
                raw: transfer,
            };
        } catch (error: any) {
            console.error('Flutterwave Initiate Transfer Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to initiate transfer on Flutterwave');
        }
    }

    /**
     * Resolve/verify a bank account number
     */
    async resolveAccountNumber(account_number: string, bank_code: string) {
        console.log({ env: process.env.ENV });
        try {
            const response = await axios.post(
                `${this.baseUrl}/accounts/resolve`,
                {
                    account_number: process.env.ENV === 'production' ? account_number : BankTestAccounts.account_number,
                    account_bank: process.env.ENV === 'production' ? bank_code : BankTestAccounts.bank_code,
                },
                { headers: this.headers }
            );

            if (response.data.status !== 'success') {
                throw new Error(response.data.message || 'Failed to verify account');
            }

            const data = response.data.data;
            return {
                account_number: data.account_number,
                account_name: data.account_name,
                bank_id: null,
            };
        } catch (error: any) {
            console.error('Flutterwave Resolve Account Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to verify account on Flutterwave');
        }
    }

    /**
     * Verify Flutterwave Webhook Secret Hash
     */
    verifySignature(secretHash: string): boolean {
        const expectedHash = flutterwave.webhookSecretHash;
        if (!expectedHash) {
            console.error('FLW_WEBHOOK_SECRET_HASH is not set');
            return false;
        }
        return secretHash === expectedHash;
    }
}

export default new FlutterwaveTransferService();
