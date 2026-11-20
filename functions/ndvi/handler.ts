import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import { processAOI, image, images } from "../shared/controllers/ndviController";
import { checkUserToken } from "../shared/middleware/cdseUserToken";

//export const dates = lambdaAdapter(processAOI, [authenticateUser], true);
export const dates = lambdaAdapter(processAOI, [authenticateUser, checkUserToken], false);
export const getImage = lambdaAdapter(image, [authenticateUser]);
export const getImages = lambdaAdapter(images, [authenticateUser]);