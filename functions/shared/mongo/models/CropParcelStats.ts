import { Schema, Document } from 'mongoose';
import { parcelConnection } from '../connections';

export interface ICropParcelStatsEntry {
  date: string;   // YYYY-MM-DD
  mean: number;
}

export interface ICropParcelStats extends Document {
  aoiId: string;              // geometryHash
  peruslohkotunnus: string;
  lohkonumero: string;
  vuosi: string;
  kasvikoodi?: string;
  stats: ICropParcelStatsEntry[];
  updatedAt: Date;
}

const entrySchema = new Schema<ICropParcelStatsEntry>(
  { date: { type: String, required: true }, mean: { type: Number, required: true } },
  { _id: false }
);

const cropParcelStatsSchema = new Schema<ICropParcelStats>(
  {
    aoiId: { type: String, required: true },
    peruslohkotunnus: { type: String, required: true },
    lohkonumero: { type: String, required: true },
    vuosi: { type: String, required: true },
    kasvikoodi: String,
    stats: { type: [entrySchema], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

cropParcelStatsSchema.index(
  { aoiId: 1, peruslohkotunnus: 1, lohkonumero: 1, vuosi: 1 },
  { unique: true }
);

export const CropParcelStats = parcelConnection.model<ICropParcelStats>(
  'CropParcelStats',
  cropParcelStatsSchema,
  'cropParcelStats'
);