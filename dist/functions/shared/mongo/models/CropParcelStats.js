"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CropParcelStats = void 0;
const mongoose_1 = require("mongoose");
const connections_1 = require("../connections");
const entrySchema = new mongoose_1.Schema({ date: { type: String, required: true }, mean: { type: Number, required: true } }, { _id: false });
const cropParcelStatsSchema = new mongoose_1.Schema({
    aoiId: { type: String, required: true },
    peruslohkotunnus: { type: String, required: true },
    lohkonumero: { type: String, required: true },
    vuosi: { type: String, required: true },
    kasvikoodi: String,
    stats: { type: [entrySchema], default: [] },
}, { timestamps: { createdAt: false, updatedAt: true } });
cropParcelStatsSchema.index({ aoiId: 1, peruslohkotunnus: 1, lohkonumero: 1, vuosi: 1 }, { unique: true });
exports.CropParcelStats = connections_1.parcelConnection.model('CropParcelStats', cropParcelStatsSchema, 'cropParcelStats');
