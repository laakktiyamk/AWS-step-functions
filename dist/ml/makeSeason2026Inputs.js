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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const MlData_1 = require("../functions/shared/mongo/models/MlData");
const connections_1 = require("../functions/shared/mongo/connections");
const BATCH_ID = 'season2026r';
const START = '2026-04-01T00:00:00Z';
const END = '2026-10-01T00:00:00Z';
const MAX_BYTES = 200 * 1024;
const OUT_DIR = 'sf-inputs-2026-retry';
const WRAPPER_BYTES = 20; // {"fields":[ ... ]}
async function main() {
    await (0, connections_1.ensureParcelConnected)();
    // Vain pellot, joilta 2026 puuttuu (testipellot jäävät pois, ja skriptin voi ajaa uudelleen)
    const docs = await MlData_1.MlData
        .find({ 'seasonCounts.year': { $ne: 2026 } })
        .select('peruslohkotunnus vuosi pinta_ala kasvulohkot geometry')
        .sort({ _id: 1 })
        .lean();
    const batches = [];
    let current = [];
    let size = WRAPPER_BYTES;
    docs.forEach((d, i) => {
        const field = {
            field_id: `${BATCH_ID}-${i + 1}`,
            target: 'ml',
            batchId: BATCH_ID,
            start_date: START,
            end_date: END,
            peruslohkotunnus: d.peruslohkotunnus,
            vuosi: d.vuosi,
            pinta_ala: d.pinta_ala,
            kasvulohkot: d.kasvulohkot,
            geometry: { type: d.geometry.type, coordinates: d.geometry.coordinates },
        };
        const bytes = Buffer.byteLength(JSON.stringify(field)) + 1;
        if (current.length > 0 && size + bytes > MAX_BYTES) {
            batches.push(current);
            current = [];
            size = WRAPPER_BYTES;
        }
        current.push(field);
        size += bytes;
    });
    if (current.length > 0)
        batches.push(current);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    batches.forEach((fields, n) => {
        const json = JSON.stringify({ fields });
        const file = `${OUT_DIR}/sf-input-${String(n + 1).padStart(2, '0')}.json`;
        fs.writeFileSync(file, json);
        console.log(`${file}: peltoja ${fields.length}, koko ${(Buffer.byteLength(json) / 1024).toFixed(1)} kt`);
    });
    console.log(`Yhteensä peltoja ${docs.length}, eriä ${batches.length}`);
}
main()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
