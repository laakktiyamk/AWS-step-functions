import { Document, Model, Schema } from "mongoose";
import { parcelConnection } from "../connections";

interface IMunicipality extends Document {
  kunta: string;      // kuntakoodi, esim. "005"
  nimi: string;       // suomenkielinen nimi
  bbox: number[];     // [minX, minY, maxX, maxY]
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  };
}

const MunicipalitySchema = new Schema<IMunicipality>({
  kunta: { type: String, required: true, unique: true },
  nimi: { type: String, required: true },
  bbox: { type: [Number], required: true },
  geometry: {
    type: { type: String, enum: ["Polygon", "MultiPolygon"], required: true },
    coordinates: { type: Schema.Types.Mixed, required: true },
  },
}, { collection: "municipalities" });

MunicipalitySchema.index({ geometry: "2dsphere" });

const MunicipalityModel: Model<IMunicipality> =
  parcelConnection.model<IMunicipality>("Municipality", MunicipalitySchema);
export { MunicipalityModel as Municipality, IMunicipality };