import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from "@aws-sdk/client-apigatewaymanagementapi";
import { connectDb } from "../shared/mongo/db";
import { Job } from "../shared/mongo/models/Job";

const wsClient = new ApiGatewayManagementApiClient({
  endpoint: process.env.WS_ENDPOINT
});

export const handler = async (event: any) => {
  const { jobId, aoiId, status } = event; // status: "done" | "failed"

  await connectDb();

  const job = await Job.findOneAndUpdate(
    { _id: jobId },
    { $inc: { [status === "done" ? "done" : "failed"]: 1 } },
    { new: true }
  );
  if (!job) return { jobId, aoiId, status };

  let jobStatus: string = job.status;
  if (job.done + job.failed >= job.total) {
    jobStatus = job.done === 0 ? "failed" : "done";
    await Job.updateOne({ _id: jobId }, { status: jobStatus });
  }

  // Kanta on päivitetty ensin, joten lähetyksen epäonnistuminen ei haittaa
  if (job.connectionId) {
    try {
      await wsClient.send(new PostToConnectionCommand({
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
    } catch (err) {
      console.warn("WebSocket send failed:", err);
    }
  }

  return { jobId, aoiId, status, done: job.done, failed: job.failed, total: job.total };
};