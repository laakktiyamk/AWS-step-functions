"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_apigatewaymanagementapi_1 = require("@aws-sdk/client-apigatewaymanagementapi");
const db_1 = require("../shared/mongo/db");
const Job_1 = require("../shared/mongo/models/Job");
const wsClient = new client_apigatewaymanagementapi_1.ApiGatewayManagementApiClient({
    endpoint: process.env.WS_ENDPOINT
});
const handler = async (event) => {
    const { jobId, aoiId, status } = event; // status: "done" | "failed"
    await (0, db_1.connectDb)();
    const job = await Job_1.Job.findOneAndUpdate({ _id: jobId }, { $inc: { [status === "done" ? "done" : "failed"]: 1 } }, { new: true });
    if (!job)
        return { jobId, aoiId, status };
    let jobStatus = job.status;
    if (job.done + job.failed >= job.total) {
        jobStatus = job.done === 0 ? "failed" : "done";
        await Job_1.Job.updateOne({ _id: jobId }, { status: jobStatus });
    }
    // Kanta on päivitetty ensin, joten lähetyksen epäonnistuminen ei haittaa
    if (job.connectionId) {
        try {
            await wsClient.send(new client_apigatewaymanagementapi_1.PostToConnectionCommand({
                ConnectionId: job.connectionId,
                Data: JSON.stringify({
                    jobId,
                    aoiId,
                    status,
                    jobStatus,
                    done: job.done,
                    failed: job.failed,
                    total: job.total
                })
            }));
        }
        catch (err) {
            console.warn("WebSocket send failed:", err);
        }
    }
    return { jobId, aoiId, status, done: job.done, failed: job.failed, total: job.total };
};
exports.handler = handler;
