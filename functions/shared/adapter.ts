import { APIGatewayProxyEventV2 } from 'aws-lambda'
import { Request, Response, NextFunction } from 'express'
import { connectDb } from './mongo/db'
import { authenticate } from './utils/authenticate_CDSE'

type ExpressHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void> | any

export const lambdaAdapter = (handler: ExpressHandler, middlewares: ExpressHandler[] = [], needsSentinelToken = false) => {
  return async (event: APIGatewayProxyEventV2 | any) => {
    await connectDb()

    let authToken: string | null = null
    if (needsSentinelToken) {
      console.log("Fetching Sentinel token...")
      authToken = await authenticate()
      console.log("Token fetched:", authToken ? "OK" : "FAILED")
    }

    const rawBody = event.body ?? event
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody

    const req = {
      body,
      params: event.pathParameters || {},
      query: event.queryStringParameters || {},
      headers: event.headers || {},
      originalUrl: event.rawPath || '/',
      authToken,
    } as unknown as Request

    let statusCode = 200
    let responseBody: unknown

    const res = {
      status: (code: number) => { statusCode = code; return res },
      json: (data: unknown) => { responseBody = data; return res },
      send: (data: unknown) => { responseBody = data; return res },
    } as unknown as Response

    for (const middleware of middlewares) {
      let nextCalled = false
      let error: any

      const next: NextFunction = (err?: any) => {
        if (err) error = err
        nextCalled = true
      }

      await middleware(req, res, next)

      if (error) throw error
      if (!nextCalled) {
        return {
          statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responseBody),
        }
      }
    }

    const next: NextFunction = (err?: any) => { if (err) throw err }
    await handler(req, res, next)

    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(responseBody),
    }
  }
}