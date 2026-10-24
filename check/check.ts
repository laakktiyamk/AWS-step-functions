// Ajo: npx tsx check.tsc pilvisyys 20% huomioitu, suodatetaaan pois

const STAC_URL = "https://stac.dataspace.copernicus.eu/v1/search";
const COLLECTION = "sentinel-2-l1c";
const BBOX = [26.2259923453965, 60.7413439834074, 26.234648958155, 60.7461458319497];

// Kasvukausi muodossa KKPP (1.5. - 30.9.), säädä tarvittaessa
const SEASON_START = 401;
const SEASON_END = 930;

interface StacItem {
  id: string;
  properties: { datetime: string; "eo:cloud_cover"?: number };
}

function inGrowingSeason(d: Date): boolean {
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  return md >= SEASON_START && md <= SEASON_END;
}

export async function findNewItems(
  since: Date,
  maxCloud = 20,
  now = new Date(),
): Promise<StacItem[]> {
  if (!inGrowingSeason(now)) return []; // ei kutsua kasvukauden ulkopuolella

  const res = await fetch(STAC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: [COLLECTION],
      bbox: BBOX,
      datetime: `${since.toISOString()}/..`,
      query: { "eo:cloud_cover": { lt: maxCloud } },
      limit: 50,
    }),
  });
  if (!res.ok) throw new Error(`STAC-haku epäonnistui: ${res.status}`);

  const data = (await res.json()) as { features: StacItem[] };
  return data.features;
}

// Testi: kuvitellaan, että nyt on heinäkuu
findNewItems(new Date("2026-07-01"), 20, new Date("2026-07-15")).then((items) =>
  items.forEach((i) =>
    console.log(i.id, i.properties.datetime, i.properties["eo:cloud_cover"]),
  ),
);