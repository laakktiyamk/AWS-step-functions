import * as mongodb from '../mongo/mongodb'
import rewind from '@turf/rewind'
import * as hash from '../utils/hash'

export type RemoveFieldResult = 'not_found' | 'forbidden' | 'removed_user' | 'deleted'
import { deleteNoteForField } from './fieldNoteService'

export const removeFieldForUser = async (
  id: string,
  userId: string
): Promise<RemoveFieldResult> => {
  const data = await mongodb.getDates(id)
  if (!data) return 'not_found'
  if (!data.userIds?.includes(userId)) return 'forbidden'

  await mongodb.removeUserFromDates(id, userId)
  await deleteNoteForField(userId, id)

  // Data poistetaan vasta, kun viimeinenkin käyttäjä on poistanut pellon
  const orphaned = await mongodb.deleteDatesIfOrphaned(id)
  if (!orphaned) return 'removed_user'

  await Promise.all([
    mongodb.deleteImagesByHash(id),
    mongodb.deleteWeatherByHash(id),
    mongodb.deleteCropParcelStatsByHash(id),
  ])
  return 'deleted'
}

export type AoiStatus = 'none' | 'mine' | 'shared'

export const getAoiStatus = async (
  geometry: any,
  userId: string
): Promise<{ status: AoiStatus; id: string }> => {
  const id = hash.sha256(rewind(geometry, { mutate: false }))
  const data = await mongodb.getDates(id)

  // Dokumentti ilman päiviä = dataa ei ole haettu, käsitellään uutena
  if (!data || !data.dates?.length) return { status: 'none', id }
  return { status: data.userIds?.includes(userId) ? 'mine' : 'shared', id }
}