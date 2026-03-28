import { NextFunction, Request, Response } from 'express';

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

// export const CatchAsync = (fn: AsyncHandler) =>  async (req: Request, res: Response, next: NextFunction) => {
//     Promise.resolve(fn(req, res, next)).catch((err: any) => {
//         next(err);
//     })
// }

// Alternative (Same works)

export const CatchAsync =
  (fn: AsyncHandler) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
