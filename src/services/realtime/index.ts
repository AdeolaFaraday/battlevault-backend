import { RealtimeProvider } from './RealtimeProvider';
import { FirebaseRealtimeProvider } from './FirebaseRealtimeProvider';

/**
 * Factory to get the configured realtime provider
 * This allows easy switching between Firebase, Socket.IO, etc.
 */
class RealtimeProviderFactory {
    private static instance: RealtimeProvider | null = null;

    static getProvider(): RealtimeProvider {
        if (!this.instance) {
            // For now, default to Firebase
            // Later, this can be configured via environment variable
            const providerType = process.env.REALTIME_PROVIDER || 'firebase';

            switch (providerType.toLowerCase()) {
                case 'firebase':
                    this.instance = new FirebaseRealtimeProvider();
                    break;
                // case 'socketio':
                //     this.instance = new SocketIORealtimeProvider();
                //     break;
                default:
                    this.instance = new FirebaseRealtimeProvider();
            }
        }

        return this.instance;
    }

    static async initialize(): Promise<void> {
        const provider = this.getProvider();
        await provider.initialize();
    }
}

export default RealtimeProviderFactory;
