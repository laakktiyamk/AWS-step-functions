"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGeoJSON = void 0;
const rewind_1 = __importDefault(require("@turf/rewind"));
const validateGeometry_1 = require("../utils/validateGeometry");
const validateGeoJSON = (req, res) => {
    const { geometry } = req.body;
    if (!geometry) {
        return res.status(400).json({ valid: false, errors: ['No geometry provided'] });
    }
    const errors = (0, validateGeometry_1.validateGeometry)(geometry);
    if (errors.length > 0) {
        return res.status(200).json({ valid: false, errors });
    }
    return res.status(200).json({
        valid: true,
        errors: [],
        geometry: (0, rewind_1.default)(geometry, { mutate: false }), // korjattu geometria frontendille
    });
};
exports.validateGeoJSON = validateGeoJSON;
