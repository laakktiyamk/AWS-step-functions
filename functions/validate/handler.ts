import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import { validateGeoJSON } from "../shared/controllers/validateGeoJSONController";

export const validate = lambdaAdapter(validateGeoJSON, [authenticateUser]);