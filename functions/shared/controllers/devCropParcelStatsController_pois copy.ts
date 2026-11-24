import { Request, Response } from 'express';
import { Dates } from '../mongo/models/Dates';    
import { getByGeometry } from '../services/cropParcelService';  // POST /crop-parcels käyttää tätä
import { fetchAndSaveCropParcelStats } from '../services/cropParcelStatsService';
import growingSeason from '../settings/growingSeason.json';
import {geometryHash} from '../utils/hash';   // sama import kuin weatherService.ts:ssä




const MAX_PARCEL_YEAR = 2025;
const pad = (n: number) => String(n).padStart(2, '0');

export const devCropParcelStats = async (req: Request, res: Response) => {
  const { fieldId, vuosi } = req.body as { fieldId: string; vuosi: number };
  const authToken = (req as any).authToken;                     // TODO 2: kenttä, jonka checkUserToken asettaa

  const field = await Dates.findById(fieldId).lean();
  if (!field) return res.status(404).json({ error: 'FIELD_NOT_FOUND' });

  const aoiId = geometryHash((field as any).geometry);
  const season = String(vuosi);

  const parcelYear = Math.min(vuosi, MAX_PARCEL_YEAR);  // number, 2026 → 2025

  const { startMonth, startDay, endMonth, endDay } = growingSeason;
  const from = `${season}-${pad(startMonth)}-${pad(startDay)}T00:00:00Z`;
  const to   = `${season}-${pad(endMonth)}-${pad(endDay)}T23:59:59Z`;

  const allowedDates = new Set<string>(
    (field as any).dates
      .map((d: any) => String(d.date ?? d).slice(0, 10))        // TODO 4: dates[]-alkion muoto
      .filter((d: string) => d.startsWith(season))
  );

  const parcels = (await getByGeometry((field as any).geometry, parcelYear)).map((p: any) => ({
    peruslohkotunnus: p.peruslohkotunnus,
    lohkonumero: String(p.lohkonumero),
    vuosi: season,                                              // avain = tilastokausi, ei lohkojen vuosi
    kasvikoodi: p.kasvikoodi,
    geometry: p.geometry,
  }));

  const result = await fetchAndSaveCropParcelStats(
    aoiId, parcels, from, to, authToken, allowedDates
  );

  res.json({ aoiId, season, parcelYear, parcels: parcels.length, allowedDates: allowedDates.size, ...result });
};