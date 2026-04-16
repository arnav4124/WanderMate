const admin = require('firebase-admin');

// Singleton pattern: initialize Firebase Admin SDK once
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}

const firebaseDB = admin.database();
const firebaseAuth = admin.auth();

module.exports = { admin, firebaseDB, firebaseAuth };
