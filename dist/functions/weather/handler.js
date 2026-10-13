"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeatherAll = void 0;
const adapter_1 = require("../shared/adapter");
const validateToken_1 = require("../shared/middleware/validateToken");
const weatherController_1 = require("../shared/controllers/weatherController");
//export const getWeather = lambdaAdapter(weather, [authenticateUser]);
exports.getWeatherAll = (0, adapter_1.lambdaAdapter)(weatherController_1.weatherAll, [validateToken_1.authenticateUser]);
