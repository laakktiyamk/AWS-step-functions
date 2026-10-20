import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { sampleMlFields } from '../shared/services/mlSampler'

const sfn = new SFNClient({})

export const handler = async (event: { batchId?: string; size?: number }) => {
  const { batchId, size = 100 } = event
  if (!batchId) throw new Error('batchId puuttuu')

  const fields = await sampleMlFields(batchId, size)
  if (fields.length === 0) throw new Error('Arvonta ei tuottanut yhtään peltoa')

  const input = JSON.stringify({ fields })
  const kb = Buffer.byteLength(input) / 1024
  // Step Functionsin syötteen raja on 256 kt
  if (kb > 250) throw new Error(`Syöte liian suuri: ${kb.toFixed(1)} kt, pienennä size`)

  const res = await sfn.send(new StartExecutionCommand({
    stateMachineArn: process.env.STEP_FUNCTION_ARN!,
    name: `ml-${batchId}-${Date.now()}`,
    input,
  }))

  return { batchId, fields: fields.length, inputKb: Math.round(kb), executionArn: res.executionArn }
}