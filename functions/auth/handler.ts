import { lambdaAdapter } from "../shared/adapter";
import { registerUser, loginUser } from "../shared/controllers/userAuthController";

export const register = lambdaAdapter(registerUser);
export const login = lambdaAdapter(loginUser);
