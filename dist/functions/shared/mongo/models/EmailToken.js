"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailToken = void 0;
const mongoose_1 = require("mongoose");
const emailTokenSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    purpose: {
        type: String,
        enum: ["verify_email", "password_reset"],
        required: true,
    },
    expiresAt: { type: Date, required: true },
});
// Mongo poistaa dokumentin itse, kun expiresAt on mennyt
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.EmailToken = (0, mongoose_1.model)("EmailToken", emailTokenSchema);
