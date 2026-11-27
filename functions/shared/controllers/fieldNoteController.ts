import { Request, Response } from "express";
import { getNotes, saveNote, FieldNotFoundError } from "../services/fieldNoteService";

const MAX_NOTE_LEN = 5000;
const MIN_YEAR = 2020;

const getUserId = (req: Request) =>
  (req as Request & { user?: { _id?: unknown } }).user?._id;

/**
 * Lukee valinnaisen `?year=`-parametrin.
 *
 * @returns null jos parametria ei ole (yleinen muistiinpano),
 *          numero jos validi vuosi, tai "invalid".
 */
const parseYear = (req: Request): number | null | "invalid" => {
  const raw = req.query.year as string | undefined;
  if (raw === undefined || raw === "") return null;
  const year = Number(raw);
  const maxYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < MIN_YEAR || year > maxYear) return "invalid";
  return year;
};

/**
 * Palauttaa pellon yleisen ja valitun vuoden muistiinpanon.
 *
 * @remarks
 * `GET /api/fields/{aoiId}/note?year=2026`. Ilman vuotta `season` on null.
 * Pelto, joka ei ole käyttäjän listalla, palauttaa `404` (ei `403`).
 *
 * @returns `{ general: { text, updatedAt }, season: { year, text, updatedAt } | null }`
 */
export const getFieldNote = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ code: "UNAUTHORIZED" });

  const year = parseYear(req);
  if (year === "invalid") return res.status(400).json({ code: "INVALID_YEAR" });

  try {
    const notes = await getNotes(String(userId), req.params.aoiId as string, year);
    return res.status(200).json(notes);
  } catch (err) {
    if (err instanceof FieldNotFoundError) {
      return res.status(404).json({ code: "FIELD_NOT_FOUND" });
    }
    console.error("Get note error:", err instanceof Error ? err.message : "unknown error");
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Tallentaa yhden muistiinpanon (upsert).
 *
 * @remarks
 * `PUT /api/fields/{aoiId}/note?year=2026` tallentaa kauden muistiinpanon,
 * ilman vuotta yleisen. Tyhjä teksti poistaa. Yli 5000 merkkiä → `400 NOTE_TOO_LONG`.
 *
 * @returns `{ text, updatedAt }`
 */
export const saveFieldNote = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ code: "UNAUTHORIZED" });

  const year = parseYear(req);
  if (year === "invalid") return res.status(400).json({ code: "INVALID_YEAR" });

  const { text } = req.body ?? {};
  if (typeof text !== "string") {
    return res.status(400).json({ code: "NOTE_BAD_REQUEST" });
  }
  if (text.length > MAX_NOTE_LEN) {
    return res.status(400).json({ code: "NOTE_TOO_LONG" });
  }

  try {
    const note = await saveNote(String(userId), req.params.aoiId as string, year, text);
    return res.status(200).json(note);
  } catch (err) {
    if (err instanceof FieldNotFoundError) {
      return res.status(404).json({ code: "FIELD_NOT_FOUND" });
    }
    console.error("Save note error:", err instanceof Error ? err.message : "unknown error");
    return res.status(500).json({ message: "Server error" });
  }
};