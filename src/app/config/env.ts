import dotenv from 'dotenv';
dotenv.config();

interface EnvInterfaces {
  PORT: string;
  MONGO_URI: string;
  NODE_ENV: 'development' | 'production';
  JWT_SECRET: string;
  JWT_EXPIRATION: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRATION: string;
  BCRYPT_SALT_ROUND: string;

  REDIS_HOST: string;
  REDIS_PORT: string;

  FRONTEND_URL: string;

  REQUEST_RATE_LIMIT: number;
  REQUEST_RATE_LIMIT_TIME: number;

  EXPRESS_SESSION_SECRET: string;

  GOOGLE_OAUTH_ID: string;
  GOOGLE_OAUTH_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
}

const loadEnvVarbles = (): EnvInterfaces => {
  const requireEnvVariables: string[] = [
    'PORT',
    'MONGO_URI',
    'JWT_SECRET',
    'NODE_ENV',

    'JWT_SECRET',
    'JWT_EXPIRATION',
    'JWT_REFRESH_SECRET',
    'JWT_REFRESH_EXPIRATION',

    'REDIS_HOST',
    'REDIS_PORT',
    
    'BCRYPT_SALT_ROUND',
 
    'FRONTEND_URL',

    'REQUEST_RATE_LIMIT',
    'REQUEST_RATE_LIMIT_TIME',

    'EXPRESS_SESSION_SECRET',

    'GOOGLE_OAUTH_ID',
    'GOOGLE_OAUTH_SECRET',
    'GOOGLE_CALLBACK_URL',
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

    JWT_SECRET: process.env.JWT_SECRET as string,
    JWT_EXPIRATION: process.env.JWT_EXPIRATION as string,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
    JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION as string,

    REDIS_HOST: process.env.REDIS_HOST as string,
    REDIS_PORT: process.env.REDIS_PORT as string,
    
    FRONTEND_URL: process.env.FRONTEND_URL as string,

    REQUEST_RATE_LIMIT_TIME: Number(process.env.REQUEST_RATE_LIMIT_TIME) as number,
    REQUEST_RATE_LIMIT:Number( process.env.REQUEST_RATE_LIMIT) as number,

    EXPRESS_SESSION_SECRET: process.env.EXPRESS_SESSION_SECRET as string,

    GOOGLE_OAUTH_ID: process.env.GOOGLE_OAUTH_ID as string,
    GOOGLE_OAUTH_SECRET: process.env.GOOGLE_OAUTH_SECRET as string,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL as string,
  };
};

export default loadEnvVarbles();
