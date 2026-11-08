import crypto from "crypto";
import { Types } from "mongoose";
import { EmailToken, TokenPurpose } from "../mongo/models/EmailToken";

const TTL_MINUTES: Record<TokenPurpose, number> = {
  verify_email: 60,
  password_reset: 30,
};

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createEmailToken(
  userId: Types.ObjectId | string,
  purpose: TokenPurpose
): Promise<string> {
  // Vanhat saman tarkoituksen tokenit pois, jotta uusi lähetys mitätöi edellisen
  await EmailToken.deleteMany({ userId, purpose });

  const token = crypto.randomBytes(32).toString("hex");

  await EmailToken.create({
    userId,
    tokenHash: hashToken(token),
    purpose,
    expiresAt: new Date(Date.now() + TTL_MINUTES[purpose] * 60 * 1000),
  });

  return token; // palautetaan vain kerran, linkkiin
}

export async function consumeEmailToken(
  token: string,
  purpose: TokenPurpose
): Promise<Types.ObjectId | null> {
  // Haetaan ja poistetaan yhdellä operaatiolla, joten token on kertakäyttöinen
  // myös silloin, kun kaksi pyyntöä tulee yhtä aikaa
  const doc = await EmailToken.findOneAndDelete({
    tokenHash: hashToken(token),
    purpose,
    expiresAt: { $gt: new Date() }, // TTL-poisto ei ole sekunnintarkka
  });

  return doc ? doc.userId : null;
}