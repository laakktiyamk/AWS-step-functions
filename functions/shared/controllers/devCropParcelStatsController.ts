import { Response } from 'express';
import type { SentinelRequest } from '../sentinelhub/sentinelhub_token';
import rewind from '@turf/rewind';
import {geometryHash} from '../utils/hash';
import * as mongodb from '../mongo/mongodb';
import { getGrowingSeasons } from '../utils/growingSeasonUtils'
import { getByGeometry } from '../services/cropParcelService';
import { fetchAndSaveCropParcelStats } from '../services/cropParcelStatsService';
import { ensureParcelConnected } from '../mongo/connections';

const MAX_PARCEL_YEAR = 2025;

export const devCropParcelStats = async (req: SentinelRequest, res: Response) => {
  try {
    const geometry = req.body?.geometry;
    const vuosi = Number(req.body?.vuosi);
    if (!geometry || !Number.isInteger(vuosi)) {
      return res.status(400).json({ error: 'GEOMETRY_AND_VUOSI_REQUIRED' });
    }

    const authToken = req.authToken;
    if (!authToken) return res.status(409).json({ error: 'CDSE_NOT_CONNECTED' });

    const normalizedGeometry = rewind(geometry, { mutate: false });
    const id = geometryHash(normalizedGeometry);

    const existing = await mongodb.getDates(id);
    if (!existing?.dates?.length) return res.status(404).json({ error: 'FIELD_NOT_FOUND' });

    const season = getGrowingSeasons(vuosi, vuosi)[0];   // { start: Date, end: Date }
    if (!season) return res.status(400).json({ error: 'NO_SEASON' });

    const seasonStr = String(vuosi);
    const allowedDates = new Set<string>(
      existing.dates
        .map((d: any) => new Date(d.generationtime).toISOString().slice(0, 10))
        .filter((d: string) => d.startsWith(seasonStr))
    );

    await ensureParcelConnected();
    const parcelYear = Math.min(vuosi, MAX_PARCEL_YEAR);
    const parcels = (await getByGeometry(normalizedGeometry, parcelYear)).map((p: any) => ({
      peruslohkotunnus: p.peruslohkotunnus,
      lohkonumero: String(p.lohkonumero),
      vuosi: seasonStr,
      kasvikoodi: p.kasvikoodi,
      geometry: p.geometry,
    }));

    const result = await fetchAndSaveCropParcelStats(
      id, parcels,
      season.start.toISOString(), season.end.toISOString(),
      authToken, allowedDates
    );

    return res.json({ aoiId: id, season: seasonStr, parcelYear, parcels: parcels.length, allowedDates: allowedDates.size, ...result });
  } catch (err: any) {
    console.error('devCropParcelStats:', err);
    return res.status(500).json({ error: 'CROP_PARCEL_STATS_FAILED', message: err?.message });
  }
};
