async function getToken(): Promise<string> {
  const res = await fetch(
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.CDSE_CLIENT_ID!,
        client_secret: process.env.CDSE_CLIENT_SECRET!,
      }),
    },
  );
  if (!res.ok) throw new Error(`Token: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const evalscript = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1 },
      { id: "dataMask", bands: 1 },
    ],
  };
}
function evaluatePixel(s) {
  return {
    ndvi: [(s.B08 - s.B04) / (s.B08 + s.B04)],
    dataMask: [s.dataMask],
  };
}`;

async function main() {
  const token = await getToken();
  const res = await fetch("https://sh.dataspace.copernicus.eu/api/v1/statistics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: {
        bounds: {
          bbox: [26.2259923453965, 60.7413439834074, 26.234648958155, 60.7461458319497],
          properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
        },
        data: [{ type: "sentinel-2-l1c" }],
      },
      aggregation: {
        timeRange: { from: "2026-07-01T00:00:00Z", to: "2026-08-01T00:00:00Z" },
        aggregationInterval: { of: "P1D" },
        evalscript,
        resx: 0.0001,
        resy: 0.0001,
      },
    }),
  });
  if (!res.ok) throw new Error(`Statistics: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as {
    data: {
      interval: { from: string };
      outputs: { ndvi: { bands: { B0: { stats: { mean: number; sampleCount: number; noDataCount: number } } } } };
    }[];
  };
  for (const d of data.data) {
    const s = d.outputs.ndvi.bands.B0.stats;
    console.log(d.interval.from.slice(0, 10), "ndvi mean:", s.mean, "pikseleitä:", s.sampleCount, "ei dataa:", s.noDataCount);
  }
}

main().catch(console.error);