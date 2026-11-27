import { Request, Response } from "express";
import { getNote, saveNote, FieldNotFoundError } from "../services/fieldNoteService";

const MAX_NOTE_LEN = 5000;

const getUserId = (req: Request) =>
  (req as Request & { user?: { _id?: unknown } }).user?._id;

/**
 * Palauttaa käyttäjän muistiinpanon pellolle.
 *
 * @remarks
 * Pelto, joka ei ole käyttäjän listalla, palauttaa `404` (ei `403`),
 * jotta rajapinnasta ei näe, onko AOI olemassa.
 *
 * @param req - `params.aoiId` = pellon geometryHash.
 * @returns `{ text, updatedAt }`, tai `{ text: "", updatedAt: null }` jos muistiinpanoa ei ole.
 */
export const getFieldNote = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ code: "UNAUTHORIZED" });

  try {
    const note = await getNote(String(userId), req.params.aoiId as string);
    return res.status(200).json({
      text: note?.text ?? "",
      updatedAt: note?.updatedAt ?? null
    });
  } catch (err) {
    if (err instanceof FieldNotFoundError) {
      return res.status(404).json({ code: "FIELD_NOT_FOUND" });
    }
    console.error("Get note error:", err instanceof Error ? err.message : "unknown error");
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Tallentaa käyttäjän muistiinpanon pellolle (upsert).
 *
 * @remarks
 * Tyhjä teksti poistaa muistiinpanon. Yli 5000 merkkiä → `400 NOTE_TOO_LONG`.
 *
 * @param req - `params.aoiId`, body `{ text }`.
 * @returns `{ text, updatedAt }`.
 */
export const saveFieldNote = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ code: "UNAUTHORIZED" });

  const { text } = req.body ?? {};
  if (typeof text !== "string") {
    return res.status(400).json({ code: "NOTE_BAD_REQUEST" });
  }
  if (text.length > MAX_NOTE_LEN) {
    return res.status(400).json({ code: "NOTE_TOO_LONG" });
  }

  try {
    const note = await saveNote(String(userId), req.params.aoiId as string, text);
    return res.status(200).json({
      text: note?.text ?? "",
      updatedAt: note?.updatedAt ?? null
    });
  } catch (err) {
    if (err instanceof FieldNotFoundError) {
      return res.status(404).json({ code: "FIELD_NOT_FOUND" });
    }
    console.error("Save note error:", err instanceof Error ? err.message : "unknown error");
    return res.status(500).json({ message: "Server error" });
  }
};