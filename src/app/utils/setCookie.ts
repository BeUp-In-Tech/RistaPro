import { Response } from 'express';
import env from '../config/env';

interface AuthTokenInfo {
  accessToken?: string;
  refreshToken?: string;
}

export const SetCookies = (res: Response, tokenInfo: AuthTokenInfo) => {
  if (tokenInfo.accessToken) {
    res.cookie('accessToken', tokenInfo.accessToken, {
      httpOnly: false,
      secure: env.NODE_ENV === "development" ? false : true, 
      sameSite: env.NODE_ENV === "development" ? 'lax' : 'none', 
    });
  }

  if (tokenInfo.refreshToken) {
    res.cookie('refreshToken', tokenInfo.refreshToken, {
      httpOnly: true, 
      secure: env.NODE_ENV === "development" ? false : true,
      sameSite: env.NODE_ENV === "development" ? 'lax' : 'none'
    });
  }
};

