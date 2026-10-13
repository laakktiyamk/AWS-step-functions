import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import { getGrowingSeason } from "../shared/controllers/growingSeasonController";

export const get = lambdaAdapter(getGrowingSeason, [authenticateUser]);