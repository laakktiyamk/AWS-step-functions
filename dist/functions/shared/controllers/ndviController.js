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
exports.images = exports.image = exports.dates = void 0;
const rewind_1 = __importDefault(require("@turf/rewind"));
const hash = __importStar(require("../utils/hash"));
const geoUtils = require("../utils/geoUtils");
const getStatistics_CDSE_1 = require("../sentinelhub/getStatistics_CDSE");
const getImage_CDSE_1 = require("../sentinelhub/getImage_CDSE");
const imageDataRef = __importStar(require("../utils/image/getImageData"));
const dateTime = __importStar(require("../utils/dateTime"));
const mongodb = __importStar(require("../mongo/mongodb"));
const growingSeason_json_1 = __importDefault(require("../settings/growingSeason.json"));
const isdateingrowingseason_1 = __importDefault(require("../utils/isdateingrowingseason"));
const weatherService_1 = require("../services/weatherService");
const getTokenUserId_1 = require("../utils/getTokenUserId");
const growingSeasonUtils_1 = require("../utils/growingSeasonUtils");
// ============================================================
// p-limit korvaaja (toimii CommonJS + Docker)
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
            if (activeCount < concurrency) {
                run();
            }
            else {
                queue.push(run);
            }
        });
    };
}
// ============================================================
// Helpers
// ============================================================
const getSentinelDates = async (geometry, fromTime, toTime, authToken) => {
    let data = [];
    let stats = [];
    try {
        stats = await (0, getStatistics_CDSE_1.getStatistics)(geometry, fromTime?.toISOString() ?? "", toTime.toISOString(), authToken);
    }
    catch (e) {
        console.error("#### Error fetching statistics: ", e.error ? e.error.message : e.message);
        return data;
    }
    if (stats && stats.length > 0) {
        console.log("stats:", stats);
        const reversedStats = [...stats].reverse();
        for (const stat of reversedStats) {
            // Suodatetaan kasvukauden ulkopuoliset pois
            if (!(0, isdateingrowingseason_1.default)(stat.interval.from, growingSeason_json_1.default))
                continue;
            const statRef = stat.outputs.ndvi.bands.B0.stats;
            if (statRef.mean >= 0.1) {
                data.push({
                    generationtime: stat.interval.from,
                    stats: {
                        average: statRef.mean,
                        max: statRef.max,
                        min: statRef.min,
                        std: statRef.stDev,
                    },
                    sentinelid: stat.interval.from + "_" + hash.sha256(geometry),
                    ndviClassPercentages: stat.ndviClassPercentages,
                });
            }
        }
    }
    else {
        console.log("No data for the geometry", fromTime, " - ", toTime);
    }
    return data;
};
const getImageWithData = async (item, geometry, authToken) => {
    const image = await (0, getImage_CDSE_1.getImage)(item.generationtime, geometry, authToken);
    if (image) {
        const data = await imageDataRef.getImageData(geometry, image, { id: item.sentinelid, average: item.stats.average, max: item.stats.max, min: item.stats.min, std: item.stats.std }, item.ndviClassPercentages);
        return data;
    }
    return null;
};
const saveSentinelDataToMongo = async (save, geometry, fromTime, toTime, authToken, name = '', userId = '', kasvulohkot = []) => {
    const id = hash.sha256(geometry);
    const area = geoUtils.getAreaFromGeometry(geometry);
    let savedDates = [];
    let res = null;
    try {
        if (save) {
            res = await mongodb.saveDates(id, savedDates, geometry, area ?? 0, name, userId, kasvulohkot);
        }
        const startTime = performance.now();
        const dates = await getSentinelDates(geometry, fromTime, toTime, authToken);
        console.log(dates.length, " STATISTICS ElapsedTime (sec): ", (performance.now() - startTime) / 1000);
        if (dates.length > 0) {
            const startTime = performance.now();
            const limit = createLimit(5);
            await Promise.all(dates.map(item => limit(async () => {
                const _data = await getImageWithData(item, geometry, authToken);
                if (_data)
                    await mongodb.saveImage(_data);
            })));
            savedDates = dates.map(({ ndviClassPercentages, ...rest }) => rest);
            savedDates = dateTime.sortByDateTime(savedDates, "generationtime", "desc");
            res = await mongodb.updateDates(id, savedDates, userId);
            console.log(dates.length, " IMAGES ElapsedTime (sec): ", (performance.now() - startTime) / 1000);
            return res;
        }
        return false;
    }
    catch (e) {
        console.log("XXerror: ", e.message);
        return false;
    }
};
async function getDates(returnData, geometry, fromTime, toTime, authToken, name = '', userId = '', kasvulohkot = []) {
    const id = hash.sha256(geometry);
    let data = await mongodb.getDates(id);
    console.log('getDates: data in db:', data?.dates?.length ?? 0, 'dates');
    console.log('getDates: fromTime:', fromTime, 'toTime:', toTime);
    if (!data || !data.dates || data.dates.length === 0) {
        console.log('getDates: no data, fetching all');
        await saveSentinelDataToMongo(true, geometry, fromTime, toTime, authToken, name, userId, kasvulohkot);
    }
    else {
        console.log('getDates: newest:', data.dates[0].generationtime);
        console.log('getDates: oldest:', data.dates[data.dates.length - 1].generationtime);
        console.log('getDates: zeroDateTime(toTime):', dateTime.zeroDateTime(toTime));
        // Hae uudempaa dataa jos uusin tallennettu on ennen toTimea
        if (data.dates[0].generationtime < dateTime.zeroDateTime(toTime)) {
            const newFromTime = new Date(dateTime.addOneDay(data.dates[0].generationtime));
            console.log('getDates: fetching newer from:', newFromTime);
            await saveSentinelDataToMongo(false, geometry, newFromTime, toTime, authToken, name, userId);
        }
        // Hae vanhempaa dataa jos fromTime on ennen vanhinta tallennettua
        const oldestDate = data.dates[data.dates.length - 1]?.generationtime;
        if (fromTime && oldestDate && new Date(fromTime) < new Date(oldestDate)) {
            const backfillToTime = new Date(oldestDate);
            console.log('getDates: fetching older from:', fromTime, 'to:', backfillToTime);
            await saveSentinelDataToMongo(false, geometry, fromTime, backfillToTime, authToken, name, userId);
        }
        // Päivitä metadata
        if (kasvulohkot.length > 0 && (!data.kasvulohkot || data.kasvulohkot.length === 0)) {
            await mongodb.saveDates(id, data.dates, geometry, data.area ?? 0, name || data.name, userId, kasvulohkot);
        }
        else if ((name && !data.name) || (userId && !data.userIds?.includes(userId))) {
            await mongodb.saveDates(id, data.dates, geometry, data.area ?? 0, name || data.name, userId);
        }
    }
    if (returnData) {
        return await mongodb.getDates(id);
    }
    return null;
}
// ============================================================
// dates route handler
// ============================================================
const dates = async (req, res, next) => {
    const authToken = req.authToken ?? '';
    const startTime = performance.now();
    let geometry = null;
    try {
        const raw = typeof req.body.geometry !== "object"
            ? JSON.parse(req.body.geometry)
            : req.body.geometry;
        geometry = (0, rewind_1.default)(raw, { mutate: false });
    }
    catch (e) { }
    const fromTime = new Date(req.body.start_date);
    const name = req.body.name ?? '';
    const userId = (0, getTokenUserId_1.getUserId)(req);
    const kasvulohkot = req.body.kasvulohkot ?? [];
    const fromYear = fromTime.getFullYear();
    const toYear = new Date().getFullYear();
    const seasons = (0, growingSeasonUtils_1.getGrowingSeasons)(fromYear, toYear);
    if (seasons.length === 0) {
        res.status(404).send("no data available");
        return;
    }
    const sentinelFrom = seasons[0].start;
    const sentinelTo = seasons[seasons.length - 1].end;
    const data = await getDates(true, geometry, sentinelFrom, sentinelTo, authToken, name, userId, kasvulohkot);
    console.log("Request handled in (sec): ", (performance.now() - startTime) / 1000);
    // Sää: rinnakkain kasvukausittain
    const wStart = performance.now();
    await Promise.all(seasons.map(({ start, end }) => (0, weatherService_1.getWeatherFromDbOrFetch)(geometry, start, end)));
    console.log("Weather saved in (sec): ", (performance.now() - wStart) / 1000);
    if (data) {
        res.status(200).send(data);
    }
    else {
        res.status(404).send("no data available");
    }
};
exports.dates = dates;
const image = async (req, res, next) => {
    const id = req.params.sentinelid;
    const all = req.query.all;
    if (all) {
        const rawData = await mongodb.getAllImages(id);
        try {
            const data = rawData.map((item) => {
                const updatedImage = {
                    ...item.image,
                    dataUrl: `data:image/png;base64,${Buffer.from(item.image.dataUrl.buffer).toString('base64')}`,
                };
                return { ...item, image: updatedImage };
            });
            res.status(200).send(data);
            return;
        }
        catch (e) {
            if (e instanceof Error)
                console.log(e.message);
        }
    }
    const _data = await mongodb.getImage(id);
    if (_data) {
        const dataUrl = `data:image/png;base64,${Buffer.from(_data.image.dataUrl.buffer).toString('base64')}`;
        res.status(200).send({ ..._data, image: { ..._data.image, dataUrl } });
    }
};
exports.image = image;
const images = async (req, res, next) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids array required' });
        return;
    }
    try {
        const rawData = await mongodb.getImagesByIds(ids);
        const imageMap = rawData.reduce((acc, item) => {
            acc[item.id] = {
                ...item,
                image: {
                    ...item.image,
                    dataUrl: `data:image/png;base64,${Buffer.from(item.image.dataUrl.buffer).toString('base64')}`,
                },
            };
            return acc;
        }, {});
        res.status(200).json(imageMap);
    }
    catch (e) {
        if (e instanceof Error)
            console.error(e.message);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.images = images;
