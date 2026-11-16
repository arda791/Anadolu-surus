import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  ClientWsMessage,
  OnlinePlayerTelemetry,
  RoomPlayerSnapshot,
  RoomSnapshot,
  ServerWsMessage,
} from './src/game/multiplayer.ts';
import {
  generateRoomCode,
  getOnlineSpawnPosition,
  normalizeRoomCode,
  sanitizePlayerName,
} from './src/game/multiplayer.ts';
import type { AtmosphereMode, VehicleId, VehicleMods } from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS_PER_ROOM = 6;

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  roomCode: string | null;
}

interface RoomPlayerRecord extends RoomPlayerSnapshot {
  client: ConnectedClient;
  lastSeenMs: number;
}

interface ServerRoom {
  roomCode: string;
  hostId: string;
  atmosphere: AtmosphereMode;
  trafficSeed: number;
  started: boolean;
  players: Map<string, RoomPlayerRecord>;
  nextSlot: number;
}

const rooms = new Map<string, ServerRoom>();
let nextClientSeq = 1;

function sendJson(ws: WebSocket, payload: ServerWsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function toRoomSnapshot(room: ServerRoom): RoomSnapshot {
  const players: RoomPlayerSnapshot[] = [];
  for (const p of room.players.values()) {
    players.push({
      id: p.id,
      name: p.name,
      vehicleId: p.vehicleId,
      paintHex: p.paintHex,
      mods: p.mods,
      slotIndex: p.slotIndex,
      x: p.x,
      z: p.z,
      speedMs: p.speedMs,
      heading: p.heading,
      steerAngle: p.steerAngle,
      headlightMode: p.headlightMode,
      flasherActive: p.flasherActive,
      leftSignalOn: p.leftSignalOn,
      rightSignalOn: p.rightSignalOn,
      braking: p.braking,
      score: p.score,
      distanceMeters: p.distanceMeters,
      health: p.health,
      crashed: p.crashed,
    });
  }
  players.sort((a, b) => a.slotIndex - b.slotIndex);
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    atmosphere: room.atmosphere,
    trafficSeed: room.trafficSeed,
    started: room.started,
    players,
  };
}

function broadcastRoomState(room: ServerRoom): void {
  const snap = toRoomSnapshot(room);
  for (const p of room.players.values()) {
    sendJson(p.client.ws, { type: 'room:state', room: snap });
  }
}

function removeClientFromRoom(client: ConnectedClient): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;

  room.players.delete(client.id);
  if (room.players.size === 0) {
    rooms.delete(room.roomCode);
    return;
  }

  if (room.hostId === client.id) {
    const firstRemaining = room.players.values().next().value as RoomPlayerRecord | undefined;
    if (firstRemaining) {
      room.hostId = firstRemaining.id;
    }
  }
  broadcastRoomState(room);
}

function makeDefaultTelemetry(slotIndex: number, atmosphere: AtmosphereMode): OnlinePlayerTelemetry {
  const spawn = getOnlineSpawnPosition(slotIndex);
  return {
    x: spawn.x,
    z: spawn.z,
    speedMs: 0,
    heading: 0,
    steerAngle: 0,
    headlightMode: atmosphere === 'night' ? 'low' : 'off',
    flasherActive: false,
    leftSignalOn: false,
    rightSignalOn: false,
    braking: false,
    score: 0,
    distanceMeters: 0,
    health: 100,
    crashed: false,
  };
}

