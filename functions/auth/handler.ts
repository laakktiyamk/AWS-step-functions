import { lambdaAdapter } from "../shared/adapter";
import {
  registerUser,
  loginUser,
  verifyEmailUser
} from "../shared/controllers/userAuthController";

export const register = lambdaAdapter(registerUser);
export const login = lambdaAdapter(loginUser);
export const verifyEmail = lambdaAdapter(verifyEmailUser);