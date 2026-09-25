import { APIGatewayProxyEventV2 } from 'aws-lambda'
import { Request, Response, NextFunction } from 'express'
import { connectDb } from './mongo/db'

type ExpressHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void> | any

export const lambdaAdapter = (handler: ExpressHandler, middlewares: ExpressHandler[] = []) => {
  return async (event: APIGatewayProxyEventV2) => {
    await connectDb()

    const req = {
      body: event.body ? JSON.parse(event.body) : {},
      params: event.pathParameters || {},
      query: event.queryStringParameters || {},
      headers: event.headers || {},
      originalUrl: event.rawPath || '/',
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