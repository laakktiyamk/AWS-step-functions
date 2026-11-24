"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.devCropParcelStats = void 0;
const Dates_1 = require("../mongo/models/Dates");
const cropParcelService_1 = require("../services/cropParcelService"); // POST /crop-parcels käyttää tätä
const cropParcelStatsService_1 = require("../services/cropParcelStatsService");
const growingSeason_json_1 = __importDefault(require("../settings/growingSeason.json"));
const hash_1 = require("../utils/hash"); // sama import kuin weatherService.ts:ssä
const MAX_PARCEL_YEAR = 2025;
const pad = (n) => String(n).padStart(2, '0');
const devCropParcelStats = async (req, res) => {
    const { fieldId, vuosi } = req.body;
    const authToken = req.authToken; // TODO 2: kenttä, jonka checkUserToken asettaa
    const field = await Dates_1.Dates.findById(fieldId).lean();
    if (!field)
        return res.status(404).json({ error: 'FIELD_NOT_FOUND' });
    const aoiId = (0, hash_1.geometryHash)(field.geometry);
    const season = String(vuosi);
    const parcelYear = Math.min(vuosi, MAX_PARCEL_YEAR); // number, 2026 → 2025
    const { startMonth, startDay, endMonth, endDay } = growingSeason_json_1.default;
    const from = `${season}-${pad(startMonth)}-${pad(startDay)}T00:00:00Z`;
    const to = `${season}-${pad(endMonth)}-${pad(endDay)}T23:59:59Z`;
    const allowedDates = new Set(field.dates
        .map((d) => String(d.date ?? d).slice(0, 10)) // TODO 4: dates[]-alkion muoto
        .filter((d) => d.startsWith(season)));
    const parcels = (await (0, cropParcelService_1.getByGeometry)(field.geometry, parcelYear)).map((p) => ({
        peruslohkotunnus: p.peruslohkotunnus,
        lohkonumero: String(p.lohkonumero),
        vuosi: season, // avain = tilastokausi, ei lohkojen vuosi
        kasvikoodi: p.kasvikoodi,
        geometry: p.geometry,
    }));
    const result = await (0, cropParcelStatsService_1.fetchAndSaveCropParcelStats)(aoiId, parcels, from, to, authToken, allowedDates);
    res.json({ aoiId, season, parcelYear, parcels: parcels.length, allowedDates: allowedDates.size, ...result });
};
exports.devCropParcelStats = devCropParcelStats;
