"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cropParcelsByGeometry = void 0;
const connections_1 = require("../mongo/connections");
const cropParcelService_1 = require("../services/cropParcelService");
const cropParcelsByGeometry = async (req, res) => {
    const geometry = req.body?.geometry;
    if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) {
        return res.status(400).json({ error: "Polygon or MultiPolygon geometry required" });
    }
    const vuosi = req.body?.vuosi !== undefined ? Number(req.body.vuosi) : 2025;
    if (!Number.isInteger(vuosi) || vuosi < 2020 || vuosi > 2025) {
        return res.status(400).json({ error: "vuosi must be an integer between 2020 and 2025" });
    }
    try {
        await (0, connections_1.ensureParcelConnected)();
        const parcels = await (0, cropParcelService_1.getByGeometry)(geometry, vuosi);
        return res.json(parcels);
    }
    catch (err) {
        console.error("cropParcelsByGeometry failed:", err);
        return res.status(500).json({ error: "crop parcel lookup failed" });
    }
};
exports.cropParcelsByGeometry = cropParcelsByGeometry;
