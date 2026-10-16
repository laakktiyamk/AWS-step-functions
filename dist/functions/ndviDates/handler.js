"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const authenticate_CDSE_1 = require("../shared/utils/authenticate_CDSE");
const db_1 = require("../shared/mongo/db");
const connections_1 = require("../shared/mongo/connections");
const MlWeather_1 = require("../shared/mongo/models/MlWeather");
const ndviService_1 = require("../shared/services/ndviService");
const handler = async (event) => {
    // testiä varten
    //if (event.name === "FAIL") throw new Error("testivirhe");
    await (0, db_1.connectDb)();
    const authToken = await (0, authenticate_CDSE_1.authenticate)();
    console.log('authenticated');
    const geometry = typeof event.geometry !== 'object'
        ? JSON.parse(event.geometry)
        : event.geometry;
    // ── ML-ajo: tallennus ML_data- ja ML_weather-kokoelmiin, ei kuvia ──
    if (event.target === 'ml') {
        console.log('ML: start', event.field_id);
        await (0, connections_1.ensureParcelConnected)();
        console.log('ML: parcel connected');
        const mlResult = await (0, ndviService_1.syncMlDates)(geometry, new Date(event.start_date), new Date(event.end_date), authToken, event.batchId ?? '', event.kasvulohkot ?? [], {
            peruslohkotunnus: event.peruslohkotunnus,
            vuosi: event.vuosi,
            pinta_ala: event.pinta_ala,
        });
        console.log('ML: syncMlDates done', !!mlResult);
        if (mlResult)
            await (0, ndviService_1.fetchWeather)(mlResult.geometry, mlResult.seasons, MlWeather_1.mlWeatherStore);
        console.log('ML: weather done');
        return {
            geometry: mlResult?.geometry ?? geometry,
            field_id: event.field_id,
            jobId: event.jobId,
            aoiId: event.aoiId,
            items: []
        };
    }
    // ── Normaali käyttäjän ajo (ennallaan) ──
    const result = await (0, ndviService_1.syncDates)(geometry, new Date(event.start_date), authToken, event.name ?? '', event.userId ?? '', event.kasvulohkot ?? [], false);
    if (!result) {
        return { geometry, field_id: event.field_id, jobId: event.jobId, aoiId: event.aoiId, items: [] };
    }
    await (0, ndviService_1.fetchWeather)(result.geometry, result.seasons);
    return {
        geometry: result.geometry,
        field_id: event.field_id,
        jobId: event.jobId,
        aoiId: event.aoiId,
        items: result.newDates
    };
};
exports.handler = handler;
