"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const tokenService_1 = require("../shared/services/tokenService");
const User_1 = require("../shared/mongo/models/User");
const db_1 = require("../shared/mongo/db");
const json = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});
const handler = async (event) => {
    try {
        const { token } = JSON.parse(event.body || "{}");
        if (typeof token !== "string" || token.length !== 64) {
            return json(400, { error: "Virheellinen tai vanhentunut linkki" });
        }
        await (0, db_1.connectDb)();
        const userId = await (0, tokenService_1.consumeEmailToken)(token, "verify_email");
        if (!userId) {
            return json(400, { error: "Virheellinen tai vanhentunut linkki" });
        }
        await User_1.User.updateOne({ _id: userId }, { $set: { verified: true } }); // OLETUS: kenttä "verified"
        return json(200, { ok: true });
    }
    catch (err) {
        console.error("verify-email-virhe:", err);
        return json(500, { error: "Palvelinvirhe" });
    }
};
exports.handler = handler;
