import { Response, NextFunction } from "express";
import type { SentinelRequest } from "../sentinelhub/sentinelhub_token";
import {
  getCdseTokenForUser,
  CdseNotConnectedError,
} from "../services/cdseTokenService";
import { CdseAuthError } from "../services/cdseCredentialsService";

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
export const checkUserToken = async (
  req: SentinelRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?._id ? String(req.user._id) : undefined;
  if (!userId) {
    res.status(401).json({ code: "UNAUTHORIZED" });
    return;
  }

  try {
    req.authToken = await getCdseTokenForUser(userId);
    req.doCheckToken = async () => {
      req.authToken = await getCdseTokenForUser(userId);
    };
    next();
  } catch (err) {
    if (err instanceof CdseNotConnectedError) {
      // No credentials connected: let the request through without a token.
      // Reading data that is already in the database does not need one;
      // the service decides when a token is actually required.
      next();
      return;
    }
    if (err instanceof CdseAuthError) {
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