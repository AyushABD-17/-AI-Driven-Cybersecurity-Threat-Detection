'use strict';

require('dotenv').config();
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const mongoose = require('mongoose');

const app = require('./app');
const { initRedisSubscriber } = require('./services/redisSubscriber');
const { authenticateSocket } = require('./middleware/auth');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// ── HTTP + Socket.io ──────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new SocketIO(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach io on app so routes/services can access it
app.set('io', io);

// JWT auth on Socket.io handshake
io.use(authenticateSocket);

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id} | user: ${socket.user?.email}`);

  // Allow clients to filter by severity
  socket.on('filter:set', ({ severities }) => {
    if (Array.isArray(severities)) {
      socket.data.severityFilter = severities;
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ── MongoDB ───────────────────────────────────────────────────────────────────
async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
    process.exit(1);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  await connectMongo();
  await initRedisSubscriber(io);

  httpServer.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
  });
}

bootstrap();

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received — shutting down gracefully');
  await mongoose.disconnect();
  process.exit(0);
});
