import mongoose, { Document, Schema } from "mongoose";

interface IJob extends Document {
  userId: string;
  total: number;
  done: number;
  failed: number;
  status: "running" | "done" | "failed";
  connectionId?: string;
  createdAt: Date;
}

const JobSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  total: { type: Number, required: true },
  done: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  status: { type: String, enum: ["running", "done", "failed"], default: "running" },
  connectionId: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 3 }
}, { collection: "jobs" });

const JobModel: mongoose.Model<IJob> = mongoose.model<IJob>("Job", JobSchema);
export { JobModel as Job, IJob };