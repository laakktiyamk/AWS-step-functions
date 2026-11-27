import { Types } from 'mongoose';
import { FieldNote } from '../mongo/models/FieldNote';
import { Dates } from '../mongo/models/Dates'; // ← vaihda dates-mallisi oikea nimi/polku

import * as mongodb from '../mongo/mongodb'

/** Virhe, kun pelto ei ole käyttäjän listalla. */
export class FieldNotFoundError extends Error {
  constructor() {
    super('FIELD_NOT_FOUND');
  }
}

/**
 * Tarkistaa, että AOI on käyttäjän listalla (dates.userIds).
 *
 * @remarks Estää muistiinpanon kirjoittamisen mielivaltaiselle aoiId:lle.
 */
/*
async function assertUserHasField(userId: string, aoiId: string): Promise<void> {
  const exists = await Dates.exists({ geometryHash: aoiId, userIds: userId });
  if (!exists) throw new FieldNotFoundError();
}*/

async function assertUserHasField(userId: string, aoiId: string): Promise<void> {
  const data = await mongodb.getDates(aoiId)
  
  if (!data?.userIds?.includes(String(userId))) throw new FieldNotFoundError()
}

/**
 * Palauttaa käyttäjän muistiinpanon pellolle.
 *
 * @returns Muistiinpano tai null, jos sitä ei ole.
 */
export async function getNote(userId: string, aoiId: string) {
  await assertUserHasField(userId, aoiId);
  return FieldNote.findOne({ userId, aoiId }).lean();
}

/**
 * Tallentaa muistiinpanon (upsert). Tyhjä teksti poistaa muistiinpanon.
 *
 * @returns Tallennettu muistiinpano tai null, jos poistettiin.
 */
export async function saveNote(userId: string, aoiId: string, text: string) {
  await assertUserHasField(userId, aoiId);
  const trimmed = text.trim();
  if (!trimmed) {
    await FieldNote.deleteOne({ userId, aoiId });
    return null;
  }
  return FieldNote.findOneAndUpdate(
    { userId, aoiId },
    { $set: { text: trimmed } },
    { upsert: true, new: true, runValidators: true }
  ).lean();
}

/** Poistaa käyttäjän muistiinpanon pellolta (pellon poisto). */
export async function deleteNoteForField(userId: string, aoiId: string): Promise<void> {
  await FieldNote.deleteOne({ userId, aoiId });
}

/** Poistaa kaikki käyttäjän muistiinpanot (tilin poisto). */
export async function deleteNotesForUser(userId: string): Promise<void> {
  await FieldNote.deleteMany({ userId });
}