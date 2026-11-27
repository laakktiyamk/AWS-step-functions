import { FieldNote } from '../mongo/models/FieldNote'
import * as mongodb from '../mongo/mongodb'

/** Virhe, kun pelto ei ole käyttäjän listalla. */
export class FieldNotFoundError extends Error {
  constructor() {
    super('FIELD_NOT_FOUND')
  }
}

export interface NoteDto {
  text: string
  updatedAt: Date | null
}

const EMPTY: NoteDto = { text: '', updatedAt: null }

const toDto = (n?: { text: string; updatedAt: Date } | null): NoteDto =>
  n ? { text: n.text, updatedAt: n.updatedAt } : EMPTY

/**
 * Tarkistaa, että AOI on käyttäjän listalla (dates.userIds).
 *
 * @remarks Sama logiikka kuin removeFieldForUserissa.
 */
async function assertUserHasField(userId: string, aoiId: string): Promise<void> {
  const data = await mongodb.getDates(aoiId)
  if (!data?.userIds?.includes(String(userId))) throw new FieldNotFoundError()
}

/**
 * Palauttaa pellon yleisen muistiinpanon ja valitun vuoden muistiinpanon.
 *
 * @remarks
 * Yksi kysely: year $in [null, year]. Puuttuva year-kenttä (vanhat dokumentit)
 * vastaa nullia, joten ne näkyvät yleisenä muistiinpanona.
 *
 * @param year - Kauden vuosi tai null, jolloin season on null.
 */
export async function getNotes(
  userId: string,
  aoiId: string,
  year: number | null
): Promise<{ general: NoteDto; season: (NoteDto & { year: number }) | null }> {
  await assertUserHasField(userId, aoiId)

  const years = year === null ? [null] : [null, year]
  const notes = await FieldNote.find({ userId, aoiId, year: { $in: years } }).lean()

  const general = notes.find((n) => n.year == null)
  const season = year === null ? undefined : notes.find((n) => n.year === year)

  return {
    general: toDto(general),
    season: year === null ? null : { year, ...toDto(season) },
  }
}

/**
 * Tallentaa yhden muistiinpanon (upsert). Tyhjä teksti poistaa sen.
 *
 * @param year - null = yleinen, numero = kauden muistiinpano.
 */
export async function saveNote(
  userId: string,
  aoiId: string,
  year: number | null,
  text: string
): Promise<NoteDto> {
  await assertUserHasField(userId, aoiId)

  const filter = { userId, aoiId, year }
  const trimmed = text.trim()

  if (!trimmed) {
    await FieldNote.deleteOne(filter)
    return EMPTY
  }

  const saved = await FieldNote.findOneAndUpdate(
    filter,
    { $set: { text: trimmed } },
    { upsert: true, new: true, runValidators: true }
  ).lean()

  return toDto(saved)
}

/** Poistaa käyttäjän kaikki muistiinpanot pellolta (pellon poisto). */
export async function deleteNoteForField(userId: string, aoiId: string): Promise<void> {
  await FieldNote.deleteMany({ userId, aoiId })
}

/** Poistaa kaikki käyttäjän muistiinpanot (tilin poisto). */
export async function deleteNotesForUser(userId: string): Promise<void> {
  await FieldNote.deleteMany({ userId })
}