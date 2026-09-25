"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getByPeruslohkotunnus = void 0;
const CropParcel_1 = require("../mongo/models/CropParcel");
const getByPeruslohkotunnus = async (peruslohkotunnus) => {
    return CropParcel_1.CropParcel.find({ peruslohkotunnus }, {
        tunnus: 1,
        lohkonumero: 1,
        kasvikoodi: 1,
        pinta_ala: 1,
        luomuviljely: 1,
        geometry: 1,
        _id: 0,
    }).lean();
};
exports.getByPeruslohkotunnus = getByPeruslohkotunnus;
