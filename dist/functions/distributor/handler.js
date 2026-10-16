"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_sfn_1 = require("@aws-sdk/client-sfn");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const hash_1 = require("../shared/utils/hash");
const validateGeometry_1 = require("../shared/utils/validateGeometry");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../shared/mongo/db");
const Job_1 = require("../shared/mongo/models/Job");
const sfn = new client_sfn_1.SFNClient({ region: "eu-north-1" });
// Lukee käyttäjän id:n Authorization-headerin JWT:stä (HTTP API antaa headerit pienillä kirjaimilla)
const getUserIdFromEvent = (event) => {
    const header = event.headers?.authorization || event.headers?.Authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    if (!token)
        return "";
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.SECRET || "");
        return decoded._id ?? "";
    }
    catch {
        return "";
    }
};
const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body)
});
const handler = async (event) => {
    const isApiCall = !!event.requestContext || !!event.body;
    // ── Step Functions -kutsu (ensimmäinen tila): palautetaan fields sellaisenaan ──
    if (!isApiCall) {
        return { fields: event.fields };
    }
    // ── HTTP API: POST /process ──
    const userId = getUserIdFromEvent(event);
    if (!userId)
        return response(401, { error: "Unauthorized" });
    let body;
    try {
        body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    }
    catch {
        return response(400, { error: "invalid JSON body" });
    }
    if (!body?.start_date) {
        return response(400, { error: "start_date required" });
    }
    // fields-taulukko; vanha muoto (geometry ylätasolla) kääritään yhden alkion taulukoksi
    const items = Array.isArray(body.fields)
        ? body.fields
        : body.geometry
            ? [{ geometry: body.geometry, name: body.name, kasvulohkot: body.kasvulohkot }]
            : [];
    if (items.length === 0) {
        return response(400, { error: "fields required" });
    }
    const jobObjectId = new mongoose_1.default.Types.ObjectId();
    const jobId = jobObjectId.toString();
    const fields = [];
    const seen = new Set();
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let geometry;
        try {
            geometry = typeof item.geometry === "string" ? JSON.parse(item.geometry) : item.geometry;
        }
        catch {
            return response(400, { error: `invalid geometry in field ${i + 1}` });
        }
        const errors = (0, validateGeometry_1.validateGeometry)(geometry);
        if (errors.length > 0) {
            return response(400, { error: `invalid geometry in field ${i + 1}`, details: errors });
        }
        const aoiId = (0, hash_1.geometryHash)(geometry);
        if (seen.has(aoiId))
            continue; // sama geometria kahdesti samassa pyynnössä
        seen.add(aoiId);
        fields.push({
            field_id: `field-${fields.length + 1}`,
            aoiId,
            jobId,
            geometry,
            start_date: body.start_date,
            end_date: body.end_date,
            name: item.name ?? "",
            userId,
            kasvulohkot: item.kasvulohkot ?? []
        });
    }
    const stateMachineArn = process.env.STEP_FUNCTION_ARN;
    await (0, db_1.connectDb)();
    await Job_1.Job.create({
        _id: jobObjectId,
        userId,
        total: fields.length
    });
    let executionArn;
    try {
        const result = await sfn.send(new client_sfn_1.StartExecutionCommand({
            stateMachineArn,
            input: JSON.stringify({ fields })
        }));
        executionArn = result.executionArn;
    }
    catch (err) {
        console.error("StartExecution failed:", err);
        await Job_1.Job.updateOne({ _id: jobObjectId }, { status: "failed" });
        return response(500, { error: "failed to start workflow" });
    }
    return response(202, {
        jobId,
        total: fields.length,
        aoiIds: fields.map((f) => f.aoiId),
        executionArn
    });
};
exports.handler = handler;
