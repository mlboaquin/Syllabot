const admin = require('../config/firebase');
const crypto = require('crypto');

const db = admin.firestore();

// Encryption setup
const algorithm = 'aes-256-cbc';

// Derive a 32-byte key from the environment variable
function deriveKey(envKey) {
  return crypto.createHash('sha256')
    .update(String(envKey))
    .digest();
}

const key = deriveKey(process.env.ENCRYPTION_KEY);

function encrypt(text) {
  if (!text) return null; // Handle null/undefined tokens
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text) {
  if (!text) return null; // Handle null/undefined tokens
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function storeRefreshToken(userId, refreshToken) {
  try {
    const encryptedToken = encrypt(refreshToken);
    await db.collection('userTokens').doc(userId).set({
      refreshToken: encryptedToken,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error storing refresh token:', error);
    throw error;
  }
}

async function getUserRefreshToken(userId) {
  try {
    const doc = await db.collection('userTokens').doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    const encryptedToken = doc.data().refreshToken;
    return decrypt(encryptedToken);
  } catch (error) {
    console.error('Error retrieving refresh token:', error);
    throw error;
  }
}

// Export the database functions and the db reference
module.exports = {
  storeRefreshToken,
  getUserRefreshToken,
  db // Export the db reference
}; 