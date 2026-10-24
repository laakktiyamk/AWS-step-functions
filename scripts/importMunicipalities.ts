import fs from "fs";
import path from "path";
import rewind from "@turf/rewind";
import { ensureParcelConnected } from "../functions/shared/mongo/connections";
import { Municipality } from "../functions/shared/mongo/models/Municipality";

const LAYER = process.argv[2] ?? "kunta4500k";
const URL =
  "https://geo.stat.fi/geoserver/tilastointialueet/wfs" +
  `?service=WFS&version=2.0.0&request=GetFeature&typeNames=tilastointialueet:${LAYER}` +
  "&outputFormat=application/json&srsName=EPSG:4326";

async function main() {
  console.log(`Fetching ${LAYER}...`);
  const resp = await fetch(URL);
  if (!resp.ok) throw new Error(`WFS request failed: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();

  await ensureParcelConnected();
  await Municipality.init(); // luo indeksit (unique + 2dsphere) ennen kirjoitusta

  const ops = data.features.map((f: any) => {
    const fixed: any = rewind(f, { reverse: false });
    return {
      updateOne: {
        filter: { kunta: f.properties.kunta },
        update: {
          $set: {
            kunta: f.properties.kunta,
            nimi: f.properties.nimi,
            bbox: f.bbox,
            geometry: fixed.geometry,
          },
        },
        upsert: true,
      },
    };
  });

  const res = await Municipality.bulkWrite(ops);
  console.log(`Features: ${data.features.length}, upserted: ${res.upsertedCount}, modified: ${res.modifiedCount}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});