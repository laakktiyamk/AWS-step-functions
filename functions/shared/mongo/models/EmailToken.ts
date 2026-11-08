import { Schema, model, Types } from "mongoose";

export type TokenPurpose = "verify_email" | "password_reset";

interface IEmailToken {
  userId: Types.ObjectId;
  tokenHash: string;
  purpose: TokenPurpose;
  expiresAt: Date;
}

const emailTokenSchema = new Schema<IEmailToken>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  purpose: {
    type: String,
    enum: ["verify_email", "password_reset"],
    required: true,
  },
  expiresAt: { type: Date, required: true },
});

// Mongo poistaa dokumentin itse, kun expiresAt on mennyt
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailToken = model<IEmailToken>("EmailToken", emailTokenSchema);