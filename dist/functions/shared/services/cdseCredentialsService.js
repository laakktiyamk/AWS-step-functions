"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdseAuthError = void 0;
exports.requestCdseToken = requestCdseToken;
exports.verifyCdseCredentials = verifyCdseCredentials;
exports.saveCdseCredentials = saveCdseCredentials;
exports.connectCdseCredentials = connectCdseCredentials;
exports.getCdseCredentials = getCdseCredentials;
exports.clearCdseCredentials = clearCdseCredentials;
const axios_1 = __importDefault(require("axios"));
// TODO: adjust the path to your actual user model
const User_1 = require("../mongo/models/User");
const cdseCrypto_1 = require("./cdseCrypto");
const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
/**
 * "invalid"     = CDSE rejected the credentials (user can fix them)
 * "unavailable" = CDSE could not be reached / returned 5xx (user should retry later)
 */
class CdseAuthError extends Error {
    constructor(kind, message) {
        super(message);
        this.kind = kind;
        this.name = "CdseAuthError";
    }
}
exports.CdseAuthError = CdseAuthError;
/**
 * Requests an OAuth token with the given credentials.
 * Throws CdseAuthError("invalid") when CDSE rejects them and
 * CdseAuthError("unavailable") on network errors / 5xx. Never logs the secret.
 */
async function requestCdseToken(creds) {
    let status;
    let data;
    try {
        const res = await axios_1.default.post(TOKEN_URL, new URLSearchParams({
            grant_type: "client_credentials",
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
        }).toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 10000,
            validateStatus: () => true, // handle status codes ourselves
        });
        status = res.status;
        data = res.data;
    }
    catch {
        throw new CdseAuthError("unavailable", "CDSE token endpoint unreachable");
    }
    const body = data;
    if (status === 200 &&
        typeof body?.access_token === "string" &&
        body.access_token.length > 0) {
        return {
            accessToken: body.access_token,
            expiresInSec: typeof body.expires_in === "number" ? body.expires_in : 600,
        };
    }
    if (status === 400 || status === 401) {
        throw new CdseAuthError("invalid", "CDSE rejected the credentials");
    }
    throw new CdseAuthError("unavailable", `CDSE token endpoint returned HTTP ${status}`);
}
/** Verifies the credentials by requesting an OAuth token (the token is discarded). */
async function verifyCdseCredentials(creds) {
    await requestCdseToken(creds);
}
/** Encrypts the secret and stores the credentials on the user document. */
async function saveCdseCredentials(userId, creds) {
    const cdseSecretEnc = await (0, cdseCrypto_1.encryptSecret)(creds.clientSecret, userId);
    const res = await User_1.User.updateOne({ _id: userId }, {
        $set: {
            cdseClientId: creds.clientId,
            cdseSecretEnc,
            cdseConnected: true,
            cdseVerifiedAt: new Date(),
        },
    });
    if (res.matchedCount === 0)
        throw new Error("User not found");
}
/**
 * Verifies the credentials with CDSE first, then stores them encrypted.
 * Nothing is stored if verification fails (throws CdseAuthError).
 */
async function connectCdseCredentials(userId, creds) {
    await verifyCdseCredentials(creds);
    await saveCdseCredentials(userId, creds);
}
/** Returns the decrypted credentials, or null if the user has none. */
async function getCdseCredentials(userId) {
    const user = await User_1.User.findById(userId).select("cdseClientId +cdseSecretEnc");
    if (!user?.cdseClientId || !user.cdseSecretEnc)
        return null;
    return {
        clientId: user.cdseClientId,
        clientSecret: await (0, cdseCrypto_1.decryptSecret)(user.cdseSecretEnc, userId),
    };
}
/** Removes the user's CDSE credentials. */
async function clearCdseCredentials(userId) {
    await User_1.User.updateOne({ _id: userId }, {
        $set: { cdseConnected: false },
        $unset: { cdseClientId: "", cdseSecretEnc: "", cdseVerifiedAt: "" },
    });
}
