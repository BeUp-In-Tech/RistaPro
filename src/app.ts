import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { router } from './app/routes';
import { globalErrorHandler } from './app/middlewares/globalErrorHandler';
import { NotFound } from './app/middlewares/NotFound';
import rateLimit from 'express-rate-limit';
import { safeSanitizeMiddleware } from './app/middlewares/mongoSanitizer';
import env from './app/config/env';
import expressSession from 'express-session';
import passport from 'passport';
import './app/config/passport.config'
import http from 'http';
import { initSocket } from './app/socket/socket';



const app = express();
const server = http.createServer(app);

// Socket
initSocket(server);

app.use(expressSession({
  secret: env.EXPRESS_SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize()); // Initilazed Passport
app.use(passport.session()); // Create a session
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(safeSanitizeMiddleware);


const limiter = rateLimit({
  windowMs: env.REQUEST_RATE_LIMIT_TIME * 1000 * 10, 
  max: env.REQUEST_RATE_LIMIT,  
  message: {success: false, statusCode: 400, message: "Too many requests, please try again later."}
});

app.use(limiter);

app.get('/', async (req: Request, res: Response) => {
  res.send('Welcome to the RistaPro server');
});

// GLOBAL ROUTES
app.use('/api/v1', router);

// GLOBAL ERROR HANDLER
app.use(globalErrorHandler);

// NO ROUTE MATCH
app.use(NotFound);

export default server;
