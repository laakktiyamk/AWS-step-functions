import { FieldParcel } from '../mongo/models/FieldParcel'
import { CropParcel } from '../mongo/models/CropParcel'
import { MlData } from '../mongo/models/MlData'
import { ensureParcelConnected } from '../mongo/connections'

export async function sampleMlFields(batchId: string, size: number) {
  await ensureParcelConnected()

  const done: string[] = await MlData.distinct('peruslohkotunnus')
  const doneSet = new Set(done)
  const seen = new Set<string>()

  // Tuplamäärä, koska osalta ei löydy kasvulohkoa
  const raw: any[] = await FieldParcel.aggregate([{ $sample: { size: size * 3 } }])
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

  return sample
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
    .slice(0, size)
    .map((f, i) => ({
      field_id: `${batchId}-${i + 1}`,
      target: 'ml',
      batchId,
      start_date: '2020-01-01T00:00:00Z',
      end_date: '2025-12-31T00:00:00Z',
      ...f,
    }))
}