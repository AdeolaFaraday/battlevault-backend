import PaystackService from '../paystack';
import FlutterwaveService from './FlutterwaveTransferService';
import { TransferProviderInterface } from './TransferProviderInterface';

class PaymentProviderFactory {
    private static instance: TransferProviderInterface | null = null;

    static getProvider(): TransferProviderInterface {
        if (!this.instance) {
            const providerType = process.env.PAYMENT_PROVIDER || 'flutterwave';

            switch (providerType.toLowerCase()) {
                case 'paystack':
                    this.instance = PaystackService;
                    break;
                case 'flutterwave':
                    this.instance = FlutterwaveService;
                    break;
                default:
                    this.instance = PaystackService;
            }
        }

        return this.instance!;
    }
}

export default PaymentProviderFactory;
export { TransferProviderInterface };
