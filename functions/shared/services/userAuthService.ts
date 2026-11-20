import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { User } from "../mongo/models/User";



/**
 * Finds a user by their email address.
 *
 * @remarks
 * This function is typically used during login and registration
 * to check whether a user already exists.
 *
 * @param email - The email address to search for.
 *
 * @returns The user document if found, otherwise `null`.
 */
export async function findUserByEmail(email: string) {
  return User.findOne({ email });
}

/**
 * Registers a new user in the database.
 *
 * @remarks
 * This function:
 * - hashes the password using bcrypt
 * - creates a new user document
 * - saves it to MongoDB
 *
 * Email uniqueness is enforced by the schema.
 *
 * @param email - The user's email address.
 * @param password - The user's plaintext password.
 * @param username - The user's chosen username.
 *
 * @returns The newly created user document.
 */
export async function registerUserInDb(
  email: string,
  password: string,
  username: string
) {
  const hashed = await bcrypt.hash(password, 10);

  const newUser = new User({
    email,
    password: hashed,
    username
  });

  return newUser.save();
}

/**
 * Valid bcrypt hash (cost 10) used to equalize login timing when the
 * user does not exist. The result of the comparison is always discarded.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("timing-equalizer", 10);


/**
 * Validates a plaintext password against a stored bcrypt hash.
 *
 * @remarks
 * Used during login to verify user credentials.
 *
 * @param password - The plaintext password provided by the user.
 * @param hashed - The stored bcrypt hash from the database.
 *
 * @returns `true` if the password matches, otherwise `false`.
 */
export async function validatePassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}

/**
 * Creates a signed JWT token for an authenticated user.
 *
 * @remarks
 * The token includes:
 * - `_id`
 * - `username`
 *
 * and is signed using the server's secret key.
 *
 * The token expires in **1 hour**.
 *
 * @param user - The user object containing `_id` and `username`.
 *
 * @returns A signed JWT token string.
 */
export function createJwtToken(user: any) {
  return jwt.sign(
    {
      _id: user._id,
      username: user.username
    },
    process.env.SECRET as string,
    { expiresIn: "1h" }
  );
}

/**
 * Replaces the user's password with a new bcrypt hash.
 *
 * @param userId - The user's id.
 * @param newPassword - The new plaintext password.
 *
 * @returns `true` if a user was updated, otherwise `false`.
 */
export async function updatePasswordInDb(
  userId: string,
  newPassword: string
): Promise<boolean> {
  const hashed = await bcrypt.hash(newPassword, 10);
  const res = await User.updateOne({ _id: userId }, { $set: { password: hashed } });
  return res.matchedCount > 0;
}