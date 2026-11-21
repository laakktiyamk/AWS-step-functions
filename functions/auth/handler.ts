import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import {
  registerValidation,
  loginValidation,
  resetPasswordValidation
} from "../shared/middleware/inputValidation";
import {
  registerUser,
  loginUser,
  verifyEmailUser,
  updateCdseCredentials,
  deleteCdseCredentials,
  getCdseStatus,
  forgotPassword,
  resetPassword,
  deleteAccount
} from "../shared/controllers/userAuthController";

export const register = lambdaAdapter(registerUser, [...registerValidation]);
export const login = lambdaAdapter(loginUser, [...loginValidation]);
export const verifyEmail = lambdaAdapter(verifyEmailUser);
export const updateCdse = lambdaAdapter(updateCdseCredentials, [authenticateUser]);
export const deleteCdse = lambdaAdapter(deleteCdseCredentials, [authenticateUser]);
export const forgotPasswordRequest = lambdaAdapter(forgotPassword);
export const resetPasswordConfirm = lambdaAdapter(resetPassword, [...resetPasswordValidation]);
export const getCdse = lambdaAdapter(getCdseStatus, [authenticateUser]);
export const removeAccount = lambdaAdapter(deleteAccount, [authenticateUser]);