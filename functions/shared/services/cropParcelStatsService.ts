import { getStatistics, Geometry } from '../sentinelhub/getStatistics_CDSE';
import { CropParcelStats, ICropParcelStatsEntry } from '../mongo/models/CropParcelStats';

import { ensureParcelConnected } from '../mongo/connections';
import { getByGeometry } from './cropParcelService';

const MAX_PARCEL_YEAR = 2025;


export interface CropParcelInput {
  peruslohkotunnus: string;
  lohkonumero: string;
  vuosi: string;
  kasvikoodi?: string;
  geometry: Geometry;
}

const CONCURRENCY = 3;

/**
 * Hakee kasvulohkojen NDVI-keskiarvot aikavälille ja tallentaa ne cropParcelStats-kokoelmaan.
 *
 * @remarks
 * Vain AOI:n omat päivät (allowedDates) tallennetaan, jotta kasvulohkon ja peltolohkon
 * käyrät osuvat samoille päiville. Olemassa olevat päivät yhdistetään uusiin
 * (kauden aikainen päivitys hakee vain uudet päivät). Yhden lohkon virhe ei kaada muita.
 *
 * @param aoiId - pellon geometryHash
 * @param parcels - kasvulohkot geometrioineen (saman vuoden lohkot)
 * @param dateFrom - aikavälin alku (ISO)
 * @param dateTo - aikavälin loppu (ISO)
 * @param authToken - käyttäjän CDSE-token
 * @param allowedDates - AOI:n päivät muodossa YYYY-MM-DD
 * @returns onnistuneiden ja epäonnistuneiden lohkojen määrä
 */
export async function fetchAndSaveCropParcelStats(
  aoiId: string,
  parcels: CropParcelInput[],
  dateFrom: string,
  dateTo: string,
  authToken: string,
  allowedDates: Set<string>
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;

  const handleOne = async (p: CropParcelInput) => {
    try {
      const days = await getStatistics(p.geometry, dateFrom, dateTo, authToken, true);

// DEBUG: mitkä pellon päivät puuttuvat tai ovat NaN lohkolla
      const returned = new Map(
        days.map((d: any) => [d.interval.from.slice(0, 10), d.outputs?.ndvi?.bands?.B0?.stats?.mean])
      );
      const missing = [...allowedDates].filter(d => !returned.has(d));
      const nan = [...allowedDates].filter(d => returned.has(d) && !Number.isFinite(returned.get(d)));
      //console.log(`cropParcelStats DEBUG ${p.peruslohkotunnus}/${p.lohkonumero}`,
      //  { range: `${dateFrom} → ${dateTo}`, allowed: allowedDates.size, returned: returned.size, missing, nan });

      const fresh: ICropParcelStatsEntry[] = days
        .map(d => ({
          date: d.interval.from.slice(0, 10),
          mean: d.outputs.ndvi.bands.B0.stats.mean,
        }))
        .filter(e => allowedDates.has(e.date) && Number.isFinite(e.mean));

      const key = {
        aoiId,
        peruslohkotunnus: p.peruslohkotunnus,
        lohkonumero: p.lohkonumero,
        vuosi: p.vuosi,
      };

      const existing = await CropParcelStats.findOne(key, { stats: 1 }).lean();
      const merged = new Map<string, number>();
      existing?.stats?.forEach(e => merged.set(e.date, e.mean));
      fresh.forEach(e => merged.set(e.date, e.mean));

      const stats = [...merged.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, mean]) => ({ date, mean }));

      await CropParcelStats.updateOne(
        key,
        { $set: { stats, kasvikoodi: p.kasvikoodi } },
        { upsert: true }
      );
      ok++;
    } catch (err: any) {
      failed++;
      console.error(
        `cropParcelStats: ${p.peruslohkotunnus}/${p.lohkonumero}/${p.vuosi} epäonnistui:`,
        err?.response?.status ?? err?.message
      );
    }
  };

  for (let i = 0; i < parcels.length; i += CONCURRENCY) {
    await Promise.all(parcels.slice(i, i + CONCURRENCY).map(handleOne));
  }

  return { ok, failed };
}


/**
 * Hakee kasvulohkojen tilastot pellon uusille päiville.
 *
 * @remarks
 * Päivät ryhmitellään vuosittain, koska kasvulohkot vaihtuvat vuosittain.
 * Jokaiselle vuodelle haetaan vain väli uusimman ja vanhimman uuden päivän välillä.
 * Virhe ei kaada pellon NDVI-tallennusta, vaan se kirjataan lokiin.
 */
export async function syncCropParcelStatsForDates(
  aoiId: string,
  geometry: any,
  dates: { generationtime: string }[],
  authToken: string
): Promise<void> {
  //console.log('syncCropParcelStatsForDates', aoiId, 'dates:', dates.length, 'token:', !!authToken);
  if (!authToken || dates.length === 0) return;

  const byYear = new Map<string, string[]>();
  for (const d of dates) {
    const day = new Date(d.generationtime).toISOString().slice(0, 10);
    const year = day.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), day]);
  }

    try {
    await ensureParcelConnected();

    for (const [year, days] of byYear) {
      days.sort();
      const parcelYear = Math.min(Number(year), MAX_PARCEL_YEAR);
      const parcels = (await getByGeometry(geometry, parcelYear)).map((p: any) => ({
        peruslohkotunnus: p.peruslohkotunnus,
        lohkonumero: String(p.lohkonumero),
        vuosi: year,
        kasvikoodi: p.kasvikoodi,
        geometry: p.geometry,
      }));

      if (parcels.length === 0) continue;

      // Loppu = viimeistä päivää seuraavan päivän alku: Statistical API:n P1D-intervallit
      // alkavat from-hetkestä, ja vajaa viimeinen intervalli jätetään pois (lastIntervalBehavior SKIP)
      const dayAfter = new Date(`${days[days.length - 1]}T00:00:00Z`);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

      const result = await fetchAndSaveCropParcelStats(
        aoiId, parcels,
        `${days[0]}T00:00:00Z`, dayAfter.toISOString(),
        authToken, new Set(days)
      );
      console.log(`cropParcelStats ${year}: ${days.length} pv, ${parcels.length} lohkoa`, result);
    }
  } catch (err: any) {
    console.error('syncCropParcelStatsForDates failed:', err?.message);
  }
}