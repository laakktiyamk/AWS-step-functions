import * as fs from 'fs'
import { MlData } from '../functions/shared/mongo/models/MlData'
import { ensureParcelConnected } from '../functions/shared/mongo/connections'

const BATCH_ID = 'season2026r'
const START = '2026-04-01T00:00:00Z'
const END = '2026-10-01T00:00:00Z'
const MAX_BYTES = 200 * 1024
const OUT_DIR = 'sf-inputs-2026-retry'
const WRAPPER_BYTES = 20   // {"fields":[ ... ]}

async function main() {
  await ensureParcelConnected()

  // Vain pellot, joilta 2026 puuttuu (testipellot jäävät pois, ja skriptin voi ajaa uudelleen)
  const docs: any[] = await MlData
    .find({ 'seasonCounts.year': { $ne: 2026 } })
    .select('peruslohkotunnus vuosi pinta_ala kasvulohkot geometry')
    .sort({ _id: 1 })
    .lean()

  const batches: any[][] = []
  let current: any[] = []
  let size = WRAPPER_BYTES

  docs.forEach((d, i) => {
    const field = {
      field_id: `${BATCH_ID}-${i + 1}`,
      target: 'ml',
      batchId: BATCH_ID,
      start_date: START,
      end_date: END,
      peruslohkotunnus: d.peruslohkotunnus,
      vuosi: d.vuosi,
      pinta_ala: d.pinta_ala,
      kasvulohkot: d.kasvulohkot,
      geometry: { type: d.geometry.type, coordinates: d.geometry.coordinates },
    }
    const bytes = Buffer.byteLength(JSON.stringify(field)) + 1
    if (current.length > 0 && size + bytes > MAX_BYTES) {
      batches.push(current)
      current = []
      size = WRAPPER_BYTES
    }
    current.push(field)
    size += bytes
  })
  if (current.length > 0) batches.push(current)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  batches.forEach((fields, n) => {
    const json = JSON.stringify({ fields })
    const file = `${OUT_DIR}/sf-input-${String(n + 1).padStart(2, '0')}.json`
    fs.writeFileSync(file, json)
    console.log(`${file}: peltoja ${fields.length}, koko ${(Buffer.byteLength(json) / 1024).toFixed(1)} kt`)
  })
  console.log(`Yhteensä peltoja ${docs.length}, eriä ${batches.length}`)
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })