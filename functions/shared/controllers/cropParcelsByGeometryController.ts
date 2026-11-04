import { Request, Response } from "express";
import { ensureParcelConnected } from "../mongo/connections";
import { getByGeometry } from "../services/cropParcelService";


export const cropParcelsByGeometry = async (req: Request, res: Response) => {
  const geometry = req.body?.geometry;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) {
    return res.status(400).json({ error: "Polygon or MultiPolygon geometry required" });
  }

  const vuosi = req.body?.vuosi !== undefined ? Number(req.body.vuosi) : 2025;
  if (!Number.isInteger(vuosi) || vuosi < 2020 || vuosi > 2025) {
    return res.status(400).json({ error: "vuosi must be an integer between 2020 and 2025" });
  }

  try {
    await ensureParcelConnected();
    const parcels = await getByGeometry(geometry, vuosi);
    return res.json(parcels);
  } catch (err) {
    console.error("cropParcelsByGeometry failed:", err);
    return res.status(500).json({ error: "crop parcel lookup failed" });
  }
};