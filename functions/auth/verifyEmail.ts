import { consumeEmailToken } from "../shared/services/tokenService";
import { User } from "../shared/mongo/models/User";
import { connectDb } from "../shared/mongo/db";

const json = (statusCode: number, body: object) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event: any) => {
  try {
    const { token } = JSON.parse(event.body || "{}");
    if (typeof token !== "string" || token.length !== 64) {
      return json(400, { error: "Virheellinen tai vanhentunut linkki" });
    }

    await connectDb();

    const userId = await consumeEmailToken(token, "verify_email");
    if (!userId) {
      return json(400, { error: "Virheellinen tai vanhentunut linkki" });
    }

    await User.updateOne({ _id: userId }, { $set: { verified: true } }); // OLETUS: kenttä "verified"

    return json(200, { ok: true });
  } catch (err) {
    console.error("verify-email-virhe:", err);
    return json(500, { error: "Palvelinvirhe" });
  }
};