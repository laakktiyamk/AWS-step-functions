import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import { getFields, deleteField } from "../shared/controllers/fieldsInfoController";
import { getCropTypes } from "../shared/controllers/cropTypeController";
import { fieldByLocation } from "../shared/controllers/fieldByLocationController";
import { fieldsByBbox } from "../shared/controllers/fieldsByBboxController";
import { cropParcelsByField } from "../shared/controllers/cropParcelsByFieldController";
import { cropParcelsByGeometry } from "../shared/controllers/cropParcelsByGeometryController";
import { getFieldInfo } from "../shared/controllers/fieldsInfoController";


export const list = lambdaAdapter(getFields, [authenticateUser]);

export const remove = lambdaAdapter(deleteField, [authenticateUser]);

export const cropTypes = lambdaAdapter(getCropTypes, [authenticateUser]);

export const byLocation = lambdaAdapter(fieldByLocation, [authenticateUser]);

export const byBbox = lambdaAdapter(fieldsByBbox, [authenticateUser]);

export const cropParcels = lambdaAdapter(cropParcelsByField, [authenticateUser]);

export const cropParcelsGeom = lambdaAdapter(cropParcelsByGeometry, [authenticateUser]);

export const info = lambdaAdapter(getFieldInfo, [authenticateUser]);