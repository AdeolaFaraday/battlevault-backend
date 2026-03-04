import authenticatedRequest from "../../authenticatedRequest";
import ClientResponse from "../../../services/response";
import Bank from "../../../models/bank/bank";
import PaymentProviderFactory from "../../../services/payment";

const walletQueries = {
    getSavedBanks: authenticatedRequest(
        async (_: any, __: any, context: any) => {
            try {
                const banks = await Bank.find({ userId: context.currentUser._id }).sort({ createdAt: -1 });
                return new ClientResponse(200, true, 'Saved banks retrieved successfully', { banks, isLocal: true });
            } catch (error: any) {
                return new ClientResponse(400, false, error.message);
            }
        }
    ),

    listBanks: async () => {
        try {
            const paymentProvider = PaymentProviderFactory.getProvider();
            const banks = await paymentProvider.getBanks(process.env.COUNTRY_CODE || 'NG');
            return new ClientResponse(200, true, 'Banks retrieved successfully', { banks });
        } catch (error: any) {
            return new ClientResponse(400, false, error.message);
        }
    },

    verifyBankAccount: async (
        _: any,
        { accountNumber, bankCode }: { accountNumber: string; bankCode: string }
    ) => {
        try {
            const paymentProvider = PaymentProviderFactory.getProvider();
            const result = await paymentProvider.resolveAccountNumber(accountNumber, bankCode);
            return new ClientResponse(200, true, 'Account verified successfully', {
                accountNumber: result.account_number,
                accountName: result.account_name,
                bankId: result.bank_id
            });
        } catch (error: any) {
            return new ClientResponse(400, false, error.message);
        }
    }
};

export default walletQueries;

