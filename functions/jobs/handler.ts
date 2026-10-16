import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import { getJob } from "../shared/controllers/jobController";

export const get = lambdaAdapter(getJob, [authenticateUser]);