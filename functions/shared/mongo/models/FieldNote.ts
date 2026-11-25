import { Schema, model, Types } from 'mongoose';

/**
 * Käyttäjän henkilökohtainen muistiinpano pellolle.
 *
 * @remarks
 * Yksi muistiinpano per käyttäjä ja AOI (uniikki userId + aoiId).
 * aoiId = dates-dokumentin geometryHash. Muistiinpano näkyy vain kirjoittajalle.
 */
export interface IFieldNote {
  userId: Types.ObjectId;
  aoiId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const fieldNoteSchema = new Schema<IFieldNote>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    aoiId: { type: String, required: true },
    text: { type: String, default: '', maxlength: 5000 },
  },
  { timestamps: true }
);

fieldNoteSchema.index({ userId: 1, aoiId: 1 }, { unique: true });

export const FieldNote = model<IFieldNote>('FieldNote', fieldNoteSchema);