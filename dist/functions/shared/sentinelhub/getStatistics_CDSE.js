"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatistics = void 0;
const axios_1 = __importDefault(require("axios"));
const bbox_1 = require("@turf/bbox");
const distance_1 = require("@turf/distance");
/** Sentinel-2:n B04/B08-kaistojen natiiviresoluutio metreinä. */
const STATS_METERS_PER_PIXEL = 10;
/**
 * Laskee statistiikkapyynnön pikselikoon geometrian bboxista natiiviresoluutiolla.
 *
 * @remarks
 * Statistical API laskuttaa PU:t pyydetyn rasterin (bbox) pikselimäärän mukaan.
 * Aiempi kiinteä 512 px:n pidempi sivu teki pienestä pellosta ~1 PU:n jokaista
 * aikanäytettä kohden ja interpoloi 10 m:n dataa näennäisesti tarkemmaksi.
 * Kuva (getImage_CDSE.ts) mitoitetaan erikseen visualisointia varten.
 *
 * @param geom - GeoJSON-geometria WGS84-koordinaatteina
 * @returns width ja height pikseleinä (vähintään 1)
 */
function getDimsForStats(geom) {
    const [minX, minY, maxX, maxY] = (0, bbox_1.bbox)(geom);
    const midY = (minY + maxY) / 2;
    const widthM = (0, distance_1.distance)([minX, midY], [maxX, midY], { units: "meters" });
    const heightM = (0, distance_1.distance)([minX, minY], [minX, maxY], { units: "meters" });
    return {
        width: Math.max(1, Math.ceil(widthM / STATS_METERS_PER_PIXEL)),
        height: Math.max(1, Math.ceil(heightM / STATS_METERS_PER_PIXEL)),
    };
}
const getStatistics = async (geometry, dateFrom, dateTo, authToken, throwOnError = false) => {
    const evalscript = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "classBand", bands: 1, sampleType: "UINT8" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  if (s.dataMask === 0) {
    return { ndvi: [0], classBand: [0], dataMask: [0] };
  }
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  let cls = 0;
  if      (ndvi < 0.30) cls = 1;
  else if (ndvi < 0.45) cls = 2;
  else if (ndvi < 0.60) cls = 3;
  else if (ndvi < 0.65) cls = 4;
  else if (ndvi < 0.70) cls = 5;
  else if (ndvi < 0.75) cls = 6;
  else if (ndvi < 0.80) cls = 7;
  else if (ndvi < 0.85) cls = 8;
  else                   cls = 9;
  return { ndvi: [ndvi], classBand: [cls], dataMask: [1] };
}
`;
    const { width, height } = getDimsForStats(geometry);
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    // Uusii CDSE:n ruuhkavirheet (429) ja tilapäiset palveluvirheet (503).
    // Odotus: suurempi arvo Retry-After-otsikosta (ms) ja porrastetusta odotuksesta,
    // lisättynä pienellä satunnaisuudella. Muita virheitä (esim. 400, 403) ei uusita.
    const withRetry = async (fn, attempts = 4) => {
        for (let i = 1;; i++) {
            try {
                return await fn();
            }
            catch (err) {
                const status = err?.response?.status;
                if (i >= attempts || (status !== 429 && status !== 503))
                    throw err;
                const retryAfter = Number(err?.response?.headers?.["retry-after"]) || 0; // ms
                const backoff = 1000 * 2 ** (i - 1);
                const wait = Math.min(Math.max(retryAfter, backoff), 10000) + Math.random() * 500;
                console.warn(`getStatistics: HTTP ${status}, uusinta ${i}/${attempts - 1} ${Math.round(wait)} ms kuluttua`);
                await sleep(wait);
            }
        }
    };
    // Yksi CDSE-pyyntö annetulle aikavälille. Palauttaa rivit sellaisenaan.
    const requestRows = async (from, to) => {
        const result = await withRetry(() => (0, axios_1.default)({
            method: "post",
            url: "https://sh.dataspace.copernicus.eu/api/v1/statistics",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
            },
            timeout: 30000,
            data: {
                input: {
                    bounds: { geometry },
                    data: [
                        {
                            dataFilter: { maxCloudCoverage: 20 },
                            type: "sentinel-2-l2a",
                        },
                    ],
                },
                aggregation: {
                    timeRange: { from, to },
                    aggregationInterval: { of: "P1D" },
                    width,
                    height,
                    evalscript,
                },
                calculations: {
                    ndvi: {},
                    classBand: {
                        histograms: {
                            default: {
                                nBins: 10,
                                lowEdge: 0,
                                highEdge: 10,
                            },
                        },
                    },
                },
            },
        }));
        // PU-luku pidetään rivin viimeisenä, jotta CloudWatch-kyselyn parse toimii.
        console.log('[PU] statistics', from, to, `${width}x${height}`, result.headers['x-processingunits-spent']);
        return result.data.data ?? [];
    };
    try {
        const raw = await requestRows(dateFrom, dateTo);
        // CDSE palauttaa joskus rivin, jossa on error (esim. 3 s aikakatkaisu).
        // Yritetään vain nämä päivät uudelleen yksitellen.
        const rows = [];
        for (const row of raw) {
            if (!row?.error) {
                rows.push(row);
                continue;
            }
            let fixed = null;
            for (let attempt = 1; attempt <= 2 && !fixed; attempt++) {
                await sleep(1000 * attempt);
                try {
                    const retry = await requestRows(row.interval.from, row.interval.to);
                    if (retry.length > 0 && !retry.some((r) => r?.error))
                        fixed = retry;
                }
                catch {
                    // yritetään uudelleen
                }
            }
            if (fixed) {
                console.log(`getStatistics: uudelleenyritys onnistui ${row.interval.from}`);
                rows.push(...fixed);
            }
            else {
                console.log(`getStatistics: uudelleenyritys epäonnistui ${row.interval.from}`);
                rows.push(row); // jää suodattimen pudotettavaksi
            }
        }
        // Suodatetaan rivit, joilta puuttuu NDVI-statistiikka
        const days = rows.filter((d) => d?.outputs?.ndvi?.bands?.B0?.stats);
        if (days.length < rows.length) {
            const dropped = rows.find((d) => !d?.outputs?.ndvi?.bands?.B0?.stats);
            console.log(`getStatistics: ohitettu ${rows.length - days.length}/${rows.length} riviä ilman stats-dataa, esimerkki:`, JSON.stringify(dropped).slice(0, 300));
        }
        return days.map((dayData) => {
            const bins = dayData.outputs?.classBand?.bands?.B0?.histogram?.bins ?? [];
            const total = bins.reduce((sum, b) => sum + b.count, 0);
            const raw = [
                bins.filter(b => b.lowEdge === 1).reduce((sum, b) => sum + b.count, 0),
                bins.filter(b => b.lowEdge === 2).reduce((sum, b) => sum + b.count, 0),
                bins.filter(b => b.lowEdge === 3).reduce((sum, b) => sum + b.count, 0),
                bins.filter(b => b.lowEdge >= 4).reduce((sum, b) => sum + b.count, 0),
            ].map(count => total > 0 ? (count / total) * 100 : 0);
            // Pyöristetään ja korjataan erotus
            const floored = raw.map(v => Math.floor(v));
            const remainders = raw.map((v, i) => ({ index: i, remainder: v - floored[i] }));
            const diff = 100 - floored.reduce((sum, v) => sum + v, 0);
            remainders
                .sort((a, b) => b.remainder - a.remainder)
                .slice(0, diff)
                .forEach(r => floored[r.index]++);
            const ndviClassPercentages = floored;
            return {
                interval: dayData.interval,
                outputs: {
                    ndvi: dayData.outputs.ndvi,
                },
                ndviClassPercentages,
            };
        });
    }
    catch (err) {
        if (throwOnError)
            throw err;
        if (axios_1.default.isAxiosError(err)) {
            console.error("Sentinel API error:", err.response?.data);
        }
        else {
            console.error("Unknown error:", err);
        }
        return [];
    }
};
exports.getStatistics = getStatistics;
