import axios from 'axios';
import crypto from 'crypto';
import { paystack } from '../config/environment';
import {
    TransferProviderInterface,
    Bank,
    RecipientData,
    RecipientResponse,
    TransferData,
    TransferResponse
} from './payment/TransferProviderInterface';

class PaystackService implements TransferProviderInterface {
    private readonly baseUrl = 'https://api.paystack.co';

    private get headers() {
        return {
            Authorization: `Bearer ${paystack.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Create a transfer recipient
     */
    async createRecipient(data: RecipientData): Promise<RecipientResponse> {
        try {
            const response = await axios.post(
                `${this.baseUrl}/transferrecipient`,
                {
                    type: 'nuban',
                    name: data.name,
                    account_number: data.account_number,
                    bank_code: data.bank_code,
                    currency: data.currency || 'NGN',
                },
                { headers: this.headers }
            );

            if (!response.data.status) {
                throw new Error(response.data.message);
            }

            const recipient = response.data.data;
            return {
                recipient_code: recipient.recipient_code,
                name: recipient.name,
                account_number: recipient.details.account_number,
                bank_name: recipient.details.bank_name,
                bank_code: recipient.details.bank_code,
                currency: recipient.currency,
                details: recipient,
            };
        } catch (error: any) {
            console.error('Paystack Create Recipient Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to create transfer recipient');
        }
    }

    /**
     * Initiate a transfer
     */
    async initiateTransfer(data: TransferData): Promise<TransferResponse> {
        try {
            const response = await axios.post(
                `${this.baseUrl}/transfer`,
                {
                    source: 'balance',
                    amount: data.amount,
                    recipient: data.recipient_code,
                    reference: data.reference,
                    reason: data.narration,
                },
                { headers: this.headers }
            );

            if (!response.data.status) {
                throw new Error(response.data.message);
            }

            const transfer = response.data.data;
            return {
                transfer_code: transfer.transfer_code,
                reference: transfer.reference,
                status: transfer.status,
                amount: transfer.amount,
                currency: transfer.currency,
                raw: transfer,
            };
        } catch (error: any) {
            console.error('Paystack Initiate Transfer Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to initiate transfer');
        }
    }

    /**
     * Verify Paystack Webhook Signature
     */
    verifySignature(signature: string, body: any): boolean {
        if (!paystack.webhookSecret) {
            console.error('PAYSTACK_WEBHOOK_SECRET is not set');
            return false;
        }
        const hash = crypto
            .createHmac('sha512', paystack.webhookSecret)
            .update(JSON.stringify(body))
            .digest('hex');
        return hash === signature;
    }

    /**
     * List all banks supported by Paystack
     * @param country - Country code (default: nigeria)
     */
    async getBanks(country: string = 'nigeria'): Promise<Bank[]> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/bank?country=${country}`,
                { headers: this.headers }
            );

            if (!response.data.status) {
                throw new Error(response.data.message);
            }

            return response.data.data.map((bank: any) => ({
                id: bank.id,
                code: bank.code,
                name: bank.name,
            }));
        } catch (error: any) {
            console.error('Paystack List Banks Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to fetch banks');
        }
    }

    /**
     * Resolve/verify a bank account number
     */
    async resolveAccountNumber(account_number: string, bank_code: string) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
                { headers: this.headers }
            );

            if (!response.data.status) {
                throw new Error(response.data.message);
            }

            return response.data.data;
        } catch (error: any) {
            console.error('Paystack Resolve Account Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to verify account');
        }
    }
}

export default new PaystackService();
