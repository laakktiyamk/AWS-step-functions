import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

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

const ssm = new SSMClient({});
let cachedKey: Buffer | null = null;

/** One 32-byte key (base64) in one SSM SecureString parameter; cached per Lambda container. */
export async function getEncryptionKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;
  const res = await ssm.send(
    new GetParameterCommand({ Name: KEY_PARAM, WithDecryption: true })
  );
  const key = Buffer.from(res.Parameter!.Value!, "base64");
  if (key.length !== 32) {
    throw new Error("CDSE encryption key must be 32 bytes (base64)");
  }
  cachedKey = key;
  return key;
}

export function encryptWithKey(
  key: Buffer,
  plaintext: string,
  userId: string
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decryptWithKey(
  key: Buffer,
  payload: string,
  userId: string
): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Unsupported or malformed ciphertext");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(), // throws if tampered / wrong key / wrong userId
  ]);
  return pt.toString("utf8");
}

export async function encryptSecret(plaintext: string, userId: string) {
  return encryptWithKey(await getEncryptionKey(), plaintext, userId);
}

export async function decryptSecret(payload: string, userId: string) {
  return decryptWithKey(await getEncryptionKey(), payload, userId);
}
