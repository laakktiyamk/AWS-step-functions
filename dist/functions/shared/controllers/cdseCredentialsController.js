"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeCdseCredentials = exports.setCdseCredentials = void 0;
const cdseCredentialsService_1 = require("../services/cdseCredentialsService");
const MAX_LEN = 200;
const isValidField = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= MAX_LEN;
/** PUT /api/user/cdse-credentials  body: { clientId, clientSecret } */
const setCdseCredentials = async (req, res) => {
    const userId = req.user?._id ? String(req.user._id) : undefined;
    if (!userId)
        return res.status(401).json({ code: "UNAUTHORIZED" });
    const { clientId, clientSecret } = req.body ?? {};
    if (!isValidField(clientId) || !isValidField(clientSecret)) {
        return res.status(400).json({ code: "CDSE_BAD_REQUEST" });
    }
    try {
        await (0, cdseCredentialsService_1.connectCdseCredentials)(userId, {
            clientId: clientId.trim(),
            clientSecret: clientSecret.trim(),
        });
    }
    catch (err) {
        if (err instanceof cdseCredentialsService_1.CdseAuthError) {
            return err.kind === "invalid"
                ? // 422 (not 401) so the frontend does not treat it as an expired session
                    res.status(422).json({ code: "CDSE_INVALID_CREDENTIALS" })
                : res.status(503).json({ code: "CDSE_UNAVAILABLE" });
        }
        console.error("CDSE credentials save failed"); // never log the credentials
        return res.status(500).json({ code: "CDSE_INTERNAL" });
    }
    return res.status(200).json({ cdseConnected: true });
};
exports.setCdseCredentials = setCdseCredentials;
/** DELETE /api/user/cdse-credentials */
const removeCdseCredentials = async (req, res) => {
    const userId = req.user?._id ? String(req.user._id) : undefined;
    if (!userId)
        return res.status(401).json({ code: "UNAUTHORIZED" });
    await (0, cdseCredentialsService_1.clearCdseCredentials)(userId);
    return res.status(200).json({ cdseConnected: false });
};
exports.removeCdseCredentials = removeCdseCredentials;
