"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_sfn_1 = require("@aws-sdk/client-sfn");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sfn = new client_sfn_1.SFNClient({ region: "eu-north-1" });
const getBbox = (geometry) => {
    const coords = [];
    const collect = (c) => {
        if (typeof c[0] === "number")
            coords.push(c);
        else
            c.forEach(collect);
    };
    collect(geometry.coordinates);
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
};
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
    // ── Step Functions -kutsu (ensimmäinen tila) tai suora testikutsu ──
    if (!isApiCall) {
        if (event.fields)
            return { fields: event.fields };
        const start = event.start_date || event.start;
        const end = event.end_date || event.end;
        const geojson = event.geojson;
        if (!geojson)
            return event;
        let fields = [];
        if (Array.isArray(geojson)) {
            fields = geojson.map((g, i) => {
                const geometry = g.geometry || g;
                return { field_id: `field-${i + 1}`, geojson: geometry, geometry, bbox: getBbox(geometry), start, end, start_date: start };
            });
        }
        else if (geojson.type === "FeatureCollection") {
            fields = geojson.features.map((f, i) => {
                const geometry = f.geometry || f;
                return { field_id: f.properties?.id || `field-${i + 1}`, geojson: geometry, geometry, bbox: getBbox(geometry), start, end, start_date: start };
            });
        }
        else {
            fields = [{ field_id: "field-1", geojson, geometry: geojson, bbox: getBbox(geojson), start, end, start_date: start }];
        }
        return { fields };
    }
    // ── HTTP API: POST /process ──
    const userId = getUserIdFromEvent(event);
    if (!userId)
        return response(401, { error: "Unauthorized" });
    let body;
    try {
        body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || event;
    }
    catch {
        return response(400, { error: "invalid JSON body" });
    }
    let geometry;
    try {
        geometry = typeof body.geometry === "string" ? JSON.parse(body.geometry) : body.geometry;
    }
    catch {
        return response(400, { error: "invalid geometry" });
    }
    if (!geometry || !body.start_date) {
        return response(400, { error: "geometry and start_date required" });
    }
    const stateMachineArn = process.env.STEP_FUNCTION_ARN;
    const fields = [{
            field_id: "field-1",
            geometry,
            start_date: body.start_date,
            end_date: body.end_date,
            name: body.name ?? "",
            userId,
            kasvulohkot: body.kasvulohkot ?? []
        }];
    const result = await sfn.send(new client_sfn_1.StartExecutionCommand({
        stateMachineArn,
        input: JSON.stringify({ fields })
    }));
    return response(200, {
        message: "NDVI workflow started",
        executionArn: result.executionArn
    });
};
exports.handler = handler;
