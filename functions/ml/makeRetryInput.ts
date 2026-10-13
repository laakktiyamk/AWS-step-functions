import * as fs from 'fs'
import { MlData } from '../shared/mongo/models/MlData'
import { ensureParcelConnected } from '../shared/mongo/connections'

const HASHES = [
  '50a91c6d33cf1605a2c964746f966a25eb2c53e33c32a2a6303a546d690b26cb',
  '68aede346187463b4c2349605f67a5bdd8c88574983face5f6c699916ccef03b',
  '7147742fb2d8d6cafd09d10bd3229681cdebab2e71e673a18483ec7bfb654b86',
  'cf15c599d97aff8b7920a1b9a6295ecc77f78e6675aab4df31e590cb59cc6044',
]
const BATCH_ID = 'retry1'

async function main() {
  await ensureParcelConnected()

  const docs: any[] = await MlData
    .find({ geometryHash: { $in: HASHES } })
    .select('peruslohkotunnus vuosi pinta_ala kasvulohkot geometry')
    .lean()

  const fields = docs.map((d, i) => ({
    field_id: `${BATCH_ID}-${i + 1}`,
    target: 'ml',
    batchId: BATCH_ID,
    start_date: '2020-01-01T00:00:00Z',
    end_date: '2025-12-31T00:00:00Z',
    peruslohkotunnus: d.peruslohkotunnus,
    vuosi: d.vuosi,
    pinta_ala: d.pinta_ala,
    kasvulohkot: d.kasvulohkot,
    geometry: { type: d.geometry.type, coordinates: d.geometry.coordinates },
  }))

  const json = JSON.stringify({ fields })
  fs.writeFileSync('sf-input-retry1.json', json)
  console.log(`sf-input-retry1.json: peltoja ${fields.length}, koko ${(json.length / 1024).toFixed(1)} kt`)
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })