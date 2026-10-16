import mongoose from "mongoose";
import { connectDb } from "../shared/mongo/db";
import { Job } from "../shared/mongo/models/Job";
import { verifyToken } from "../shared/middleware/validateToken";

export const connect = async (event: any) => {
  const { token, jobId } = event.queryStringParameters ?? {};
  if (!token || !jobId || !mongoose.isValidObjectId(jobId)) {
    return { statusCode: 400 };
  }

  const decoded = verifyToken(token);
  if (!decoded) return { statusCode: 401 };

  await connectDb();
  const job = await Job.findOneAndUpdate(
    { _id: jobId, userId: decoded._id },
    { connectionId: event.requestContext.connectionId }
  );
  if (!job) return { statusCode: 404 };

  return { statusCode: 200 };
};