
// import { createClient } from 'redis';
// import env from './env';

// export const redisClient = createClient({
//   username: env.REDIS_USERNAME,
//   password: env.REDIS_PASSWORD,
//   socket: {
//     host: env.REDIS_HOST,
//     port: Number(env.REDIS_PORT),
//     tls: true,
//   },
// });

// redisClient.on('error', (error: any) => console.log('Redis client error', error));

// export const connectRedis = async () => {
//   if (!redisClient.isOpen) {
//     await redisClient.connect();
//     console.log('Redis connected');
//   }
// };
