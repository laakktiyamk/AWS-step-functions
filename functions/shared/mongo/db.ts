import mongoose from "mongoose";

import dotenv from "dotenv";
dotenv.config();

let isConnected = false;

export const connectDb = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI as string);
  isConnected = true;
  console.log("Connected to MongoDB:", mongoose.connection.name);
};