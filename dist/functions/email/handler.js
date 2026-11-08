"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const emailService_1 = require("../shared/services/emailService");
const handler = async () => {
    try {
        await (0, emailService_1.sendEmail)("laakkti.yamk@outlook.com", "SES-testi Lambdasta", "Jos näet tämän, SES toimii Lambdasta.");
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true }),
        };
    }
    catch (err) {
        console.error("SES-virhe:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.name, message: err.message }),
        };
    }
};
exports.handler = handler;
