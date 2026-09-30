import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import jwt from "jsonwebtoken";

const sfn = new SFNClient({ region: "eu-north-1" });

const getBbox = (geometry: any): number[] => {
  const coords: number[][] = [];
  const collect = (c: any) => {
    if (typeof c[0] === "number") coords.push(c);
    else c.forEach(collect);
  };
  collect(geometry.coordinates);
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
};

// Lukee käyttäjän id:n Authorization-headerin JWT:stä (HTTP API antaa headerit pienillä kirjaimilla)
const getUserIdFromEvent = (event: any): string => {
  const header: string = event.headers?.authorization || event.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return "";
  try {
    const decoded = jwt.verify(token, process.env.SECRET || "") as { _id?: string };
    return decoded._id ?? "";
  } catch {
    return "";
  }
};

const response = (statusCode: number, body: any) => ({
  statusCode,
  body: JSON.stringify(body)
});

export const handler = async (event: any) => {
  const isApiCall = !!event.requestContext || !!event.body;

  // ── Step Functions -kutsu (ensimmäinen tila) tai suora testikutsu ──
  if (!isApiCall) {
    if (event.fields) return { fields: event.fields };
    const start = event.start_date || event.start;
    const end = event.end_date || event.end;
    const geojson = event.geojson;
    if (!geojson) return event;

    let fields: any[] = [];
    if (Array.isArray(geojson)) {
      fields = geojson.map((g: any, i: number) => {
        const geometry = g.geometry || g;
        return { field_id: `field-${i + 1}`, geojson: geometry, geometry, bbox: getBbox(geometry), start, end, start_date: start };
      });
    } else if (geojson.type === "FeatureCollection") {
      fields = geojson.features.map((f: any, i: number) => {
        const geometry = f.geometry || f;
        return { field_id: f.properties?.id || `field-${i + 1}`, geojson: geometry, geometry, bbox: getBbox(geometry), start, end, start_date: start };
      });
    } else {
      fields = [{ field_id: "field-1", geojson, geometry: geojson, bbox: getBbox(geojson), start, end, start_date: start }];
    }
    return { fields };
  }

  // ── HTTP API: POST /process ──
  const userId = getUserIdFromEvent(event);
  if (!userId) return response(401, { error: "Unauthorized" });

  let body: any;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || event;
  } catch {
    return response(400, { error: "invalid JSON body" });
  }

  let geometry: any;
  try {
    geometry = typeof body.geometry === "string" ? JSON.parse(body.geometry) : body.geometry;
  } catch {
    return response(400, { error: "invalid geometry" });
  }

  if (!geometry || !body.start_date) {
    return response(400, { error: "geometry and start_date required" });
  }

  const stateMachineArn = process.env.STEP_FUNCTION_ARN as string;

  const fields = [{
    field_id: "field-1",
    geometry,
    start_date: body.start_date,
    end_date: body.end_date,
    name: body.name ?? "",
    userId,
    kasvulohkot: body.kasvulohkot ?? []
  }];

  const result = await sfn.send(new StartExecutionCommand({
    stateMachineArn,
    input: JSON.stringify({ fields })
  }));

  return response(200, {
    message: "NDVI workflow started",
    executionArn: result.executionArn
  });
};