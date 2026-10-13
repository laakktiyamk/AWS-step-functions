import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import { geocode } from "../shared/controllers/geocodeController";

export const search = lambdaAdapter(geocode, [authenticateUser]);