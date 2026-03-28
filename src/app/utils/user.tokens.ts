import { JwtPayload } from "jsonwebtoken";
import env from "../config/env";
import { generateToken } from "./jwt";

export const createUserTokens = async (user: JwtPayload) => {
  const jwtPayload  = {
    userId: user?._id,
    email: user?.email,
    role: user?.role,
  };

  // Jsonwebtoken
  const accessToken = generateToken(
    jwtPayload,
    env?.JWT_SECRET,
    env?.JWT_EXPIRATION
  );
  const refreshToken = generateToken(
    jwtPayload,
    env?.JWT_REFRESH_SECRET,
    env?.JWT_REFRESH_EXPIRATION
  );

  return {
    accessToken,
    refreshToken,
  };
};