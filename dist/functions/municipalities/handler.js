"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.byCode = exports.list = void 0;
const adapter_1 = require("../shared/adapter");
const validateToken_1 = require("../shared/middleware/validateToken");
const municipalitiesController_1 = require("../shared/controllers/municipalitiesController");
exports.list = (0, adapter_1.lambdaAdapter)(municipalitiesController_1.municipalitiesList, [validateToken_1.authenticateUser]);
exports.byCode = (0, adapter_1.lambdaAdapter)(municipalitiesController_1.municipalityByCode, [validateToken_1.authenticateUser]);
