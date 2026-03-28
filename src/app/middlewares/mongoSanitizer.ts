/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from 'express';
import mongoSanitize from 'express-mongo-sanitize';

export const safeSanitizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // body & params safe
    if (req.body) req.body = mongoSanitize.sanitize(req.body);
    if (req.params) req.params = mongoSanitize.sanitize(req.params);

    // query safe sanitize without reassigning
    const cleanedQuery: any = {};
    for (const key in req.query) {
      const safeKey = key.replace(/\$/g, '_').replace(/\./g, '_');
      cleanedQuery[safeKey] = req.query[key];
    }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    Object.keys(req.query).forEach(k => delete req.query[k]);
    Object.assign(req.query, cleanedQuery);

    next();
  } catch (err) {
    next(err);
  }
}