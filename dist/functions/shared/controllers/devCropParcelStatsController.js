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
exports.devCropParcelStats = void 0;
const rewind_1 = __importDefault(require("@turf/rewind"));
const hash_1 = require("../utils/hash");
const mongodb = __importStar(require("../mongo/mongodb"));
const growingSeasonUtils_1 = require("../utils/growingSeasonUtils");
const cropParcelService_1 = require("../services/cropParcelService");
const cropParcelStatsService_1 = require("../services/cropParcelStatsService");
const connections_1 = require("../mongo/connections");
const MAX_PARCEL_YEAR = 2025;
const devCropParcelStats = async (req, res) => {
    try {
        const geometry = req.body?.geometry;
        const vuosi = Number(req.body?.vuosi);
        if (!geometry || !Number.isInteger(vuosi)) {
            return res.status(400).json({ error: 'GEOMETRY_AND_VUOSI_REQUIRED' });
        }
        const authToken = req.authToken;
        if (!authToken)
            return res.status(409).json({ error: 'CDSE_NOT_CONNECTED' });
        const normalizedGeometry = (0, rewind_1.default)(geometry, { mutate: false });
        const id = (0, hash_1.geometryHash)(normalizedGeometry);
        const existing = await mongodb.getDates(id);
        if (!existing?.dates?.length)
            return res.status(404).json({ error: 'FIELD_NOT_FOUND' });
        const season = (0, growingSeasonUtils_1.getGrowingSeasons)(vuosi, vuosi)[0]; // { start: Date, end: Date }
        if (!season)
            return res.status(400).json({ error: 'NO_SEASON' });
        const seasonStr = String(vuosi);
        const allowedDates = new Set(existing.dates
            .map((d) => new Date(d.generationtime).toISOString().slice(0, 10))
            .filter((d) => d.startsWith(seasonStr)));
        await (0, connections_1.ensureParcelConnected)();
        const parcelYear = Math.min(vuosi, MAX_PARCEL_YEAR);
        const parcels = (await (0, cropParcelService_1.getByGeometry)(normalizedGeometry, parcelYear)).map((p) => ({
            peruslohkotunnus: p.peruslohkotunnus,
            lohkonumero: String(p.lohkonumero),
            vuosi: seasonStr,
            kasvikoodi: p.kasvikoodi,
            geometry: p.geometry,
        }));
        const result = await (0, cropParcelStatsService_1.fetchAndSaveCropParcelStats)(id, parcels, season.start.toISOString(), season.end.toISOString(), authToken, allowedDates);
        return res.json({ aoiId: id, season: seasonStr, parcelYear, parcels: parcels.length, allowedDates: allowedDates.size, ...result });
    }
    catch (err) {
        console.error('devCropParcelStats:', err);
        return res.status(500).json({ error: 'CROP_PARCEL_STATS_FAILED', message: err?.message });
    }
};
exports.devCropParcelStats = devCropParcelStats;
