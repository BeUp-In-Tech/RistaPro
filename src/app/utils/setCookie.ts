import { Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import env from '../config/env';

interface AuthTokenInfo {
  refreshToken?: string;
}

const isProduction = env.NODE_ENV === 'production';

export const SetCookies = (res: Response, tokenInfo: AuthTokenInfo) => {
  const { refreshToken } = tokenInfo;
  if (!refreshToken) {
    return;
  }

  const decodedToken = jwt.decode(refreshToken) as JwtPayload | null;
  const maxAge = decodedToken?.exp
    ? decodedToken.exp * 1000 - Date.now()
    : undefined;

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: maxAge && maxAge > 0 ? maxAge : undefined,
  });
};
