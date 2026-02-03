import axios from 'axios';
import crypto from 'crypto';
import { paystack } from '../config/environment';

class PaystackService {
    private readonly baseUrl = 'https://api.paystack.co';

    private get headers() {
        return {
            Authorization: `Bearer ${paystack.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Create a transfer recipient
     * @param name - Full name of the recipient
     * @param account_number - Bank account number
     * @param bank_code - 3-digit bank code
     * @param currency - Currency (default: NGN)
     */
    async createRecipient(
        name: string,
        account_number: string,
        bank_code: string,
        currency: string = 'NGN'
    ) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/transferrecipient`,
                {
                    type: 'nuban',
                    name,
                    account_number,
                    bank_code,
                    currency,
                },
                { headers: this.headers }
            );

            if (!response.data.status) {
                throw new Error(response.data.message);
            }

            return response.data.data;
        } catch (error: any) {
            console.error('Paystack Create Recipient Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to create transfer recipient');
        }
    }

    /**
     * Initiate a transfer
     * @param amount - Amount in kobo (NGN * 100)
     * @param recipient - Recipient code
     * @param reference - Unique transfer reference
     * @param reason - Reason for transfer
     */
    async initiateTransfer(
        amount: number,
        recipient: string,
        reference: string,
        reason: string = 'Withdrawal'
    ) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/transfer`,
                {
                    source: 'balance',
                    amount,
                    recipient,
                    reference,
                    reason,
                },
                { headers: this.headers }
            );

            if (!response.data.status) {
                throw new Error(response.data.message);
            }

            return response.data.data;
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
    async listBanks(country: string = 'nigeria') {
        try {
            const response = await axios.get(
                `${this.baseUrl}/bank?country=${country}`,
                { headers: this.headers }
            );

            if (!response.data.status) {
                throw new Error(response.data.message);
            }

            return response.data.data;
        } catch (error: any) {
            console.error('Paystack List Banks Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to fetch banks');
        }
    }

    /**
     * Resolve/verify a bank account number
     * @param account_number - Bank account number
     * @param bank_code - Bank code
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
