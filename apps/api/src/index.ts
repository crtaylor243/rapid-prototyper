import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth';
import { logInfo } from './logger';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser(config.sessionSecret));
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true
  })
);
app.use(morgan('dev'));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);

const uiDistPath = path.join(__dirname, '../../ui/dist');
app.use(express.static(uiDistPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(uiDistPath, 'index.html'));
});

app.listen(config.port, () => {
  logInfo('API server started', { port: config.port });
});
