import * as admin from 'firebase-admin';

if (process.env.NODE_ENV === 'production') {
    console.log({ GOTINTO: 'production' })
    // Use Application Default Credentials in production (Cloud Run)
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'battlevault'
        });
    }
} else {
    console.log({ GOTINTO: 'development' })
    // Local development fallback
    try {
        const firebaseConfig = require('../../battlevault-firebase-adminsdk-fbsvc-3f44c40a73.json');
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseConfig as admin.ServiceAccount),
                projectId: 'battlevault'
            });
        }
    } catch (error) {
        console.warn('Local firebase service account file not found.');
    }
}

const firebaseAuth = admin.auth();

export { admin };
export default firebaseAuth