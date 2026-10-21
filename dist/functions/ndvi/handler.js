"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImages = exports.getImage = exports.dates = void 0;
const adapter_1 = require("../shared/adapter");
const validateToken_1 = require("../shared/middleware/validateToken");
const ndviController_1 = require("../shared/controllers/ndviController");
exports.dates = (0, adapter_1.lambdaAdapter)(ndviController_1.processAOI, [validateToken_1.authenticateUser], true);
exports.getImage = (0, adapter_1.lambdaAdapter)(ndviController_1.image, [validateToken_1.authenticateUser]);
exports.getImages = (0, adapter_1.lambdaAdapter)(ndviController_1.images, [validateToken_1.authenticateUser]);
