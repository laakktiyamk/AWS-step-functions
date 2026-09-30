"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAOI = exports.syncDates = exports.fetchAndSaveDates = exports.fetchWeather = exports.fetchAndSaveImage = exports.getSentinelDates = void 0;
const rewind_1 = __importDefault(require("@turf/rewind"));
const hash = __importStar(require("../utils/hash"));
const dateTime = __importStar(require("../utils/dateTime"));
const mongodb = __importStar(require("../mongo/mongodb"));
const getStatistics_CDSE_1 = require("../sentinelhub/getStatistics_CDSE");
const getImage_CDSE_1 = require("../sentinelhub/getImage_CDSE");
const imageDataRef = __importStar(require("../utils/image/getImageData"));
const growingSeason_json_1 = __importDefault(require("../settings/growingSeason.json"));
const isdateingrowingseason_1 = __importDefault(require("../utils/isdateingrowingseason"));
const weatherService_1 = require("./weatherService");
const growingSeasonUtils_1 = require("../utils/growingSeasonUtils");
const geoUtils = require('../utils/geoUtils');
// ============================================================
// Concurrency limiter (REST API käyttää, Step Functions ei)
// ============================================================
function createLimit(concurrency) {
    let activeCount = 0;
    const queue = [];
    const next = () => {
        activeCount--;
        if (queue.length > 0) {
            const fn = queue.shift();
            if (fn)
                fn();
        }
    };
    return function limit(fn) {
        return new Promise((resolve, reject) => {
            const run = () => {
                activeCount++;
                fn()
                    .then((val) => { resolve(val); next(); })
                    .catch((err) => { reject(err); next(); });
            };
            if (activeCount < concurrency)
                run();
            else
                queue.push(run);
        });
    };
}
// ============================================================
// getSentinelDates — hakee statistiikat CDSE:ltä
// ============================================================
const getSentinelDates = async (geometry, fromTime, toTime, authToken) => {
    let stats = [];
    try {
        stats = await (0, getStatistics_CDSE_1.getStatistics)(geometry, fromTime?.toISOString() ?? '', toTime.toISOString(), authToken);
    }
    catch (e) {
        console.error('getSentinelDates error:', e.error ? e.error.message : e.message);
        return [];
    }
    if (!stats || stats.length === 0) {
        console.log('No statistics for geometry', fromTime, '-', toTime);
        return [];
    }
    const result = [];
    for (const stat of [...stats].reverse()) {
        if (!(0, isdateingrowingseason_1.default)(stat.interval.from, growingSeason_json_1.default))
            continue;
        const s = stat.outputs.ndvi.bands.B0.stats;
        if (s.mean >= 0.1) {
            result.push({
                generationtime: stat.interval.from,
                stats: { average: s.mean, max: s.max, min: s.min, std: s.stDev },
                sentinelid: stat.interval.from + '_' + hash.sha256(geometry),
                ndviClassPercentages: stat.ndviClassPercentages,
            });
        }
    }
    return result;
};
exports.getSentinelDates = getSentinelDates;
// ============================================================
// fetchAndSaveImage — hakee yhden kuvan ja tallentaa
// Step Functions processor Lambda käyttää tätä
// ============================================================
const fetchAndSaveImage = async (item, geometry, authToken) => {
    try {
        const image = await (0, getImage_CDSE_1.getImage)(item.generationtime, geometry, authToken);
        if (!image)
            return false;
        const data = await imageDataRef.getImageData(geometry, image, { id: item.sentinelid, average: item.stats.average, max: item.stats.max, min: item.stats.min, std: item.stats.std }, item.ndviClassPercentages);
        if (data)
            await mongodb.saveImage(data);
        return !!data;
    }
    catch (e) {
        console.error('fetchAndSaveImage error:', e.message);
        return false;
    }
};
exports.fetchAndSaveImage = fetchAndSaveImage;
// ============================================================
// fetchAndSaveImages — hakee kuvat rinnakkain (REST API käyttää)
// Step Functions korvaa tämän Map-statella
// ============================================================
const fetchAndSaveImages = async (dates, geometry, authToken) => {
    const limit = createLimit(5);
    await Promise.all(dates.map(item => limit(() => (0, exports.fetchAndSaveImage)(item, geometry, authToken))));
};
// ============================================================
// fetchWeather — hakee sään rinnakkain kasvukausittain
// ============================================================
const fetchWeather = async (geometry, seasons) => {
    await Promise.all(seasons.map(({ start, end }) => (0, weatherService_1.getWeatherFromDbOrFetch)(geometry, start, end)));
};
exports.fetchWeather = fetchWeather;
// ============================================================
// fetchAndSaveDates — hakee statistiikat (ja kuvat jos saveImages),
// tallentaa päivät kantaan. Palauttaa haetut päivät.
// ============================================================
const fetchAndSaveDates = async (geometry, fromTime, toTime, authToken, name = '', userId = '', kasvulohkot = [], saveImages = true // false = Step Functions hoitaa kuvat
) => {
    const id = hash.sha256(geometry);
    const area = geoUtils.getAreaFromGeometry(geometry);
    // Luodaan tyhjä dokumentti ennen hakua, jos sitä ei ole vielä.
    // updateDates ei tee upsertia, joten dokumentin täytyy olla olemassa.
    const existing = await mongodb.getDates(id);
    if (!existing) {
        await mongodb.saveDates(id, [], geometry, area ?? 0, name, userId, kasvulohkot);
    }
    const dates = await (0, exports.getSentinelDates)(geometry, fromTime, toTime, authToken);
    console.log(dates.length, 'dates fetched');
    if (dates.length === 0)
        return [];
    if (saveImages) {
        await fetchAndSaveImages(dates, geometry, authToken);
    }
    const savedDates = dateTime.sortByDateTime(dates.map(({ ndviClassPercentages, ...rest }) => rest), 'generationtime', 'desc');
    // updateDates lisää päivät taulukon alkuun (ei korvaa vanhoja)
    await mongodb.updateDates(id, savedDates, userId);
    return dates;
};
exports.fetchAndSaveDates = fetchAndSaveDates;
// ============================================================
// syncDates — tarkistaa mitä dataa on kannassa ja hakee puuttuvan.
// Yhteinen REST API:lle (saveImages: true) ja
// Step Functionsille (saveImages: false).
// ============================================================
const syncDates = async (geometry, startDate, authToken, name = '', userId = '', kasvulohkot = [], saveImages = true) => {
    const normalizedGeometry = (0, rewind_1.default)(geometry, { mutate: false });
    const id = hash.sha256(normalizedGeometry);
    const fromYear = startDate.getFullYear();
    const toYear = new Date().getFullYear();
    const seasons = (0, growingSeasonUtils_1.getGrowingSeasons)(fromYear, toYear);
    if (seasons.length === 0)
        return null;
    const sentinelFrom = seasons[0].start;
    const sentinelTo = seasons[seasons.length - 1].end;
    const existing = await mongodb.getDates(id);
    const newDates = [];
    if (!existing || !existing.dates || existing.dates.length === 0) {
        // Ei dataa — haetaan kaikki
        newDates.push(...await (0, exports.fetchAndSaveDates)(normalizedGeometry, sentinelFrom, sentinelTo, authToken, name, userId, kasvulohkot, saveImages));
    }
    else {
        // Haetaan uudempaa jos tarvitaan
        if (existing.dates[0].generationtime < dateTime.zeroDateTime(sentinelTo)) {
            const newFrom = new Date(dateTime.addOneDay(existing.dates[0].generationtime));
            newDates.push(...await (0, exports.fetchAndSaveDates)(normalizedGeometry, newFrom, sentinelTo, authToken, name, userId, [], saveImages));
        }
        // Haetaan vanhempaa jos tarvitaan
        const oldestDate = existing.dates[existing.dates.length - 1]?.generationtime;
        if (oldestDate && sentinelFrom < new Date(oldestDate)) {
            newDates.push(...await (0, exports.fetchAndSaveDates)(normalizedGeometry, sentinelFrom, new Date(oldestDate), authToken, name, userId, [], saveImages));
        }
        // Päivitetään metadata
        if (kasvulohkot.length > 0 && (!existing.kasvulohkot || existing.kasvulohkot.length === 0)) {
            await mongodb.saveDates(id, existing.dates, normalizedGeometry, existing.area ?? 0, name || existing.name, userId, kasvulohkot);
        }
        else if ((name && !existing.name) || (userId && !existing.userIds?.includes(userId))) {
            await mongodb.saveDates(id, existing.dates, normalizedGeometry, existing.area ?? 0, name || existing.name, userId);
        }
    }
    return { geometry: normalizedGeometry, seasons, newDates };
};
exports.syncDates = syncDates;
// ============================================================
// syncAOIInternal — REST API: päivät + kuvat + sää
// ============================================================
const syncAOIInternal = async (geometry, startDate, authToken, name = '', userId = '', kasvulohkot = []) => {
    const result = await (0, exports.syncDates)(geometry, startDate, authToken, name, userId, kasvulohkot, true);
    if (!result)
        return null;
    await (0, exports.fetchWeather)(result.geometry, result.seasons);
    return await mongodb.getDates(hash.sha256(result.geometry));
};
// ============================================================
// syncAOI — REST API orkestroija
// Estää samanaikaiset haut samalle AOI:lle (vain yhden Node-prosessin sisällä)
// ============================================================
const inFlight = new Map();
const syncAOI = (geometry, startDate, authToken, name = '', userId = '', kasvulohkot = []) => {
    const id = hash.sha256((0, rewind_1.default)(geometry, { mutate: false }));
    const running = inFlight.get(id);
    if (running)
        return running; // toinen pyyntö odottaa saman haun tulosta
    const promise = syncAOIInternal(geometry, startDate, authToken, name, userId, kasvulohkot)
        .finally(() => inFlight.delete(id));
    inFlight.set(id, promise);
    return promise;
};
exports.syncAOI = syncAOI;
