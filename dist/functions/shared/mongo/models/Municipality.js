"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Municipality = void 0;
const mongoose_1 = require("mongoose");
const connections_1 = require("../connections");
const MunicipalitySchema = new mongoose_1.Schema({
    kunta: { type: String, required: true, unique: true },
    nimi: { type: String, required: true },
    bbox: { type: [Number], required: true },
    geometry: {
        type: { type: String, enum: ["Polygon", "MultiPolygon"], required: true },
        coordinates: { type: mongoose_1.Schema.Types.Mixed, required: true },
    },
}, { collection: "municipalities" });
MunicipalitySchema.index({ geometry: "2dsphere" });
const MunicipalityModel = connections_1.parcelConnection.model("Municipality", MunicipalitySchema);
exports.Municipality = MunicipalityModel;
