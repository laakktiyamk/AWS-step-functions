"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const adapter_1 = require("../shared/adapter");
const validateToken_1 = require("../shared/middleware/validateToken");
const validateGeoJSONController_1 = require("../shared/controllers/validateGeoJSONController");
exports.validate = (0, adapter_1.lambdaAdapter)(validateGeoJSONController_1.validateGeoJSON, [validateToken_1.authenticateUser]);
