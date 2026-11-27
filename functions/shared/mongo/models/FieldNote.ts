import { Schema, model } from 'mongoose';

/**
 * Käyttäjän henkilökohtainen muistiinpano pellolle.
 *
 * @remarks
 * Yksi muistiinpano per käyttäjä, AOI ja vuosi (uniikki userId + aoiId + year).
 * year = null on yleinen (pysyvä) muistiinpano, numero on kauden muistiinpano.
 * aoiId = dates-dokumentin id (geometryHash). Muistiinpano näkyy vain kirjoittajalle.
 */
export interface IFieldNote {
  userId: string;
  aoiId: string;
  year: number | null;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const fieldNoteSchema = new Schema<IFieldNote>(
  {
    userId: { type: String, required: true },
    aoiId: { type: String, required: true },
    year: { type: Number, default: null },
    text: { type: String, default: '', maxlength: 5000 },
  },
  { timestamps: true }
);

fieldNoteSchema.index({ userId: 1, aoiId: 1, year: 1 }, { unique: true });

export const FieldNote = model<IFieldNote>('FieldNote', fieldNoteSchema);