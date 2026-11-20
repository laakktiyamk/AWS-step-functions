import mongoose, { Document, Schema } from "mongoose";


/**
 * Represents a user account stored in MongoDB.
 *
 * @remarks
 * This model contains:
 * - authentication fields (`email`, `password`)
 * - profile information (`username`)
 * - the user's own CDSE (Copernicus Data Space Ecosystem) credentials
 *
 * Passwords are stored as hashed strings (handled in the service layer).
 * The CDSE client secret is stored encrypted (AES-256-GCM, see cdseCrypto).
 * The model does not include any business logic — it is a pure data schema.
 */
interface IUser extends Document {
  /** User's unique email address. */
  email: string;

  /** Hashed password string. */
  password: string;

  /** Public username displayed in the UI. */
  username: string;  
  
  /** True once the email address has been confirmed via the link. */
  verified: boolean;

  /**
   * Deadline for confirming the email address.
   * Set at registration and removed ($unset) when the email is verified.
   * MongoDB's TTL index deletes the document once this date has passed,
   * so unverified registrations (and the encrypted CDSE credentials
   * stored with them) disappear automatically.
   */
  verifyExpiresAt?: Date;

  /** CDSE OAuth client id (not secret). */
  cdseClientId?: string;

  /**
   * CDSE OAuth client secret, encrypted (format `v1.<iv>.<tag>.<ciphertext>`).
   * Not selected by default: read it explicitly with `.select("+cdseSecretEnc")`.
   */
  cdseSecretEnc?: string;

  /** True once the credentials have been verified by fetching a token. */
  cdseConnected: boolean;

  /** When the credentials were last verified. */
  cdseVerifiedAt?: Date;
}

/**
 * Mongoose schema defining the structure of a user document.
 *
 * @remarks
 * Includes:
 * - unique email constraint
 * - required fields
 * - TTL index on `verifyExpiresAt` (expireAfterSeconds: 0 = delete at that date)
 */
const UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, required: true },  
  verified: { type: Boolean, default: false },

  verifyExpiresAt: { type: Date, index: { expireAfterSeconds: 0 } },

  cdseClientId: { type: String, unique: true, sparse: true },
  cdseSecretEnc: { type: String, select: false },
  cdseConnected: { type: Boolean, default: false },
  cdseVerifiedAt: { type: Date }
});

/**
 * Mongoose model for users.
 */

const UserModel: mongoose.Model<IUser> = mongoose.model<IUser>("User", UserSchema);

export { UserModel as User, IUser };