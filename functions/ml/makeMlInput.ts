import * as fs from 'fs'
import { FieldParcel } from '../shared/mongo/models/FieldParcel'
import { CropParcel } from '../shared/mongo/models/CropParcel'
import { MlData } from '../shared/mongo/models/MlData'
import { ensureParcelConnected } from '../shared/mongo/connections'

const BATCH_ID = process.argv[2] ?? 'batch1'
const SIZE = Number(process.argv[3] ?? 100)

async function main() {
  await ensureParcelConnected()

  // Pellot, jotka ovat jo ML_data-kokoelmassa, jätetään pois
  const done: string[] = await MlData.distinct('peruslohkotunnus')
  console.log(`ML_data:ssa jo ${done.length} peltoa`)

  // Arvotaan tuplamäärä, koska osalta ei löydy kasvulohkoa
    // Arvotaan ensin (nopea), suodatetaan jo haetut ja tuplat pois koodissa.
  // Tuplamäärä, koska osalta ei löydy kasvulohkoa.
  const doneSet = new Set(done)
  const seen = new Set<string>()
  const raw: any[] = await FieldParcel.aggregate([{ $sample: { size: SIZE * 3 } }])
  const sample = raw.filter(s => {
    if (doneSet.has(s.peruslohkotunnus) || seen.has(s.peruslohkotunnus)) return false
    seen.add(s.peruslohkotunnus)
    return true
  })
  
  const ids = sample.map(s => s.peruslohkotunnus)

  const crops: any[] = await CropParcel
    .find({ peruslohkotunnus: { $in: ids } })
    .select('peruslohkotunnus tunnus pinta_ala kasvikoodi')
    .lean()

  const fields = sample
    .map(s => ({
      peruslohkotunnus: s.peruslohkotunnus,
      vuosi: s.vuosi,
      pinta_ala: s.pinta_ala,
      geometry: s.geometry,
      kasvulohkot: crops
        .filter(c => c.peruslohkotunnus === s.peruslohkotunnus)
        .map(c => ({ tunnus: c.tunnus, pinta_ala: c.pinta_ala, kasvikoodi: c.kasvikoodi })),
    }))
    .filter(f => f.kasvulohkot.length > 0)
    .slice(0, SIZE)
    .map((f, i) => ({
      field_id: `${BATCH_ID}-${i + 1}`,
      target: 'ml',
      batchId: BATCH_ID,
      start_date: '2020-01-01T00:00:00Z',
      end_date: '2025-12-31T00:00:00Z',
      ...f,
    }))

  const json = JSON.stringify({ fields })
  const file = `sf-input-${BATCH_ID}.json`
  fs.writeFileSync(file, json)
  console.log(`${file}: peltoja ${fields.length}, koko ${(json.length / 1024).toFixed(1)} kt`)
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })