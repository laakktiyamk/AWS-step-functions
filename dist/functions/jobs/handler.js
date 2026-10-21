"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = void 0;
const adapter_1 = require("../shared/adapter");
const validateToken_1 = require("../shared/middleware/validateToken");
const jobController_1 = require("../shared/controllers/jobController");
exports.get = (0, adapter_1.lambdaAdapter)(jobController_1.getJob, [validateToken_1.authenticateUser]);
