import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { sampleMlFields } from '../shared/services/mlSampler'

const sfn = new SFNClient({})

export const handler = async (event: { batchId?: string; size?: number; credIndex?: number }) => {
  const { batchId, size = 100, credIndex = 0 } = event
  if (!batchId) throw new Error('batchId puuttuu')
  if (!Number.isInteger(credIndex) || credIndex < 0) {
    throw new Error('credIndex pitää olla kokonaisluku >= 0')
  }

  const sampled = await sampleMlFields(batchId, size)
  if (sampled.length === 0) throw new Error('Arvonta ei tuottanut yhtään peltoa')

  // ML-tunnus (CDSE_ML_CLIENTS-listan indeksi) kulkee mukana jokaisessa pellossa
  const fields = sampled.map((f: any) => ({ ...f, credIndex }))

  const input = JSON.stringify({ fields })
  const kb = Buffer.byteLength(input) / 1024
  // Step Functionsin syötteen raja on 256 kt
  if (kb > 250) throw new Error(`Syöte liian suuri: ${kb.toFixed(1)} kt, pienennä size`)

  const res = await sfn.send(new StartExecutionCommand({
    stateMachineArn: process.env.STEP_FUNCTION_ARN!,
    name: `ml-${batchId}-${Date.now()}`,
    input,
  }))

  return { batchId, credIndex, fields: fields.length, inputKb: Math.round(kb), executionArn: res.executionArn }
}