"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEmailUser = exports.loginUser = exports.registerUser = void 0;
const express_validator_1 = require("express-validator");
const userAuthService_1 = require("../services/userAuthService");
const tokenService_1 = require("../services/tokenService");
const emailService_1 = require("../services/emailService");
const emailTemplates_1 = require("../services/emailTemplates");
const tokenService_2 = require("../services/tokenService");
const User_1 = require("../mongo/models/User");
/* =======================================================
   REGISTER USER
   ------------------------------------------------------- */
/**
 * Registers a new user account.
 *
 * @remarks
 * This controller:
 * - validates request body using `express-validator`
 * - checks whether the email is already in use
 * - creates a new user in the database
 * - returns a sanitized user object (no password)
 *
 * Validation errors return `400 Bad Request`.
 * Duplicate emails return `403 Forbidden`.
 *
 * @param req - Express request containing `email`, `password`, and `username`.
 * @param res - Express response returning the created user.
 *
 * @returns A JSON response with the new user or an error message.
 */
const registerUser = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password, username } = req.body;
    try {
        const existing = await (0, userAuthService_1.findUserByEmail)(email);
        if (existing) {
            return res.status(403).json({ message: "Email already in use" });
        }
        const newUser = await (0, userAuthService_1.registerUserInDb)(email, password, username);
        // Vahvistuslinkki sähköpostiin. Viestin epäonnistuminen ei kaada rekisteröintiä.
        try {
            const token = await (0, tokenService_1.createEmailToken)(newUser._id, "verify_email");
            const link = `${process.env.APP_URL}/verify-email?token=${token}`;
            const t = (0, emailTemplates_1.getTemplates)((0, emailTemplates_1.resolveLang)(req.body.lang));
            await (0, emailService_1.sendEmail)(newUser.email, t.verifySubject, t.verifyBody(newUser.username, link, 60));
        }
        catch (mailErr) {
            console.error("Verification email error:", mailErr);
        }
        return res.status(201).json({
            message: "User registered. Check your email to verify your account.",
            user: {
                id: newUser._id,
                email: newUser.email,
                username: newUser.username
            }
        });
    }
    catch (err) {
        console.error("Register error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.registerUser = registerUser;
/* =======================================================
   LOGIN USER
   ------------------------------------------------------- */
/**
 * Authenticates a user and returns a JWT token.
 *
 * @remarks
 * This controller:
 * - validates request body using `express-validator`
 * - checks whether the user exists
 * - verifies the password using `validatePassword`
 * - generates a JWT token using `createJwtToken`
 * - returns the token and user profile data
 *
 * Incorrect credentials return `401 Unauthorized`.
 * Missing users return `404 Not Found`.
 *
 * @param req - Express request containing `email` and `password`.
 * @param res - Express response returning the JWT and user info.
 *
 * @returns A JSON response with `{ token, user }` or an error message.
 */
const loginUser = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    console.log("Login request received for email:", req.body.email);
    try {
        const { email, password } = req.body;
        const user = await (0, userAuthService_1.findUserByEmail)(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const match = await (0, userAuthService_1.validatePassword)(password, user.password);
        if (!match) {
            return res.status(401).json({ message: "Incorrect password" });
        }
        if (!user.verified) {
            return res.status(403).json({
                code: "EMAIL_NOT_VERIFIED",
                message: "Email address not verified"
            });
        }
        const token = (0, userAuthService_1.createJwtToken)(user);
        return res.status(200).json({
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username
            }
        });
    }
    catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.loginUser = loginUser;
const verifyEmailUser = async (req, res) => {
    const { token } = req.body;
    if (typeof token !== "string" || token.length !== 64) {
        return res.status(400).json({ message: "Invalid or expired link" });
    }
    try {
        const userId = await (0, tokenService_2.consumeEmailToken)(token, "verify_email");
        if (!userId) {
            return res.status(400).json({ message: "Invalid or expired link" });
        }
        await User_1.User.updateOne({ _id: userId }, { $set: { verified: true } });
        return res.status(200).json({ ok: true });
    }
    catch (err) {
        console.error("Verify email error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.verifyEmailUser = verifyEmailUser;
