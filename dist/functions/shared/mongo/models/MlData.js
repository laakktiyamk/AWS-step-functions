"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MlData = void 0;
const mongoose_1 = require("mongoose");
const connections_1 = require("../connections");
const MlDataSchema = new mongoose_1.Schema({
    // Tunnisteet
    geometryHash: { type: String, required: true },
    batchId: { type: String },
    // Lähdepelto (Ruokavirasto)
    peruslohkotunnus: { type: String },
    vuosi: { type: String },
    pinta_ala: { type: Number },
    // Geometria
    geometry: {
        type: { type: String, enum: ["Polygon", "MultiPolygon"] },
        coordinates: { type: mongoose_1.Schema.Types.Mixed },
    },
    // Havaintojen määrä kasvukausittain, esim. [{ year: 2020, count: 14 }, ...]
    seasonCounts: { type: [mongoose_1.Schema.Types.Mixed], default: [] },
    // Peltolohkon sisällä olevat kasvulohkot (kasvikoodi per lohko)
    kasvulohkot: { type: [mongoose_1.Schema.Types.Mixed], default: [] },
    // NDVI-aikasarja
    dates: { type: [mongoose_1.Schema.Types.Mixed], default: [] },
}, {
    collection: "ML_data",
    timestamps: true,
});
MlDataSchema.index({ geometryHash: 1 }, { unique: true });
MlDataSchema.index({ batchId: 1 });
MlDataSchema.index({ geometry: "2dsphere" });
const MlDataModel = connections_1.parcelConnection.model("MlData", MlDataSchema);
exports.MlData = MlDataModel;
