import { Request, Response } from "express";
import mongoose from "mongoose";
import { Job } from "../mongo/models/Job";

export const getJob = async (req: Request, res: Response) => {
  const { jobId } = req.params;

  if (!mongoose.isValidObjectId(jobId)) {
    return res.status(400).json({ message: "Invalid jobId." });
  }

  const job = await Job.findOne({ _id: jobId, userId: req.user?._id }).lean();
  if (!job) {
    return res.status(404).json({ message: "Job not found." });
  }

  return res.status(200).json({
    jobId: job._id.toString(),
    total: job.total,
    done: job.done,
    failed: job.failed,
    status: job.status
  });
};