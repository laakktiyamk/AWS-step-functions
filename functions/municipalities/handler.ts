import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import { municipalitiesList, municipalityByCode } from "../shared/controllers/municipalitiesController";


export const list = lambdaAdapter(municipalitiesList, [authenticateUser]);



export const byCode = lambdaAdapter(municipalityByCode, [authenticateUser]);