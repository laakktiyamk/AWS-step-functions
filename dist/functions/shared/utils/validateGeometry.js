"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGeometry = void 0;
const rewind_1 = __importDefault(require("@turf/rewind"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { hint } = require("@mapbox/geojsonhint");
const validateGeometry = (geometry) => {
    if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
        return ["Geometry must be a Polygon or MultiPolygon"];
    }
    try {
        const fixed = (0, rewind_1.default)(geometry, { mutate: false });
        return hint(fixed).map((e) => e.message);
    }
    catch (err) {
        return ["Invalid input: " + (err instanceof Error ? err.message : String(err))];
    }
};
exports.validateGeometry = validateGeometry;
