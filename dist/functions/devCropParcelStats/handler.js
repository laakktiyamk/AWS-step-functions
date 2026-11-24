"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const adapter_1 = require("../shared/adapter");
const validateToken_1 = require("../shared/middleware/validateToken");
const cdseUserToken_1 = require("../shared/middleware/cdseUserToken");
const devCropParcelStatsController_1 = require("../shared/controllers/devCropParcelStatsController");
exports.handler = (0, adapter_1.lambdaAdapter)(devCropParcelStatsController_1.devCropParcelStats, [validateToken_1.authenticateUser, cdseUserToken_1.checkUserToken], false);
