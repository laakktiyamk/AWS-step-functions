"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.resetPassword = exports.forgotPassword = exports.getCdseStatus = exports.deleteCdseCredentials = exports.updateCdseCredentials = exports.verifyEmailUser = exports.loginUser = exports.registerUser = void 0;
const express_validator_1 = require("express-validator");
const userAuthService_1 = require("../services/userAuthService");
const tokenService_1 = require("../services/tokenService");
const emailService_1 = require("../services/emailService");
const emailTemplates_1 = require("../services/emailTemplates");
const tokenService_2 = require("../services/tokenService");
const User_1 = require("../mongo/models/User");
const cdseCredentialsService_1 = require("../services/cdseCredentialsService");
const mongodb_1 = require("../mongo/mongodb");
const fieldService_1 = require("../services/fieldService");
const Job_1 = require("../mongo/models/Job");
/**
 * How long the email verification link is valid (minutes).
 * Must match the lifetime of the "verify_email" token in tokenService.
 */
const VERIFY_WINDOW_MIN = 60;
/**
 * The unverified user document (with its encrypted CDSE credentials) is
 * deleted automatically by the TTL index at this age. The small margin
 * prevents a race where a link used just before expiry finds the user gone.
 */
const VERIFY_TTL_MARGIN_MIN = 5;
const MAX_CDSE_FIELD_LEN = 200;
const isValidCdseField = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= MAX_CDSE_FIELD_LEN;
const toErrorList = (errors) => errors.array().map((e) => ({
    path: "path" in e ? e.path : undefined,
    msg: e.msg
}));
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
 * - verifies the user's own CDSE credentials by fetching a token
 *   (before anything is stored)
 * - creates a new user in the database
 * - stores the CDSE secret encrypted and sets the verification deadline
 *   (`verifyExpiresAt`, removed when the email is verified)
 * - returns a sanitized user object (no password)
 *
 * Validation errors return `400 Bad Request`.
 * Duplicate emails return `403 Forbidden`.
 * Rejected CDSE credentials return `422`, CDSE unreachable returns `503`.
 *
 * @param req - Express request containing `email`, `password`, `username`,
 *              `clientId` and `clientSecret` (CDSE OAuth client).
 * @param res - Express response returning the created user.
 *
 * @returns A JSON response with the new user or an error message.
 */
