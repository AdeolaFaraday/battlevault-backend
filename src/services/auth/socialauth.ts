import firebaseAuth from "./index";

export default class SocialAuthService {
    static async verifyToken(token: string) {
        const data = await firebaseAuth.verifyIdToken(token)
        return data
    }
}