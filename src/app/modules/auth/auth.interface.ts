import { JwtPayload } from "jsonwebtoken";

export interface GoogleIdTokenPayload extends JwtPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  azp?: string;
  aud?: string | string[];
}

export interface GoogleUserInfoPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
}