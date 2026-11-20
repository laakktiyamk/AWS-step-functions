import type { Request, Response } from "express";
import {
  CdseAuthError,
  connectCdseCredentials,
  clearCdseCredentials,
} from "../services/cdseCredentialsService";

const MAX_LEN = 200;

const isValidField = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= MAX_LEN;

/** PUT /api/user/cdse-credentials  body: { clientId, clientSecret } */
export const setCdseCredentials = async (req: Request, res: Response) => {
  const userId = req.user?._id ? String(req.user._id) : undefined;
  if (!userId) return res.status(401).json({ code: "UNAUTHORIZED" });

  const { clientId, clientSecret } = req.body ?? {};
  if (!isValidField(clientId) || !isValidField(clientSecret)) {
    return res.status(400).json({ code: "CDSE_BAD_REQUEST" });
  }

  try {
    await connectCdseCredentials(userId, {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });
  } catch (err) {
    if (err instanceof CdseAuthError) {
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

/** DELETE /api/user/cdse-credentials */
export const removeCdseCredentials = async (
  req: Request,
  res: Response
) => {
  const userId = req.user?._id ? String(req.user._id) : undefined;
  if (!userId) return res.status(401).json({ code: "UNAUTHORIZED" });

  await clearCdseCredentials(userId);
  return res.status(200).json({ cdseConnected: false });
};