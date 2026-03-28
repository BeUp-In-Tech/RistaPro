/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  TErrorSources,
  TGenericsErrorResponse,
} from '../interface/error.types';

export const zodErrorHandler = (err: any): TGenericsErrorResponse => {
  const errorSources: TErrorSources[] = [];
  err.issues.forEach((issue: any) => {
    errorSources.push({
      path: issue.path[issue.path.at(-1)], // catch last field of error
      message: issue.message,
    });
  });

  return {
    statusCode: 400,
    message: 'Zod Validation Error',
    errorSources,
  };
};
