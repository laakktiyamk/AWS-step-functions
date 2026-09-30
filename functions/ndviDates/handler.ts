import { authenticate } from '../shared/utils/authenticate_CDSE'
import { connectDb } from '../shared/mongo/db'
import { syncDates, fetchWeather } from '../shared/services/ndviService'

export const handler = async (event: any) => {
  await connectDb()
  const authToken = await authenticate()

  const geometry = typeof event.geometry !== 'object'
    ? JSON.parse(event.geometry)
    : event.geometry

  // saveImages: false → kuvat haetaan processor-Lambdalla Map-statessa
  const result = await syncDates(
    geometry,
    new Date(event.start_date),
    authToken,
    event.name ?? '',
    event.userId ?? '',
    event.kasvulohkot ?? [],
    false
  )

  if (!result) {
    return { geometry, field_id: event.field_id, items: [] }
  }

  await fetchWeather(result.geometry, result.seasons)

  return {
    geometry: result.geometry,   // rewind-normalisoitu, kulkee vain kerran
    field_id: event.field_id,
    items: result.newDates       // vain tällä ajolla haetut uudet päivät
  }
}