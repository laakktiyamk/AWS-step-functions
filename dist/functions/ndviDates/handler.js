"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const authenticate_CDSE_1 = require("../shared/utils/authenticate_CDSE");
const db_1 = require("../shared/mongo/db");
const ndviService_1 = require("../shared/services/ndviService");
const handler = async (event) => {
    await (0, db_1.connectDb)();
    const authToken = await (0, authenticate_CDSE_1.authenticate)();
    const geometry = typeof event.geometry !== 'object'
        ? JSON.parse(event.geometry)
        : event.geometry;
    // saveImages: false → kuvat haetaan processor-Lambdalla Map-statessa
    const result = await (0, ndviService_1.syncDates)(geometry, new Date(event.start_date), authToken, event.name ?? '', event.userId ?? '', event.kasvulohkot ?? [], false);
    if (!result) {
        return { geometry, field_id: event.field_id, items: [] };
    }
    await (0, ndviService_1.fetchWeather)(result.geometry, result.seasons);
    return {
        geometry: result.geometry, // rewind-normalisoitu, kulkee vain kerran
        field_id: event.field_id,
        items: result.newDates // vain tällä ajolla haetut uudet päivät
    };
};
exports.handler = handler;
