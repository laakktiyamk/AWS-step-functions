import * as fs from 'fs'
import { sampleMlFields } from '../functions/shared/services/mlSampler'

const BATCH_ID = process.argv[2] ?? 'batch1'
const SIZE = Number(process.argv[3] ?? 100)

async function main() {
  const fields = await sampleMlFields(BATCH_ID, SIZE)
  const json = JSON.stringify({ fields })
  const file = `sf-input-${BATCH_ID}.json`
  fs.writeFileSync(file, json)
  console.log(`${file}: peltoja ${fields.length}, koko ${(json.length / 1024).toFixed(1)} kt`)
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })