import { authenticate } from '../shared/utils/authenticate_CDSE'
import { connectDb } from '../shared/mongo/db'
import { fetchAndSaveImage } from '../shared/services/ndviService'

export const handler = async (event: { item: any; geometry: any }) => {
  await connectDb()
  const authToken = await authenticate()

  const success = await fetchAndSaveImage(event.item, event.geometry, authToken)
  return { success, sentinelid: event.item.sentinelid }
}