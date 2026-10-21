"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJob = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Job_1 = require("../mongo/models/Job");
const getJob = async (req, res) => {
    const { jobId } = req.params;
    if (!mongoose_1.default.isValidObjectId(jobId)) {
        return res.status(400).json({ message: "Invalid jobId." });
    }
    const job = await Job_1.Job.findOne({ _id: jobId, userId: req.user?._id }).lean();
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
exports.getJob = getJob;
