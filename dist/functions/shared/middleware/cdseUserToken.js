"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserToken = void 0;
const authenticate_CDSE_1 = require("../utils/authenticate_CDSE");
const cdseTokenService_1 = require("../services/cdseTokenService");
const cdseCredentialsService_1 = require("../services/cdseCredentialsService");
/**
 * Per-user replacement for the shared `checkToken` middleware.
 * Must run AFTER authenticateUser (needs req.user). Sets req.authToken from
 * the user's own CDSE credentials, so controllers need no changes.
 *
 * Use together with lambdaAdapter(handler, [authenticateUser, checkUserToken], false):
 * needsSentinelToken must be false, otherwise the adapter also fetches the shared token.
 *
 * Users without credentials continue without req.authToken; code that needs CDSE must check for it.
 */
const checkUserToken = async (req, res, next) => {
    const userId = req.user?._id ? String(req.user._id) : undefined;
    if (!userId) {
        res.status(401).json({ code: "UNAUTHORIZED" });
        return;
    }
    try {
        req.authToken = await (0, cdseTokenService_1.getCdseTokenForUser)(userId);
        req.doCheckToken = async () => {
            req.authToken = await (0, cdseTokenService_1.getCdseTokenForUser)(userId);
        };
        next();
    }
    catch (err) {
        if (err instanceof cdseTokenService_1.CdseNotConnectedError) {
            if (process.env.CDSE_SHARED_FALLBACK === "true") {
                // Same shared-account token that lambdaAdapter fetches when needsSentinelToken is true
                req.authToken = await (0, authenticate_CDSE_1.authenticate)();
                next();
                return;
            }
            if (err instanceof cdseTokenService_1.CdseNotConnectedError) {
                if (process.env.CDSE_SHARED_FALLBACK === "true") {
                    // Same shared-account token that lambdaAdapter fetches when needsSentinelToken is true
                    req.authToken = await (0, authenticate_CDSE_1.authenticate)();
                    next();
                    return;
                }
                // No credentials connected: let the request through without a token.
                // Reading data that is already in the database does not need one;
                // the service decides when a token is actually required.
                next();
                return;
            }
            return;
        }
        if (err instanceof cdseCredentialsService_1.CdseAuthError) {
            // credentials were valid at registration but CDSE rejects them now
            res
                .status(err.kind === "invalid" ? 422 : 503)
                .json({
                code: err.kind === "invalid" ? "CDSE_INVALID_CREDENTIALS" : "CDSE_UNAVAILABLE",
            });
            return;
        }
        next(err);
    }
};
exports.checkUserToken = checkUserToken;
