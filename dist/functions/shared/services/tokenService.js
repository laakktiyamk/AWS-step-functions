"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = hashToken;
exports.createEmailToken = createEmailToken;
exports.consumeEmailToken = consumeEmailToken;
const crypto_1 = __importDefault(require("crypto"));
const EmailToken_1 = require("../mongo/models/EmailToken");
const TTL_MINUTES = {
    verify_email: 60,
    password_reset: 30,
};
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
async function createEmailToken(userId, purpose) {
    // Vanhat saman tarkoituksen tokenit pois, jotta uusi lähetys mitätöi edellisen
    await EmailToken_1.EmailToken.deleteMany({ userId, purpose });
    const token = crypto_1.default.randomBytes(32).toString("hex");
    await EmailToken_1.EmailToken.create({
        userId,
        tokenHash: hashToken(token),
        purpose,
        expiresAt: new Date(Date.now() + TTL_MINUTES[purpose] * 60 * 1000),
    });
    return token; // palautetaan vain kerran, linkkiin
}
async function consumeEmailToken(token, purpose) {
    // Haetaan ja poistetaan yhdellä operaatiolla, joten token on kertakäyttöinen
    // myös silloin, kun kaksi pyyntöä tulee yhtä aikaa
    const doc = await EmailToken_1.EmailToken.findOneAndDelete({
        tokenHash: hashToken(token),
        purpose,
        expiresAt: { $gt: new Date() }, // TTL-poisto ei ole sekunnintarkka
    });
    return doc ? doc.userId : null;
}
