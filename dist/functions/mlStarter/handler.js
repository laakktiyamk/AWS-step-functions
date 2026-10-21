"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_sfn_1 = require("@aws-sdk/client-sfn");
const mlSampler_1 = require("../shared/services/mlSampler");
const sfn = new client_sfn_1.SFNClient({});
const handler = async (event) => {
    const { batchId, size = 100 } = event;
    if (!batchId)
        throw new Error('batchId puuttuu');
    const fields = await (0, mlSampler_1.sampleMlFields)(batchId, size);
    if (fields.length === 0)
        throw new Error('Arvonta ei tuottanut yhtään peltoa');
    const input = JSON.stringify({ fields });
    const kb = Buffer.byteLength(input) / 1024;
    // Step Functionsin syötteen raja on 256 kt
    if (kb > 250)
        throw new Error(`Syöte liian suuri: ${kb.toFixed(1)} kt, pienennä size`);
    const res = await sfn.send(new client_sfn_1.StartExecutionCommand({
        stateMachineArn: process.env.STEP_FUNCTION_ARN,
        name: `ml-${batchId}-${Date.now()}`,
        input,
    }));
    return { batchId, fields: fields.length, inputKb: Math.round(kb), executionArn: res.executionArn };
};
exports.handler = handler;
