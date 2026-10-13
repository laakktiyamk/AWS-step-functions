import { lambdaAdapter } from "../shared/adapter";
import { authenticateUser } from "../shared/middleware/validateToken";
import { weatherAll } from "../shared/controllers/weatherController";

//export const getWeather = lambdaAdapter(weather, [authenticateUser]);
export const getWeatherAll = lambdaAdapter(weatherAll, [authenticateUser]);