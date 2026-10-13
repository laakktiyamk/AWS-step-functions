"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MlWeather = exports.mlWeatherStore = void 0;
const mongoose_1 = require("mongoose");
const connections_1 = require("../connections");
const MlWeatherSchema = new mongoose_1.Schema({
    sentinelid: { type: String, required: true },
    geometryHash: { type: String, required: true },
    date: { type: Date, required: true },
    temperature_2m_mean: { type: Number, default: null },
    temperature_2m_max: { type: Number, default: null },
    temperature_2m_min: { type: Number, default: null },
    precipitation_sum: { type: Number, default: null },
    shortwave_radiation_sum: { type: Number, default: null },
    et0_fao_evapotranspiration: { type: Number, default: null },
    relative_humidity_2m_mean: { type: Number, default: null },
    wind_speed_10m_mean: { type: Number, default: null },
}, {
    collection: "ML_weather",
});
MlWeatherSchema.index({ sentinelid: 1 }, { unique: true });
MlWeatherSchema.index({ geometryHash: 1, date: 1 });
const MlWeatherModel = connections_1.parcelConnection.model("MlWeather", MlWeatherSchema);
exports.MlWeather = MlWeatherModel;
// ML-ajon säädatan tallennus Azureen (WeatherStore, ks. weatherService.ts)
exports.mlWeatherStore = {
    saveMany: async (items) => {
        if (items.length === 0)
            return;
        await MlWeatherModel.bulkWrite(items.map((item) => ({
            updateOne: {
                filter: { sentinelid: item.sentinelid },
                update: { $set: { ...item, date: new Date(item.date) } },
                upsert: true,
            },
        })), { ordered: false });
    },
    getByRange: async (geometryHash, start, end) => {
        const rows = await MlWeatherModel
            .find({ geometryHash, date: { $gte: start, $lte: end } })
            .sort({ date: 1 })
            .lean();
        return rows;
    },
};
