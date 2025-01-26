import firebaseAuth from "./index";

export default class SocialAuthService {
    static verifyToken(token: string) {
        const data = firebaseAuth.verifyIdToken(token)
        return data
    }
}