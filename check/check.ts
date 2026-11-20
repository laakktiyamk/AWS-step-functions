const STAC_URL = "https://stac.dataspace.copernicus.eu/v1/search";
const COLLECTION = "sentinel-2-l1c";
const BBOX = [26.2259923453965, 60.7413439834074, 26.234648958155, 60.7461458319497];

// Kasvukausi muodossa KKPP
const SEASON_START = 401;
const SEASON_END = 930;

// Ohituskuvio: ankkuri + 10 vrk:n toisto, päivät 0, 2, 4, 5, 7
const ANCHOR = Date.UTC(2026, 9, 23);
const OFFSETS = [0, 2, 4, 5, 7];
// Tuote ilmestyi aiemmin katalogiin noin 3-4 h kuvauksen jälkeen, joten odotetaan pidempään
const AVAILABLE_HOUR_UTC = 17;
const DAY = 86_400_000;

interface StacItem {
  id: string;
  properties: { datetime: string; "eo:cloud_cover"?: number };
}

function inGrowingSeason(d: Date): boolean {
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  return md >= SEASON_START && md <= SEASON_END;
}

function isExpectedDay(dayStartMs: number): boolean {
  const days = Math.round((dayStartMs - ANCHOR) / DAY);
  return OFFSETS.includes(((days % 10) + 10) % 10);
}

// Onko välillä (since, now] odotettu kuva ehtinyt tulla saataville?
function expectedBetween(since: Date, now: Date): boolean {
  const startDay = Math.floor(since.getTime() / DAY) * DAY;
  for (let t = startDay; t <= now.getTime(); t += DAY) {
    const availableAt = t + AVAILABLE_HOUR_UTC * 3_600_000;
    if (availableAt > since.getTime() && availableAt <= now.getTime() && isExpectedDay(t)) {
      return true;
    }
  }
  return false;
}

export async function checkForNew(
  since: Date,
  now = new Date(),
  maxCloud = 20,
): Promise<StacItem[]> {
  if (!inGrowingSeason(now)) return [];
  if (!expectedBetween(since, now)) return [];

  const from = new Date(since.getTime() - DAY).toISOString();
  const res = await fetch(STAC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: [COLLECTION],
      bbox: BBOX,
      datetime: `${from}/${now.toISOString()}`,
      query: { "eo:cloud_cover": { lt: maxCloud } },
      limit: 50,
    }),
  });
  if (!res.ok) throw new Error(`STAC-haku epäonnistui: ${res.status}`);
  
  return ((await res.json()) as { features: StacItem[] }).features;
}

async function main() {
  // 1) Odotettu päivä (15.7.) on ehtinyt, joten haku tehdään
  const a = await checkForNew(new Date("2026-07-12T12:00:00Z"), new Date("2026-07-15T18:00:00Z"));
  console.log("haku tehtiin, kuvia:", a.length);

  // 2) 16.7. ei ole odotettu päivä, joten hakua ei tehdä
  const b = await checkForNew(new Date("2026-07-15T18:00:00Z"), new Date("2026-07-16T12:00:00Z"));
  console.log("hakua ei tehty, kuvia:", b.length);
}

main().catch(console.error);