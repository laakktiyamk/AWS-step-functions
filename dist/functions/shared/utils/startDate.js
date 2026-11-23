"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidStartDate = exports.seasonStartOf = exports.MIN_START_YEAR = void 0;
const growingSeason_json_1 = __importDefault(require("../settings/growingSeason.json"));
/** Oldest selectable year for user requests (ML runs do not use this). */
exports.MIN_START_YEAR = 2020;
const pad2 = (n) => String(n).padStart(2, "0");
/** Growing season start of the given year, e.g. "2022-04-01". */
const seasonStartOf = (year) => `${year}-${pad2(growingSeason_json_1.default.startMonth)}-${pad2(growingSeason_json_1.default.startDay)}`;
exports.seasonStartOf = seasonStartOf;
/**
 * A user-supplied start_date must be the growing season start of a year
 * between MIN_START_YEAR and the current year, and not in the future.
 * Accepts both "2022-04-01" and "2022-04-01T00:00:00Z".
 */
const isValidStartDate = (value) => {
    if (typeof value !== "string")
        return false;
    const year = Number(value.slice(0, 4));
    const currentYear = new Date().getUTCFullYear();
    if (!Number.isInteger(year) || year < exports.MIN_START_YEAR || year > currentYear)
        return false;
    if (value.slice(0, 10) !== (0, exports.seasonStartOf)(year))
        return false;
    return new Date((0, exports.seasonStartOf)(year)).getTime() <= Date.now();
};
exports.isValidStartDate = isValidStartDate;
