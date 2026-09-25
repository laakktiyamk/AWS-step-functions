"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localConnection = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Atlas — users, ndvi-data yms.
/*
export const atlasConnection = mongoose.createConnection(
  process.env.MONGO_URI!
);*/
//console.log('Yhdistetään osoitteeseen:', process.env.MONGO_AZURE_URI);
// Local — peltolohkot
exports.localConnection = mongoose_1.default.createConnection(
//process.env.MONGO_LOCAL_URI!  // mongodb://localhost:27017/ndvi
process.env.MONGO_AZURE_URI);
//atlasConnection.on("connected", () => console.log("Atlas: yhdistetty"));
exports.localConnection.on("connected", () => console.log("Local MongoDB: yhdistetty"));
//atlasConnection.on("error", (err:string) => console.error("Atlas virhe:", err));
exports.localConnection.on("error", (err) => console.error("Local virhe:", err));
