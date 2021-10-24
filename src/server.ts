import express, { Express } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import config from '../config.json';
import { getFilesWithKeyword } from './utils/getFilesWithKeyword';
import { Router } from 'express';

require("dotenv").config();

const app: Express = express();
export const router: Router = express.Router();
const cookieParser = require('cookie-parser');
/************************************************************************************
 *                              Basic Express Middlewares
 ***********************************************************************************/

var spotifyRouter = require('./app/routes/spotify');

app.use(cookieParser());
app.set('json spaces', 4);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Handle logs in console during development
if (process.env.NODE_ENV === 'development' || config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  app.use(cors());
}

// Handle security and origin in production
if (process.env.NODE_ENV === 'production' || config.NODE_ENV === 'production') {
  app.use(helmet());
}

if (process.env.PORT === undefined) {
  console.log("just nothing");
}

/************************************************************************************
 *                               Register all routes
 ***********************************************************************************/

getFilesWithKeyword('router', __dirname + '/app').forEach((file: string) => {
  const { router } = require(file);
  app.use('/', router);
})

app.use("/spotify",spotifyRouter);

/************************************************************************************
 *                               Express Error Handling
 ***********************************************************************************/

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  return res.status(500).json({
    errorName: err.name,
    message: err.message,
    stack: err.stack || 'no stack defined'
  });
});


export default app;