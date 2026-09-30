"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lambdaAdapter = void 0;
const db_1 = require("./mongo/db");
const authenticate_CDSE_1 = require("./utils/authenticate_CDSE");
const lambdaAdapter = (handler, middlewares = [], needsSentinelToken = false) => {
    return async (event) => {
        await (0, db_1.connectDb)();
        let authToken = null;
        if (needsSentinelToken) {
            console.log("Fetching Sentinel token...");
            authToken = await (0, authenticate_CDSE_1.authenticate)();
            console.log("Token fetched:", authToken ? "OK" : "FAILED");
        }
        const rawBody = event.body ?? event;
        const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        const req = {
            body,
            params: event.pathParameters || {},
            query: event.queryStringParameters || {},
            headers: event.headers || {},
            originalUrl: event.rawPath || '/',
            authToken,
        };
        let statusCode = 200;
        let responseBody;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { responseBody = data; return res; },
            send: (data) => { responseBody = data; return res; },
        };
        for (const middleware of middlewares) {
            let nextCalled = false;
            let error;
            const next = (err) => {
                if (err)
                    error = err;
                nextCalled = true;
            };
            await middleware(req, res, next);
            if (error)
                throw error;
            if (!nextCalled) {
                return {
                    statusCode,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(responseBody),
                };
            }
        }
        const next = (err) => { if (err)
            throw err; };
        await handler(req, res, next);
        return {
            statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responseBody),
        };
    };
};
exports.lambdaAdapter = lambdaAdapter;
