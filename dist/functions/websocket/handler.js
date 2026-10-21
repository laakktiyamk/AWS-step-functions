"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connect = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../shared/mongo/db");
const Job_1 = require("../shared/mongo/models/Job");
const validateToken_1 = require("../shared/middleware/validateToken");
const connect = async (event) => {
    const { token, jobId } = event.queryStringParameters ?? {};
    if (!token || !jobId || !mongoose_1.default.isValidObjectId(jobId)) {
        return { statusCode: 400 };
    }
    const decoded = (0, validateToken_1.verifyToken)(token);
    if (!decoded)
        return { statusCode: 401 };
    await (0, db_1.connectDb)();
    const job = await Job_1.Job.findOneAndUpdate({ _id: jobId, userId: decoded._id }, { connectionId: event.requestContext.connectionId });
    if (!job)
        return { statusCode: 404 };
    return { statusCode: 200 };
};
exports.connect = connect;
