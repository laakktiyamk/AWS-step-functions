"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lambdaAdapter = void 0;
const db_1 = require("./mongo/db");
const lambdaAdapter = (handler, middlewares = []) => {
    return async (event) => {
        await (0, db_1.connectDb)();
        const req = {
            body: event.body ? JSON.parse(event.body) : {},
            params: event.pathParameters || {},
            query: event.queryStringParameters || {},
            headers: event.headers || {},
            originalUrl: event.rawPath || '/',
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
