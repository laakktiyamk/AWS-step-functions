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
const HASHES = [
    '50a91c6d33cf1605a2c964746f966a25eb2c53e33c32a2a6303a546d690b26cb',
    '68aede346187463b4c2349605f67a5bdd8c88574983face5f6c699916ccef03b',
    '7147742fb2d8d6cafd09d10bd3229681cdebab2e71e673a18483ec7bfb654b86',
    'cf15c599d97aff8b7920a1b9a6295ecc77f78e6675aab4df31e590cb59cc6044',
];
const BATCH_ID = 'test2026';
async function main() {
    await (0, connections_1.ensureParcelConnected)();
    const docs = await MlData_1.MlData
        .find({ geometryHash: { $in: HASHES } })
        .select('peruslohkotunnus vuosi pinta_ala kasvulohkot geometry')
        .lean();
    const fields = docs.map((d, i) => ({
        field_id: `${BATCH_ID}-${i + 1}`,
        target: 'ml',
        batchId: BATCH_ID,
        start_date: '2026-04-01T00:00:00Z',
        end_date: '2026-10-01T00:00:00Z',
        peruslohkotunnus: d.peruslohkotunnus,
        vuosi: d.vuosi,
        pinta_ala: d.pinta_ala,
        kasvulohkot: d.kasvulohkot,
        geometry: { type: d.geometry.type, coordinates: d.geometry.coordinates },
    }));
    const json = JSON.stringify({ fields });
    fs.writeFileSync('sf-input-test2026.json', json);
    console.log(`sf-input-test2026.json: peltoja ${fields.length}, koko ${(json.length / 1024).toFixed(1)} kt`);
}
main()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
