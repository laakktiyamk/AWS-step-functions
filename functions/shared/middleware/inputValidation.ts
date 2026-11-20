import { body } from "express-validator";

/**
 * Shared password rules (registration and password reset).
 *
 * @remarks
 * `msg` values are machine-readable codes, not display text.
 * The frontend translates them with its own i18n files.
 */
const passwordRules = body("password")
  .isLength({ min: 8 }).withMessage("PASSWORD_TOO_SHORT")
  .matches(/[a-z]/).withMessage("PASSWORD_NO_LOWERCASE")
  .matches(/[A-Z]/).withMessage("PASSWORD_NO_UPPERCASE")
  .matches(/[0-9]/).withMessage("PASSWORD_NO_NUMBER")
  .matches(/[#?!&@\$%^*_\-]/).withMessage("PASSWORD_NO_SPECIAL");

/**
 * Validation rules for user registration.
 *
 * @remarks
 * - `email` is properly formatted
 * - `username` is between 3–25 characters
 * - `password` follows `passwordRules`
 */
export const registerValidation = [
  body("email")
    .trim()
    .escape()
    .isEmail().withMessage("EMAIL_INVALID"),

  body("username")
    .trim()
    .escape()
    .isLength({ min: 3, max: 25 }).withMessage("USERNAME_LENGTH"),

  passwordRules
];

/**
 * Validation rules for resetting a password (password only).
 */
export const resetPasswordValidation = [passwordRules];

/**
 * Validation rules for user login.
 *
 * @remarks
 * - `email` is a valid email format
 * - `password` is provided
 */
export const loginValidation = [
  body("email")
    .trim()
    .escape()
    .isEmail().withMessage("EMAIL_INVALID"),

  body("password")
    .exists().withMessage("PASSWORD_REQUIRED")
];