import axios from "axios";
// TODO: adjust the path to your actual user model
import { User } from "../mongo/models/User";
import { encryptSecret, decryptSecret } from "./cdseCrypto";

const TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

export interface CdseCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * "invalid"     = CDSE rejected the credentials (user can fix them)
 * "unavailable" = CDSE could not be reached / returned 5xx (user should retry later)
 */
export class CdseAuthError extends Error {
  constructor(
    public readonly kind: "invalid" | "unavailable",
    message: string
  ) {
    super(message);
    this.name = "CdseAuthError";
  }
}

/**
 * Requests an OAuth token with the given credentials.
 * Throws CdseAuthError("invalid") when CDSE rejects them and
 * CdseAuthError("unavailable") on network errors / 5xx. Never logs the secret.
 */
export async function requestCdseToken(
  creds: CdseCredentials
): Promise<{ accessToken: string; expiresInSec: number }> {
  let status: number;
  let data: unknown;

  try {
    const res = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10_000,
        validateStatus: () => true, // handle status codes ourselves
      }
    );
    status = res.status;
    data = res.data;
  } catch {
    throw new CdseAuthError("unavailable", "CDSE token endpoint unreachable");
  }

  const body = data as { access_token?: unknown; expires_in?: unknown } | undefined;
  if (
    status === 200 &&
    typeof body?.access_token === "string" &&
    body.access_token.length > 0
  ) {
    return {
      accessToken: body.access_token,
      expiresInSec: typeof body.expires_in === "number" ? body.expires_in : 600,
    };
  }

  if (status === 400 || status === 401) {
    throw new CdseAuthError("invalid", "CDSE rejected the credentials");
  }
  throw new CdseAuthError(
    "unavailable",
    `CDSE token endpoint returned HTTP ${status}`
  );
}

/** Verifies the credentials by requesting an OAuth token (the token is discarded). */
export async function verifyCdseCredentials(
  creds: CdseCredentials
): Promise<void> {
  await requestCdseToken(creds);
}

/** Encrypts the secret and stores the credentials on the user document. */
export async function saveCdseCredentials(
  userId: string,
  creds: CdseCredentials
): Promise<void> {
  const cdseSecretEnc = await encryptSecret(creds.clientSecret, userId);
  const res = await User.updateOne(
    { _id: userId },
    {
      $set: {
        cdseClientId: creds.clientId,
        cdseSecretEnc,
        cdseConnected: true,
        cdseVerifiedAt: new Date(),
      },
    }
  );
  if (res.matchedCount === 0) throw new Error("User not found");
}

/**
 * Verifies the credentials with CDSE first, then stores them encrypted.
 * Nothing is stored if verification fails (throws CdseAuthError).
 */
export async function connectCdseCredentials(
  userId: string,
  creds: CdseCredentials
): Promise<void> {
  await verifyCdseCredentials(creds);
  await saveCdseCredentials(userId, creds);
}

/** Returns the decrypted credentials, or null if the user has none. */
export async function getCdseCredentials(
  userId: string
): Promise<CdseCredentials | null> {
  const user = await User.findById(userId).select("cdseClientId +cdseSecretEnc");
  if (!user?.cdseClientId || !user.cdseSecretEnc) return null;
  return {
    clientId: user.cdseClientId,
    clientSecret: await decryptSecret(user.cdseSecretEnc, userId),
  };
}

/** Removes the user's CDSE credentials. */
export async function clearCdseCredentials(userId: string): Promise<void> {
  await User.updateOne(
    { _id: userId },
    {
      $set: { cdseConnected: false },
      $unset: { cdseClientId: "", cdseSecretEnc: "", cdseVerifiedAt: "" },
    }
  );
}
