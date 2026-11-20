"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const cdseTokenService_1 = require("../shared/services/cdseTokenService");
const db_1 = require("../shared/mongo/db");
const ndviService_1 = require("../shared/services/ndviService");
const handler = async (event) => {
    await (0, db_1.connectDb)();
    if (!event.userId)
        throw new cdseTokenService_1.CdseNotConnectedError();
    const authToken = await (0, cdseTokenService_1.getCdseTokenForUser)(event.userId);
    const success = await (0, ndviService_1.fetchAndSaveImage)(event.item, event.geometry, authToken);
    return { success, sentinelid: event.item.sentinelid };
};
exports.handler = handler;