function createUniqueRoomCode(): string {
  for (let i = 0; i < 32; i++) {
    const code = generateRoomCode();
    if (!rooms.has(code)) return code;
  }
  return `TR${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    perMessageDeflate: false,
  });

  // Keep-alive ping so Cloud Run / reverse proxies don't drop idle lobby WebSockets
  const aliveMap = new WeakMap<WebSocket, boolean>();

  wss.on('connection', (ws) => {
    aliveMap.set(ws, true);
    ws.on('pong', () => {
      aliveMap.set(ws, true);
    });
    const client: ConnectedClient = {
      id: `p_${nextClientSeq++}_${Math.random().toString(36).slice(2, 6)}`,
      ws,
      roomCode: null,
    };

    ws.on('message', (raw) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientWsMessage;
      } catch {
        sendJson(ws, { type: 'room:error', message: 'Geçersiz mesaj formatı.' });
        return;
      }

      if (msg.type === 'room:create') {
        removeClientFromRoom(client);
        const roomCode = createUniqueRoomCode();
        const atmo: AtmosphereMode = msg.atmosphere || 'afternoon';
        const room: ServerRoom = {
          roomCode,
          hostId: client.id,
          atmosphere: atmo,
          trafficSeed: 1923 + Math.floor(Math.random() * 9000),
          started: false,
          players: new Map(),
          nextSlot: 0,
        };
        const slotIndex = room.nextSlot++;
        const tel = makeDefaultTelemetry(slotIndex, atmo);
        const record: RoomPlayerRecord = {
          id: client.id,
          name: sanitizePlayerName(msg.playerName, 'Kurucu'),
          vehicleId: msg.vehicleId,
          paintHex: msg.paintHex,
          mods: msg.mods,
          slotIndex,
          ...tel,
          client,
          lastSeenMs: Date.now(),
        };
        room.players.set(client.id, record);
        rooms.set(roomCode, room);
        client.roomCode = roomCode;
        sendJson(ws, {
          type: 'room:joined',
          playerId: client.id,
          room: toRoomSnapshot(room),
        });
        return;
      }

      if (msg.type === 'room:join') {
        const normalized = normalizeRoomCode(msg.roomCode);
        const room = rooms.get(normalized);
        if (!room) {
          sendJson(ws, {
            type: 'room:error',
            message: `"${normalized || '?'}" kodlu oda bulunamadı.`,
          });
          return;
        }
        if (room.players.size >= MAX_PLAYERS_PER_ROOM && !room.players.has(client.id)) {
          sendJson(ws, {
            type: 'room:error',
            message: 'Bu oda dolu (en fazla 6 sürücü).',
          });
          return;
        }

        if (client.roomCode && client.roomCode !== normalized) {
          removeClientFromRoom(client);
        }

        let record = room.players.get(client.id);
        if (!record) {
          const slotIndex = room.nextSlot++;
          const tel = makeDefaultTelemetry(slotIndex, room.atmosphere);
          record = {
            id: client.id,
            name: sanitizePlayerName(msg.playerName, `Sürücü ${slotIndex + 1}`),
            vehicleId: msg.vehicleId,
            paintHex: msg.paintHex,
            mods: msg.mods,
            slotIndex,
            ...tel,
            client,
            lastSeenMs: Date.now(),
          };
          room.players.set(client.id, record);
        } else {
          record.name = sanitizePlayerName(msg.playerName, record.name);
          record.vehicleId = msg.vehicleId;
          record.paintHex = msg.paintHex;
          record.mods = msg.mods;
          record.lastSeenMs = Date.now();
        }
        client.roomCode = normalized;

        const snap = toRoomSnapshot(room);
        sendJson(ws, {
          type: 'room:joined',
          playerId: client.id,
          room: snap,
        });
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'room:leave') {
        removeClientFromRoom(client);
        return;
      }

      if (!client.roomCode) return;
      const room = rooms.get(client.roomCode);
      if (!room) return;
      const player = room.players.get(client.id);
      if (!player) return;

      if (msg.type === 'room:update_car') {
        player.vehicleId = msg.vehicleId;
        player.paintHex = msg.paintHex;
        player.mods = msg.mods;
        if (msg.atmosphere && room.hostId === client.id) {
          room.atmosphere = msg.atmosphere;
        }
        player.lastSeenMs = Date.now();
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'room:start') {
        if (room.hostId !== client.id) return;
        room.started = true;
        // Reset each player cleanly to their assigned convoy lane at start
        let idx = 0;
        for (const p of room.players.values()) {
          p.slotIndex = idx;
          const tel = makeDefaultTelemetry(idx, room.atmosphere);
          Object.assign(p, tel);
          idx++;
        }
        room.nextSlot = idx;
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'player:state') {
        const t = msg.telemetry;
        if (!t || typeof t.x !== 'number' || typeof t.z !== 'number') return;
        player.x = t.x;
        player.z = t.z;
        player.speedMs = t.speedMs;
        player.heading = t.heading;
        player.steerAngle = t.steerAngle;
        player.headlightMode = t.headlightMode;
        player.flasherActive = Boolean(t.flasherActive);
        player.leftSignalOn = Boolean(t.leftSignalOn);
        player.rightSignalOn = Boolean(t.rightSignalOn);
        player.braking = Boolean(t.braking);
        player.score = t.score;
        player.distanceMeters = t.distanceMeters;
        player.health = t.health;
        player.crashed = Boolean(t.crashed);
        player.lastSeenMs = Date.now();
        return;
      }

      if (msg.type === 'player:honk') {
        for (const p of room.players.values()) {
          if (p.id !== client.id) {
            sendJson(p.client.ws, {
              type: 'player:honked',
              playerId: client.id,
              playerName: player.name,
            });
          }
        }
      }
    });

    ws.on('close', () => {
      removeClientFromRoom(client);
    });
  });

  // Authoritative 20Hz telemetry broadcast loop for active rooms
  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (!room.started || room.players.size === 0) continue;
      const snap = toRoomSnapshot(room);
      for (const p of room.players.values()) {
        sendJson(p.client.ws, {
          type: 'players:tick',
          serverTime: now,
          players: snap.players,
        });
      }
    }
  }, 50);

  // 25s WebSocket heartbeat for proxy/Cloud Run idle timeout protection
  const heartbeatInterval = setInterval(() => {
    for (const ws of wss.clients) {
      if (aliveMap.get(ws) === false) {
        ws.terminate();
        continue;
      }
      aliveMap.set(ws, false);
      ws.ping();
    }
  }, 25000);

  const distDir = path.resolve(__dirname, 'dist');
  const useViteDev = process.env.NODE_ENV !== 'production';

  if (useViteDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Anadolu Surus server listening on port ${PORT}`);
  });

  const shutdown = () => {
    clearInterval(heartbeatInterval);
    wss.close();
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
