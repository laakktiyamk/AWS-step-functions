"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.search = void 0;
const adapter_1 = require("../shared/adapter");
const validateToken_1 = require("../shared/middleware/validateToken");
const geocodeController_1 = require("../shared/controllers/geocodeController");
exports.search = (0, adapter_1.lambdaAdapter)(geocodeController_1.geocode, [validateToken_1.authenticateUser]);
