"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = void 0;
const adapter_1 = require("../shared/adapter");
const validateToken_1 = require("../shared/middleware/validateToken");
const growingSeasonController_1 = require("../shared/controllers/growingSeasonController");
exports.get = (0, adapter_1.lambdaAdapter)(growingSeasonController_1.getGrowingSeason, [validateToken_1.authenticateUser]);
