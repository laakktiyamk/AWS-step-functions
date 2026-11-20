"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdseNotConnectedError = void 0;
exports.getCdseTokenForUser = getCdseTokenForUser;
const cdseCredentialsService_1 = require("./cdseCredentialsService");
/** The user has not connected CDSE credentials (yet). */
class CdseNotConnectedError extends Error {
    constructor() {
        super("User has no CDSE credentials");
        this.name = "CdseNotConnectedError";
    }
}
exports.CdseNotConnectedError = CdseNotConnectedError;
/**
 * In-memory cache per Lambda container, keyed by userId.
 * Tokens are short-lived, so nothing is persisted (no SSM, no database).
 */
const cache = new Map();
const REFRESH_MARGIN_MS = 60000;
/**
 * Returns a CDSE access token for the user, fetched with the user's OWN
 * credentials. Throws CdseNotConnectedError when none are stored, or
 * CdseAuthError when CDSE rejects / cannot be reached.
 */
async function getCdseTokenForUser(userId) {
    const hit = cache.get(userId);
    if (hit && hit.expiresAt - Date.now() > REFRESH_MARGIN_MS)
        return hit.token;
    const creds = await (0, cdseCredentialsService_1.getCdseCredentials)(userId);
    if (!creds)
        throw new CdseNotConnectedError();
    const { accessToken, expiresInSec } = await (0, cdseCredentialsService_1.requestCdseToken)(creds);
    cache.set(userId, {
        token: accessToken,
        expiresAt: Date.now() + expiresInSec * 1000,
    });
    return accessToken;
}
