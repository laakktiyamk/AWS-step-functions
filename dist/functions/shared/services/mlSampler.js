"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sampleMlFields = sampleMlFields;
const FieldParcel_1 = require("../mongo/models/FieldParcel");
const CropParcel_1 = require("../mongo/models/CropParcel");
const MlData_1 = require("../mongo/models/MlData");
const connections_1 = require("../mongo/connections");
async function sampleMlFields(batchId, size) {
    await (0, connections_1.ensureParcelConnected)();
    const done = await MlData_1.MlData.distinct('peruslohkotunnus');
    const doneSet = new Set(done);
    const seen = new Set();
    // Tuplamäärä, koska osalta ei löydy kasvulohkoa
    const raw = await FieldParcel_1.FieldParcel.aggregate([{ $sample: { size: size * 3 } }]);
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
    return sample
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
        .slice(0, size)
        .map((f, i) => ({
        field_id: `${batchId}-${i + 1}`,
        target: 'ml',
        batchId,
        start_date: '2020-01-01T00:00:00Z',
        end_date: '2025-12-31T00:00:00Z',
        ...f,
    }));
}
