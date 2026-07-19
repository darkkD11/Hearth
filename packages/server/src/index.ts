import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { pool } from './db/index.js';
import { initializeSocket } from './socket/index.js';
import authRouter from './routes/auth.js';
import channelsRouter from './routes/channels.js';
import messagesRouter from './routes/messages.js';
import { livekitRouter } from './routes/livekit.js';
import inviteRoutes from './routes/invites.js';
import memberRoutes from './routes/members.js';
import uploadRoutes from './routes/upload.js';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@hearth/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// --- Socket.IO ---
const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(server, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

// --- Express Middleware ---
app.use(helmet({ contentSecurityPolicy: false })); // CSP off for dev
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// --- Health Check ---
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// --- API Routes ---
app.use('/api/auth', authRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/livekit', livekitRouter);
app.use('/api/invites', inviteRoutes);
app.use('/api', memberRoutes);
app.use('/api', uploadRoutes);

// --- Static Files ---
app.use(express.static(path.resolve(__dirname, '../../public')));

// --- Socket.IO Handlers ---
initializeSocket(io);

// --- Start Server ---
server.listen(config.port, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║          🔥 Hearth Server 🔥          ║
  ║                                       ║
  ║   API:    http://localhost:${config.port}      ║
  ║   Socket: ws://localhost:${config.port}       ║
  ╚═══════════════════════════════════════╝
  `);
});

// --- Graceful Shutdown ---
const shutdown = async (signal: string) => {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
  io.close();
  server.close();
  await pool.end();
  console.log('[Server] Goodbye!');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
