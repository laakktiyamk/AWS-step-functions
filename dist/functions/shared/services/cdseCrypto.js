"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEncryptionKey = getEncryptionKey;
exports.encryptWithKey = encryptWithKey;
exports.decryptWithKey = decryptWithKey;
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
const node_crypto_1 = require("node:crypto");
const client_ssm_1 = require("@aws-sdk/client-ssm");
/**
 * Reversible encryption for CDSE client secrets (AES-256-GCM).
 *
 * Stored format:  v1.<iv>.<authTag>.<ciphertext>   (all base64)
 *  - "v1" = key version, makes key rotation possible later (v2, ...)
 *  - random 12-byte IV for every encryption
 *  - userId is bound in as AAD, so a ciphertext copied to another
 *    user's document fails authentication
 */
const VERSION = "v1";
const KEY_PARAM = process.env.CDSE_KEY_PARAM ?? "/ndvi/cdse-encryption-key";
const ssm = new client_ssm_1.SSMClient({});
let cachedKey = null;
/** One 32-byte key (base64) in one SSM SecureString parameter; cached per Lambda container. */
async function getEncryptionKey() {
    if (cachedKey)
        return cachedKey;
    const res = await ssm.send(new client_ssm_1.GetParameterCommand({ Name: KEY_PARAM, WithDecryption: true }));
    const key = Buffer.from(res.Parameter.Value, "base64");
    if (key.length !== 32) {
        throw new Error("CDSE encryption key must be 32 bytes (base64)");
    }
    cachedKey = key;
    return key;
}
function encryptWithKey(key, plaintext, userId) {
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(userId));
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}
function decryptWithKey(key, payload, userId) {
    const [version, ivB64, tagB64, ctB64] = payload.split(".");
    if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
        throw new Error("Unsupported or malformed ciphertext");
    }
    const decipher = (0, node_crypto_1.createDecipheriv)("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const pt = Buffer.concat([
        decipher.update(Buffer.from(ctB64, "base64")),
        decipher.final(), // throws if tampered / wrong key / wrong userId
    ]);
    return pt.toString("utf8");
}
async function encryptSecret(plaintext, userId) {
    return encryptWithKey(await getEncryptionKey(), plaintext, userId);
}
async function decryptSecret(payload, userId) {
    return decryptWithKey(await getEncryptionKey(), payload, userId);
}
