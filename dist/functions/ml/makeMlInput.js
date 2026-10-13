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
const FieldParcel_1 = require("../shared/mongo/models/FieldParcel");
const CropParcel_1 = require("../shared/mongo/models/CropParcel");
const MlData_1 = require("../shared/mongo/models/MlData");
const connections_1 = require("../shared/mongo/connections");
const BATCH_ID = process.argv[2] ?? 'batch1';
const SIZE = Number(process.argv[3] ?? 100);
async function main() {
    await (0, connections_1.ensureParcelConnected)();
    // Pellot, jotka ovat jo ML_data-kokoelmassa, jätetään pois
    const done = await MlData_1.MlData.distinct('peruslohkotunnus');
    console.log(`ML_data:ssa jo ${done.length} peltoa`);
    // Arvotaan tuplamäärä, koska osalta ei löydy kasvulohkoa
    // Arvotaan ensin (nopea), suodatetaan jo haetut ja tuplat pois koodissa.
    // Tuplamäärä, koska osalta ei löydy kasvulohkoa.
    const doneSet = new Set(done);
    const seen = new Set();
    const raw = await FieldParcel_1.FieldParcel.aggregate([{ $sample: { size: SIZE * 3 } }]);
    const sample = raw.filter(s => {
        if (doneSet.has(s.peruslohkotunnus) || seen.has(s.peruslohkotunnus))
            return false;
        seen.add(s.peruslohkotunnus);
        return true;
    });
    const ids = sample.map(s => s.peruslohkotunnus);
    const crops = await CropParcel_1.CropParcel
        .find({ peruslohkotunnus: { $in: ids } })
        .select('peruslohkotunnus tunnus pinta_ala kasvikoodi')
        .lean();
    const fields = sample
        .map(s => ({
        peruslohkotunnus: s.peruslohkotunnus,
        vuosi: s.vuosi,
        pinta_ala: s.pinta_ala,
        geometry: s.geometry,
        kasvulohkot: crops
            .filter(c => c.peruslohkotunnus === s.peruslohkotunnus)
            .map(c => ({ tunnus: c.tunnus, pinta_ala: c.pinta_ala, kasvikoodi: c.kasvikoodi })),
    }))
        .filter(f => f.kasvulohkot.length > 0)
        .slice(0, SIZE)
        .map((f, i) => ({
        field_id: `${BATCH_ID}-${i + 1}`,
        target: 'ml',
        batchId: BATCH_ID,
        start_date: '2020-01-01T00:00:00Z',
        end_date: '2025-12-31T00:00:00Z',
        ...f,
    }));
    const json = JSON.stringify({ fields });
    const file = `sf-input-${BATCH_ID}.json`;
    fs.writeFileSync(file, json);
    console.log(`${file}: peltoja ${fields.length}, koko ${(json.length / 1024).toFixed(1)} kt`);
}
main()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
