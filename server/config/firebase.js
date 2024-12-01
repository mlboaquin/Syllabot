const admin = require('firebase-admin');
const serviceAccount = require('../firebase-admin-sdk.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin; 