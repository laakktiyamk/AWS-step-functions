"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const authenticate_CDSE_1 = require("../shared/utils/authenticate_CDSE");
const db_1 = require("../shared/mongo/db");
const ndviService_1 = require("../shared/services/ndviService");
const handler = async (event) => {
    await (0, db_1.connectDb)();
    const authToken = await (0, authenticate_CDSE_1.authenticate)();
    const success = await (0, ndviService_1.fetchAndSaveImage)(event.item, event.geometry, authToken);
    return { success, sentinelid: event.item.sentinelid };
};
exports.handler = handler;
