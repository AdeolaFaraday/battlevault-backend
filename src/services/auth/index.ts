import * as admin from 'firebase-admin';
const firebaseConfig = require('../../battlevault-firebase-adminsdk-fbsvc-3f44c40a73.json');

// admin.initializeApp({
//     credential: admin.credential.cert(firebaseConfig)
// })

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig as admin.ServiceAccount),
        projectId: 'battlevault'
    });
}

const firebaseAuth = admin.auth();

export { admin };
export default firebaseAuth