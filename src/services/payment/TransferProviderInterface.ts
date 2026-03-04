export interface Bank {
    id: string | number;
    code: string;
    name: string;
}

export interface RecipientData {
    name: string;
    account_number: string;
    bank_code: string;
    currency?: string;
    metadata?: any;
}

export interface RecipientResponse {
    recipient_code: string;
    name: string;
    account_number: string;
    bank_name: string;
    bank_code: string;
    currency: string;
    details: any;
}

export interface TransferData {
    amount: number; // in minor units (kobo/cents)
    currency: string;
    narration: string;
    reference: string;
    recipient_code: string;
    bank_code?: string;      // Optional, used by some providers like Flutterwave
    account_number?: string; // Optional, used by some providers like Flutterwave
}

export interface TransferResponse {
    transfer_code: string;
    reference: string;
    status: string;
    amount: number;
    currency: string;
    raw: any;
}

export interface TransferProviderInterface {
    getBanks(countryCode: string): Promise<Bank[]>;
    createRecipient(data: RecipientData): Promise<RecipientResponse>;
    initiateTransfer(data: TransferData): Promise<TransferResponse>;
    resolveAccountNumber(accountNumber: string, bankCode: string): Promise<any>;
}
