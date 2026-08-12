const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");
const sfn = new SFNClient({ region: "eu-north-1" });

function getBbox(geometry) {
  const coords = [];
  const collect = (c) => {
    if (typeof c[0] === "number") coords.push(c);
    else c.forEach(collect);
  };
  collect(geometry.coordinates);
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

exports.handler = async (event) => {
  const isApiCall = !!event.requestContext || !!event.body;

  if (!isApiCall) {
    if (event.fields) return { fields: event.fields };
    const start = event.start_date || event.start;
    const end = event.end_date || event.end;
    const geojson = event.geojson;
    if (!geojson) return event;

    let fields = [];
    if (Array.isArray(geojson)) {
      fields = geojson.map((g, i) => {
        const geometry = g.geometry || g;
        return { field_id: `field-${i+1}`, geojson: geometry, geometry, bbox: getBbox(geometry), start, end };
      });
    } else if (geojson.type === "FeatureCollection") {
      fields = geojson.features.map((f, i) => {
        const geometry = f.geometry || f;
        return { field_id: f.properties?.id || `field-${i+1}`, geojson: geometry, geometry, bbox: getBbox(geometry), start, end };
      });
    } else {
      fields = [{ field_id: "field-1", geojson, geometry: geojson, bbox: getBbox(geojson), start, end }];
    }
    return { fields };
  }

  // API Gateway kutsu
  const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || event;
  const stateMachineArn = process.env.STEP_FUNCTION_ARN ||
    `arn:aws:states:eu-north-1:223057859479:stateMachine:ndviWorkflow`;

  const cmd = new StartExecutionCommand({
    stateMachineArn,
    input: JSON.stringify(body)
  });

  const result = await sfn.send(cmd);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "NDVI workflow started",
      executionArn: result.executionArn,
      input: body
    })
  };
};
