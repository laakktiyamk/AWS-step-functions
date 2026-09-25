"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDb = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let isConnected = false;
const connectDb = async () => {
    if (isConnected)
        return;
    await mongoose_1.default.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log("Connected to MongoDB:", mongoose_1.default.connection.name);
};
exports.connectDb = connectDb;
