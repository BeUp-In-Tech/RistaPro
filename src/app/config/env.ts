import dotenv from 'dotenv';
dotenv.config();

interface EnvInterfaces {
  PORT: string;
  MONGO_URI: string;
  NODE_ENV: 'development' | 'production';

  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRATION: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRATION: string;

  OTP_JWT_ACCESS_SECRET: string;
  OTP_JWT_ACCESS_EXPIRATION: string;

  BCRYPT_SALT_ROUND: string;

  REDIS_HOST: string;
  REDIS_PORT: string;

  FRONTEND_URL: string;

  CLOUDINARY_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_SECRET: string;

  REQUEST_RATE_LIMIT: number;
  REQUEST_RATE_LIMIT_TIME: number;

  EXPRESS_SESSION_SECRET: string;

  GOOGLE_OAUTH_ID: string;
  GOOGLE_OAUTH_SECRET: string;
  GOOGLE_CALLBACK_URL: string;

  ADMIN_MAIL: string;
  ADMIN_PASSWORD: string;

  EMAIL_HOST: string;
  EMAIL_PORT: number;
  EMAIL_USER: string;
  EMAIL_PASSWORD: string;
  EMAIL_SECURITY: boolean;
}

const loadEnvVarbles = (): EnvInterfaces => {
  const requireEnvVariables: string[] = [
    'PORT',
    'MONGO_URI',
    'NODE_ENV',

    'JWT_ACCESS_SECRET',
    'JWT_ACCESS_EXPIRATION',
    'OTP_JWT_ACCESS_SECRET',
    'OTP_JWT_ACCESS_EXPIRATION',
    'JWT_REFRESH_SECRET',
    'JWT_REFRESH_EXPIRATION',

    'REDIS_HOST',
    'REDIS_PORT',
    
    'BCRYPT_SALT_ROUND',
 
    'FRONTEND_URL',

    'CLOUDINARY_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_SECRET',

    'REQUEST_RATE_LIMIT',
    'REQUEST_RATE_LIMIT_TIME',

    'EXPRESS_SESSION_SECRET',

    'GOOGLE_OAUTH_ID',
    'GOOGLE_OAUTH_SECRET',
    'GOOGLE_CALLBACK_URL',

    'ADMIN_MAIL',
    'ADMIN_PASSWORD',

    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'EMAIL_SECURITY',
  ];

  requireEnvVariables.forEach((KEY) => {
    if (!process.env[KEY]) {
      throw new Error(`Missing required env variable ${KEY}`);
    }
  });

  return {
    MONGO_URI: process.env.MONGO_URI as string,
    PORT: process.env.PORT as string,
    NODE_ENV: process.env.NODE_ENV as 'development' | 'production',

    BCRYPT_SALT_ROUND: process.env.BCRYPT_SALT_ROUND as string,

    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
    JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION as string,
    
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
    JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION as string,

    OTP_JWT_ACCESS_SECRET: process.env.OTP_JWT_ACCESS_SECRET as string,
    OTP_JWT_ACCESS_EXPIRATION: process.env.OTP_JWT_ACCESS_EXPIRATION as string,

    REDIS_HOST: process.env.REDIS_HOST as string,
    REDIS_PORT: process.env.REDIS_PORT as string,
    
    FRONTEND_URL: process.env.FRONTEND_URL as string,

    CLOUDINARY_NAME: process.env.CLOUDINARY_NAME as string,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY as string,
    CLOUDINARY_SECRET: process.env.CLOUDINARY_SECRET as string,

    REQUEST_RATE_LIMIT_TIME: Number(process.env.REQUEST_RATE_LIMIT_TIME) as number,
    REQUEST_RATE_LIMIT:Number( process.env.REQUEST_RATE_LIMIT) as number,

    EXPRESS_SESSION_SECRET: process.env.EXPRESS_SESSION_SECRET as string,

    GOOGLE_OAUTH_ID: process.env.GOOGLE_OAUTH_ID as string,
    GOOGLE_OAUTH_SECRET: process.env.GOOGLE_OAUTH_SECRET as string,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL as string,

    ADMIN_MAIL: process.env.ADMIN_MAIL as string,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD as string,

    EMAIL_HOST: process.env.EMAIL_HOST as string,
    EMAIL_PORT: Number(process.env.EMAIL_PORT) as number,
    EMAIL_USER: process.env.EMAIL_USER as string,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD as string,
    EMAIL_SECURITY: process.env.EMAIL_SECURITY === 'true',
  };
};

export default loadEnvVarbles();