const registerUser = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: toErrorList(errors) });
    }
    const { email, password, username, clientId, clientSecret } = req.body;
    if (!isValidCdseField(clientId) || !isValidCdseField(clientSecret)) {
        return res.status(400).json({ code: "CDSE_BAD_REQUEST" });
    }
    const cdseCreds = {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim()
    };
    try {
        const existing = await (0, userAuthService_1.findUserByEmail)(email);
        if (existing) {
            return res.status(403).json({ message: "Email already in use" });
        }
        const clientIdTaken = await User_1.User.exists({ cdseClientId: cdseCreds.clientId });
        if (clientIdTaken) {
            return res.status(409).json({ code: "CDSE_ALREADY_IN_USE" });
        }
        // 1) Verify the CDSE credentials BEFORE creating the user
        try {
            await (0, cdseCredentialsService_1.verifyCdseCredentials)(cdseCreds);
        }
        catch (err) {
            if (err instanceof cdseCredentialsService_1.CdseAuthError) {
                return err.kind === "invalid"
                    ? // 422 (not 401) so the frontend does not treat it as an expired session
                        res.status(422).json({ code: "CDSE_INVALID_CREDENTIALS" })
                    : res.status(503).json({ code: "CDSE_UNAVAILABLE" });
            }
            throw err;
        }
        const newUser = await (0, userAuthService_1.registerUserInDb)(email, password, username);
        // 2) Deadline first (so a partial failure still cleans itself up via TTL),
        //    then the encrypted credentials. On failure the new user is rolled back.
        try {
            await User_1.User.updateOne({ _id: newUser._id }, {
                $set: {
                    verifyExpiresAt: new Date(Date.now() + (VERIFY_WINDOW_MIN + VERIFY_TTL_MARGIN_MIN) * 60000)
                }
            });
            await (0, cdseCredentialsService_1.saveCdseCredentials)(String(newUser._id), cdseCreds);
        }
        catch (saveErr) {
            console.error("CDSE credentials save failed:", saveErr instanceof Error ? saveErr.message : "unknown error");
            await User_1.User.deleteOne({ _id: newUser._id });
            return res.status(500).json({ message: "Server error" });
        }
        // Vahvistuslinkki sähköpostiin. Viestin epäonnistuminen ei kaada rekisteröintiä.
        try {
            const token = await (0, tokenService_1.createEmailToken)(newUser._id, "verify_email");
            const link = `${process.env.APP_URL}/verify-email?token=${token}`;
            const t = (0, emailTemplates_1.getTemplates)((0, emailTemplates_1.resolveLang)(req.body.lang));
            await (0, emailService_1.sendEmail)(newUser.email, t.verifySubject, t.verifyBody(newUser.username, link, VERIFY_WINDOW_MIN));
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
 * - compares the password against the stored hash, or against a dummy hash
 *   when the user does not exist, so response time does not reveal whether
 *   the email is registered
 * - checks that the email address is verified (only after the password
 *   was correct)
 * - generates a JWT token using `createJwtToken`
 * - returns the token and user profile data
 *
 * Validation errors return `400 Bad Request`.
 * Unknown email or wrong password both return `401` with the code
 * `INVALID_CREDENTIALS`.
 * A correct password with an unverified email returns `403` with the code
 * `EMAIL_NOT_VERIFIED`.
 *
 * @param req - Express request containing `email` and `password`.
 * @param res - Express response returning the JWT and user info.
 *
 * @returns A JSON response with `{ token, user }` or an error code.
 */
const loginUser = async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: toErrorList(errors) });
    }
    //console.log("Login request received for email:", req.body.email);
    try {
        const { email, password } = req.body;
        const user = await (0, userAuthService_1.findUserByEmail)(email);
        // Always run one bcrypt comparison so response time does not reveal
        // whether the email exists
        const match = await (0, userAuthService_1.validatePassword)(password, user?.password ?? userAuthService_1.DUMMY_PASSWORD_HASH);
        if (!user || !match) {
            return res.status(401).json({ code: "INVALID_CREDENTIALS" });
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
        return res.status(400).json({ code: "INVALID_OR_EXPIRED_TOKEN" });
    }
    try {
        const userId = await (0, tokenService_2.consumeEmailToken)(token, "verify_email");
        if (!userId) {
            return res.status(400).json({ code: "INVALID_OR_EXPIRED_TOKEN" });
        }
        // Verified: mark the user and remove the deadline so the TTL index no longer applies
        const result = await User_1.User.updateOne({ _id: userId }, { $set: { verified: true }, $unset: { verifyExpiresAt: "" } });
        if (result.matchedCount === 0) {
            // the unverified user was already removed by the TTL index
            return res.status(400).json({ code: "INVALID_OR_EXPIRED_TOKEN" });
        }
        return res.status(200).json({ ok: true });
    }
    catch (err) {
        console.error("Verify email error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.verifyEmailUser = verifyEmailUser;
const updateCdseCredentials = async (req, res) => {
    const userId = req.user?._id;
    if (!userId)
        return res.status(401).json({ code: "UNAUTHORIZED" });
    const { clientId, clientSecret } = req.body;
    if (!isValidCdseField(clientId) || !isValidCdseField(clientSecret)) {
        return res.status(400).json({ code: "CDSE_BAD_REQUEST" });
    }
    try {
        const taken = await User_1.User.exists({
            cdseClientId: clientId.trim(),
            _id: { $ne: userId }
        });
        if (taken) {
            return res.status(409).json({ code: "CDSE_ALREADY_IN_USE" });
        }
        await (0, cdseCredentialsService_1.connectCdseCredentials)(String(userId), {
            clientId: clientId.trim(),
            clientSecret: clientSecret.trim()
        });
        return res.status(200).json({ code: "CDSE_CONNECTED" });
    }
    catch (err) {
        if (err instanceof cdseCredentialsService_1.CdseAuthError) {
            return err.kind === "invalid"
                ? res.status(422).json({ code: "CDSE_INVALID_CREDENTIALS" })
                : res.status(503).json({ code: "CDSE_UNAVAILABLE" });
        }
        console.error("CDSE update error:", err instanceof Error ? err.message : "unknown error");
        return res.status(500).json({ message: "Server error" });
    }
};
exports.updateCdseCredentials = updateCdseCredentials;
const deleteCdseCredentials = async (req, res) => {
    const userId = req.user?._id;
    if (!userId)
        return res.status(401).json({ code: "UNAUTHORIZED" });
    try {
        await (0, cdseCredentialsService_1.clearCdseCredentials)(String(userId));
        return res.status(200).json({ code: "CDSE_DISCONNECTED" });
    }
    catch (err) {
        console.error("CDSE delete error:", err instanceof Error ? err.message : "unknown error");
        return res.status(500).json({ message: "Server error" });
    }
};
exports.deleteCdseCredentials = deleteCdseCredentials;
const getCdseStatus = async (req, res) => {
    const userId = req.user?._id;
    if (!userId)
        return res.status(401).json({ code: "UNAUTHORIZED" });
    try {
        const user = await User_1.User.findById(String(userId))
            .select("cdseConnected cdseVerifiedAt")
            .lean();
        if (!user)
            return res.status(401).json({ code: "UNAUTHORIZED" });
        return res.status(200).json({
            connected: user.cdseConnected === true,
            verifiedAt: user.cdseVerifiedAt ?? null
        });
    }
    catch (err) {
        console.error("CDSE status error:", err instanceof Error ? err.message : "unknown error");
        return res.status(500).json({ message: "Server error" });
    }
};
exports.getCdseStatus = getCdseStatus;
const RESET_WINDOW_MIN = 30; // sama kuin password_reset TTL tokenService.ts:ssä
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (typeof email !== "string" || email.length === 0) {
        return res.status(400).json({ code: "EMAIL_REQUIRED" });
    }
    // Sama vastaus riippumatta siitä, löytyykö osoite, jotta rajapinnasta
    // ei näe mitkä sähköpostit on rekisteröity
    const okResponse = () => res.status(200).json({ message: "If the email exists, a reset link has been sent." });
    try {
        const user = await (0, userAuthService_1.findUserByEmail)(email.trim());
        if (!user || !user.verified)
            return okResponse();
        try {
            const token = await (0, tokenService_1.createEmailToken)(user._id, "password_reset");
            const link = `${process.env.APP_URL}/reset-password?token=${token}`;
            const t = (0, emailTemplates_1.getTemplates)((0, emailTemplates_1.resolveLang)(req.body.lang));
            await (0, emailService_1.sendEmail)(user.email, t.resetSubject, t.resetBody(user.username, link, RESET_WINDOW_MIN));
        }
        catch (mailErr) {
            console.error("Password reset email error:", mailErr);
        }
        return okResponse();
    }
    catch (err) {
        console.error("Forgot password error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    // Validointi ennen tokenin kulutusta, jotta heikko salasana ei polta linkkiä
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: toErrorList(errors) });
    }
    const { token, password } = req.body;
    if (typeof token !== "string" || token.length !== 64) {
        return res.status(400).json({ code: "INVALID_OR_EXPIRED_TOKEN" });
    }
    try {
        const userId = await (0, tokenService_2.consumeEmailToken)(token, "password_reset");
        if (!userId) {
            return res.status(400).json({ code: "INVALID_OR_EXPIRED_TOKEN" });
        }
        const updated = await (0, userAuthService_1.updatePasswordInDb)(String(userId), password);
        if (!updated) {
            return res.status(400).json({ code: "INVALID_OR_EXPIRED_TOKEN" });
        }
        return res.status(200).json({ ok: true });
    }
    catch (err) {
        console.error("Reset password error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.resetPassword = resetPassword;
const deleteAccount = async (req, res) => {
    const userId = req.user?._id;
    if (!userId)
        return res.status(401).json({ code: "UNAUTHORIZED" });
    const { password } = req.body;
    if (typeof password !== "string" || password.length === 0) {
        return res.status(400).json({ code: "PASSWORD_REQUIRED" });
    }
    try {
        const user = await User_1.User.findById(String(userId)).select("+password");
        if (!user)
            return res.status(401).json({ code: "UNAUTHORIZED" });
        // Salasanavahvistus: sama vertailu kuin kirjautumisessa
        const match = await (0, userAuthService_1.validatePassword)(password, user.password);
        if (!match) {
            return res.status(401).json({ code: "INVALID_CREDENTIALS" });
        }
        // 1) Pellot: poistetaan vain käyttäjän merkintä, data (kuvat, sää) poistuu
        //    vasta kun kukaan muu ei jaa peltoa
        const fields = await (0, mongodb_1.getAllDateSets)(String(userId));
        for (const f of fields) {
            await (0, fieldService_1.removeFieldForUser)(f.id, String(userId));
        }
        // 2) Käyttäjän jobit
        await Job_1.Job.deleteMany({ userId: String(userId) });
        // 3) Käyttäjä viimeisenä (salatut CDSE-tunnukset poistuvat dokumentin mukana).
        //    Jos jokin yllä kaatuu, tili on yhä olemassa ja poiston voi ajaa uudelleen.
        await User_1.User.deleteOne({ _id: userId });
        return res.status(200).json({ code: "ACCOUNT_DELETED" });
    }
    catch (err) {
        console.error("Delete account error:", err instanceof Error ? err.message : "unknown error");
        return res.status(500).json({ message: "Server error" });
    }
};
exports.deleteAccount = deleteAccount;
