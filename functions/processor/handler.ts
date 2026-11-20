import { getCdseTokenForUser, CdseNotConnectedError } from '../shared/services/cdseTokenService'
import { connectDb } from '../shared/mongo/db'
import { fetchAndSaveImage } from '../shared/services/ndviService'

export const handler = async (event: { item: any; geometry: any; userId?: string }) => {
  await connectDb()
  if (!event.userId) throw new CdseNotConnectedError()
  const authToken = await getCdseTokenForUser(event.userId)

  const success = await fetchAndSaveImage(event.item, event.geometry, authToken)
  return { success, sentinelid: event.item.sentinelid }
}