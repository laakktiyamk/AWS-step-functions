import { lambdaAdapter } from '../shared/adapter';
import { authenticateUser } from "../shared/middleware/validateToken";
import { checkUserToken } from '../shared/middleware/cdseUserToken';
import { devCropParcelStats } from '../shared/controllers/devCropParcelStatsController';

export const handler = lambdaAdapter(devCropParcelStats, [authenticateUser, checkUserToken], false);

