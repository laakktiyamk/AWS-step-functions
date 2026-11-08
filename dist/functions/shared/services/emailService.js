"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const client_sesv2_1 = require("@aws-sdk/client-sesv2");
const client = new client_sesv2_1.SESv2Client({
    region: process.env.SES_REGION || "eu-north-1",
});
async function sendEmail(to, subject, text, html) {
    const from = process.env.SES_FROM;
    if (!from)
        throw new Error("SES_FROM puuttuu ympäristömuuttujista");
    const result = await client.send(new client_sesv2_1.SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
            Simple: {
                Subject: { Data: subject, Charset: "UTF-8" },
                Body: {
                    Text: { Data: text, Charset: "UTF-8" },
                    ...(html && { Html: { Data: html, Charset: "UTF-8" } }),
                },
            },
        },
    }));
    console.log("SES accepted message:", result.MessageId);
}
