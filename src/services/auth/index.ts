import * as admin from 'firebase-admin';
const firebaseConfig = require('../../battlevault-firebase-adminsdk-fbsvc-30a27ad456.json');

admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig)
})
const firebaseAuth = admin.auth();

export default firebaseAuth