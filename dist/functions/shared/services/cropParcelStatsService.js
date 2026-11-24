"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAndSaveCropParcelStats = fetchAndSaveCropParcelStats;
exports.syncCropParcelStatsForDates = syncCropParcelStatsForDates;
const getStatistics_CDSE_1 = require("../sentinelhub/getStatistics_CDSE");
const CropParcelStats_1 = require("../mongo/models/CropParcelStats");
const connections_1 = require("../mongo/connections");
const cropParcelService_1 = require("./cropParcelService");
const MAX_PARCEL_YEAR = 2025;
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
async function fetchAndSaveCropParcelStats(aoiId, parcels, dateFrom, dateTo, authToken, allowedDates) {
    let ok = 0;
    let failed = 0;
    const handleOne = async (p) => {
        try {
            const days = await (0, getStatistics_CDSE_1.getStatistics)(p.geometry, dateFrom, dateTo, authToken, true);
            const fresh = days
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
            const existing = await CropParcelStats_1.CropParcelStats.findOne(key, { stats: 1 }).lean();
            const merged = new Map();
            existing?.stats?.forEach(e => merged.set(e.date, e.mean));
            fresh.forEach(e => merged.set(e.date, e.mean));
            const stats = [...merged.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, mean]) => ({ date, mean }));
            await CropParcelStats_1.CropParcelStats.updateOne(key, { $set: { stats, kasvikoodi: p.kasvikoodi } }, { upsert: true });
            ok++;
        }
        catch (err) {
            failed++;
            console.error(`cropParcelStats: ${p.peruslohkotunnus}/${p.lohkonumero}/${p.vuosi} epäonnistui:`, err?.response?.status ?? err?.message);
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
async function syncCropParcelStatsForDates(aoiId, geometry, dates, authToken) {
    console.log('syncCropParcelStatsForDates', aoiId, 'dates:', dates.length, 'token:', !!authToken);
    if (!authToken || dates.length === 0)
        return;
    const byYear = new Map();
    for (const d of dates) {
        const day = new Date(d.generationtime).toISOString().slice(0, 10);
        const year = day.slice(0, 4);
        byYear.set(year, [...(byYear.get(year) ?? []), day]);
    }
    try {
        await (0, connections_1.ensureParcelConnected)();
        for (const [year, days] of byYear) {
            days.sort();
            const parcelYear = Math.min(Number(year), MAX_PARCEL_YEAR);
            const parcels = (await (0, cropParcelService_1.getByGeometry)(geometry, parcelYear)).map((p) => ({
                peruslohkotunnus: p.peruslohkotunnus,
                lohkonumero: String(p.lohkonumero),
                vuosi: year,
                kasvikoodi: p.kasvikoodi,
                geometry: p.geometry,
            }));
            console.log(`cropParcelStats ${year}: parcels ${parcels.length}`);
            if (parcels.length === 0)
                continue;
            const result = await fetchAndSaveCropParcelStats(aoiId, parcels, `${days[0]}T00:00:00Z`, `${days[days.length - 1]}T23:59:59Z`, authToken, new Set(days));
            console.log(`cropParcelStats ${year}: ${days.length} pv, ${parcels.length} lohkoa`, result);
        }
    }
    catch (err) {
        console.error('syncCropParcelStatsForDates failed:', err?.message);
    }
}
