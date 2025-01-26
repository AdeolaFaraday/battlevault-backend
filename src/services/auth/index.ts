import * as admin from 'firebase-admin';
const firebaseConfig = require('../../battlevault-firebase-adminsdk-fbsvc-0d81ec765f.json');

admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig)
})
const firebaseAuth = admin.auth();

export default firebaseAuth