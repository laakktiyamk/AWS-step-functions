import { getCdseCredentials, requestCdseToken } from "./cdseCredentialsService";

/** The user has not connected CDSE credentials (yet). */
export class CdseNotConnectedError extends Error {
  constructor() {
    super("User has no CDSE credentials");
    this.name = "CdseNotConnectedError";
  }
}

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

/**
 * In-memory cache per Lambda container, keyed by userId.
 * Tokens are short-lived, so nothing is persisted (no SSM, no database).
 */
const cache = new Map<string, CachedToken>();
const REFRESH_MARGIN_MS = 60_000;

/**
 * Returns a CDSE access token for the user, fetched with the user's OWN
 * credentials. Throws CdseNotConnectedError when none are stored, or
 * CdseAuthError when CDSE rejects / cannot be reached.
 */
export async function getCdseTokenForUser(userId: string): Promise<string> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt - Date.now() > REFRESH_MARGIN_MS) return hit.token;

  const creds = await getCdseCredentials(userId);
  if (!creds) throw new CdseNotConnectedError();

  const { accessToken, expiresInSec } = await requestCdseToken(creds);
  cache.set(userId, {
    token: accessToken,
    expiresAt: Date.now() + expiresInSec * 1000,
  });
  return accessToken;
}
