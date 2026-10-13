import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import jwt from "jsonwebtoken";

const sfn = new SFNClient({ region: "eu-north-1" });

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

  // ── Step Functions -kutsu (ensimmäinen tila): palautetaan fields sellaisenaan ──
  if (!isApiCall) {
    return { fields: event.fields };
  }

  // ── HTTP API: POST /process ──
  const userId = getUserIdFromEvent(event);
  if (!userId) return response(401, { error: "Unauthorized" });

  let body: any;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return response(400, { error: "invalid JSON body" });
  }

  if (!body?.start_date) {
    return response(400, { error: "start_date required" });
  }

  // fields-taulukko; vanha muoto (geometry ylätasolla) kääritään yhden alkion taulukoksi
  const items: any[] = Array.isArray(body.fields)
    ? body.fields
    : body.geometry
      ? [{ geometry: body.geometry, name: body.name, kasvulohkot: body.kasvulohkot }]
      : [];

  if (items.length === 0) {
    return response(400, { error: "fields required" });
  }

  const fields: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let geometry: any;
    try {
      geometry = typeof item.geometry === "string" ? JSON.parse(item.geometry) : item.geometry;
    } catch {
      return response(400, { error: `invalid geometry in field ${i + 1}` });
    }
    if (!geometry) {
      return response(400, { error: `geometry required in field ${i + 1}` });
    }
    fields.push({
      field_id: `field-${i + 1}`,
      geometry,
      start_date: body.start_date,
      end_date: body.end_date,
      name: item.name ?? "",
      userId,
      kasvulohkot: item.kasvulohkot ?? []
    });
  }

  const stateMachineArn = process.env.STEP_FUNCTION_ARN as string;

  const result = await sfn.send(new StartExecutionCommand({
    stateMachineArn,
    input: JSON.stringify({ fields })
  }));

  return response(200, {
    message: "NDVI workflow started",
    executionArn: result.executionArn
  });
};