"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAoiStatus = exports.removeFieldForUser = void 0;
const mongodb = __importStar(require("../mongo/mongodb"));
const rewind_1 = __importDefault(require("@turf/rewind"));
const hash = __importStar(require("../utils/hash"));
const removeFieldForUser = async (id, userId) => {
    const data = await mongodb.getDates(id);
    if (!data)
        return 'not_found';
    if (!data.userIds?.includes(userId))
        return 'forbidden';
    await mongodb.removeUserFromDates(id, userId);
    // Data poistetaan vasta, kun viimeinenkin käyttäjä on poistanut pellon
    const orphaned = await mongodb.deleteDatesIfOrphaned(id);
    if (!orphaned)
        return 'removed_user';
    await Promise.all([
        mongodb.deleteImagesByHash(id),
        mongodb.deleteWeatherByHash(id),
    ]);
    return 'deleted';
};
exports.removeFieldForUser = removeFieldForUser;
const getAoiStatus = async (geometry, userId) => {
    const id = hash.sha256((0, rewind_1.default)(geometry, { mutate: false }));
    const data = await mongodb.getDates(id);
    // Dokumentti ilman päiviä = dataa ei ole haettu, käsitellään uutena
    if (!data || !data.dates?.length)
        return { status: 'none', id };
    return { status: data.userIds?.includes(userId) ? 'mine' : 'shared', id };
};
exports.getAoiStatus = getAoiStatus;
