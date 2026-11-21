import { APIGatewayProxyEventV2 } from 'aws-lambda'
import { Request, Response, NextFunction } from 'express'
import { connectDb } from './mongo/db'

type ExpressHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void> | any

/**
 * Kolmas parametri on jäljellä vain vanhojen kutsujen yhteensopivuuden vuoksi.
 * Jaettua CDSE-tokenia ei enää haeta: req.authToken asetetaan käyttäjäkohtaisesti
 * checkUserToken-middlewaressa.
 */
export const lambdaAdapter = (handler: ExpressHandler, middlewares: ExpressHandler[] = [], _needsSentinelToken = false) => {
  return async (event: APIGatewayProxyEventV2 | any) => {
    await connectDb()

    const authToken: string | null = null

    let body: any
    try {
      const rawBody = event.body ?? event
      body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'INVALID_JSON' }),
      }
    }

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