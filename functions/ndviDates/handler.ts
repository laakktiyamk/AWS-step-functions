import { authenticate } from '../shared/utils/authenticate_CDSE'
import { connectDb } from '../shared/mongo/db'
import { ensureParcelConnected } from '../shared/mongo/connections'
import { mlWeatherStore } from '../shared/mongo/models/MlWeather'
import { syncDates, syncMlDates, fetchWeather } from '../shared/services/ndviService'

export const handler = async (event: any) => {
  await connectDb()
  const authToken = await authenticate()

  console.log('authenticated')

  const geometry = typeof event.geometry !== 'object'
    ? JSON.parse(event.geometry)
    : event.geometry

  // ── ML-ajo: tallennus ML_data- ja ML_weather-kokoelmiin, ei kuvia ──
  if (event.target === 'ml') {
    console.log('ML: start', event.field_id)
    await ensureParcelConnected()
    console.log('ML: parcel connected')

    const mlResult = await syncMlDates(
      geometry,
      new Date(event.start_date),
      new Date(event.end_date),
      authToken,
      event.batchId ?? '',
      event.kasvulohkot ?? [],
      {
        peruslohkotunnus: event.peruslohkotunnus,
        vuosi: event.vuosi,
        pinta_ala: event.pinta_ala,
      }
    )
    console.log('ML: syncMlDates done', !!mlResult)

    if (mlResult) await fetchWeather(mlResult.geometry, mlResult.seasons, mlWeatherStore)
    console.log('ML: weather done')

    return {
      geometry: mlResult?.geometry ?? geometry,
      field_id: event.field_id,
      items: []   // tyhjä lista: forEachDate-Map ei tee mitään
    }
  }

  // ── Normaali käyttäjän ajo (ennallaan) ──
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
    geometry: result.geometry,
    field_id: event.field_id,
    items: result.newDates
  }
}