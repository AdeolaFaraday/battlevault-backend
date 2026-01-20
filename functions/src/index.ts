
import * as admin from 'firebase-admin';

// Initialize Firebase Admin globally for all functions
admin.initializeApp();

export { syncGameToMongo } from './syncGameToMongo';
