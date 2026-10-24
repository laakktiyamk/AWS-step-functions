"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.municipalityByCode = exports.municipalitiesList = void 0;
const connections_1 = require("../mongo/connections");
const Municipality_1 = require("../mongo/models/Municipality");
const municipalitiesList = async (_req, res) => {
    try {
        await (0, connections_1.ensureParcelConnected)();
        const items = await Municipality_1.Municipality.find({}, { _id: 0, kunta: 1, nimi: 1, bbox: 1 }).lean();
        items.sort((a, b) => a.nimi.localeCompare(b.nimi, "fi"));
        res.json(items);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch municipalities" });
    }
};
exports.municipalitiesList = municipalitiesList;
const municipalityByCode = async (req, res) => {
    try {
        const kunta = String(req.params.kunta);
        if (!/^\d{3}$/.test(kunta)) {
            return res.status(400).json({ message: "Invalid municipality code" });
        }
        await (0, connections_1.ensureParcelConnected)();
        const item = await Municipality_1.Municipality.findOne({ kunta }, { _id: 0, kunta: 1, nimi: 1, bbox: 1, geometry: 1 }).lean();
        if (!item)
            return res.status(404).json({ message: "Municipality not found" });
        res.json(item);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch municipality" });
    }
};
exports.municipalityByCode = municipalityByCode;
