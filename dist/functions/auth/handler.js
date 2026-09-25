"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const adapter_1 = require("../shared/adapter");
const userAuthController_1 = require("../shared/controllers/userAuthController");
exports.register = (0, adapter_1.lambdaAdapter)(userAuthController_1.registerUser);
exports.login = (0, adapter_1.lambdaAdapter)(userAuthController_1.loginUser);
