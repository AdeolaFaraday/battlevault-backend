import Wallet from "../../../models/wallet/wallet";
import ClientResponse from "../../../services/response";

export default class WalletService {
    private static formatWallet(wallet: any) {
        if (!wallet) return wallet;
        const formatted = wallet.toObject ? wallet.toObject() : wallet;
        if (formatted._id) formatted._id = formatted._id.toString();
        if (formatted.userId) formatted.userId = formatted.userId.toString();
        return formatted;
    }

    static async getWallet(userId: string) {
        try {
            // @ts-ignore
            const wallet = await Wallet.getOrCreateWallet(userId);
            return new ClientResponse(200, true, "Wallet retrieved successfully", this.formatWallet(wallet));
        } catch (error: any) {
            return new ClientResponse(500, false, error.message);
        }
    }
}
