/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import {
  TErrorSources,
  TGenericsErrorResponse,
} from '../interface/error.types';

export const validationError = (
  err: mongoose.Error.ValidationError
): TGenericsErrorResponse => {
  const errorSources: TErrorSources[] = [];
  const error = Object.values(err.errors);
  error.forEach((errorObject: any) =>
    errorSources.push({
      path: errorObject.path,
      message: errorObject.message,
    })
  );

  return {
    statusCode: 400,
    message: 'Validation Error',
    errorSources,
  };
};
