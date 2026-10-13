import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import { processAOI, image, images } from "../shared/controllers/ndviController";

export const dates = lambdaAdapter(processAOI, [authenticateUser], true);
export const getImage = lambdaAdapter(image, [authenticateUser]);
export const getImages = lambdaAdapter(images, [authenticateUser]);