import type {
  AtmosphereMode,
  HeadlightBeamMode,
  VehicleId,
  VehicleMods,
} from './types';

const CONVOY_LANE_CENTERS = [-5.85, -1.95, 1.95, 5.85] as const;

export interface OnlinePlayerTelemetry {
  x: number;
  z: number;
  speedMs: number;
  heading: number;
  steerAngle: number;
  headlightMode: HeadlightBeamMode;
  flasherActive: boolean;
  leftSignalOn: boolean;
  rightSignalOn: boolean;
  braking: boolean;
  score: number;
  distanceMeters: number;
  health: number;
  crashed: boolean;
}

export interface RoomPlayerSnapshot extends OnlinePlayerTelemetry {
  id: string;
  name: string;
  vehicleId: VehicleId;
  paintHex: string;
  mods: VehicleMods;
  slotIndex: number;
}

export interface RoomSnapshot {
  roomCode: string;
  hostId: string;
  atmosphere: AtmosphereMode;
  trafficSeed: number;
  started: boolean;
  players: RoomPlayerSnapshot[];
}

export type ClientWsMessage =
  | {
      type: 'room:create';
      playerName: string;
      vehicleId: VehicleId;
      paintHex: string;
      mods: VehicleMods;
      atmosphere: AtmosphereMode;
    }
  | {
      type: 'room:join';
      roomCode: string;
      playerName: string;
      vehicleId: VehicleId;
      paintHex: string;
      mods: VehicleMods;
    }
  | {
      type: 'room:update_car';
      vehicleId: VehicleId;
      paintHex: string;
      mods: VehicleMods;
      atmosphere?: AtmosphereMode;
    }
  | { type: 'room:start' }
  | { type: 'room:leave' }
  | { type: 'player:state'; telemetry: OnlinePlayerTelemetry }
  | { type: 'player:honk' };

export type ServerWsMessage =
  | {
      type: 'room:joined';
      playerId: string;
      room: RoomSnapshot;
    }
  | {
      type: 'room:state';
      room: RoomSnapshot;
    }
  | {
      type: 'room:error';
      message: string;
    }
  | {
      type: 'players:tick';
      serverTime: number;
      players: RoomPlayerSnapshot[];
    }
  | {
      type: 'player:honked';
      playerId: string;
      playerName: string;
    };

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += ROOM_ALPHABET[Math.floor(rand() * ROOM_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

export function sanitizePlayerName(raw: string, fallback = 'Sürücü'): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 18);
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Deterministic side-by-side starting lane and Z offset so friends spawn
 * cleanly next to each other on the 4-lane Turkish highway without overlapping.
 */
export function getOnlineSpawnPosition(slotIndex: number): { x: number; z: number } {
  const laneOrder = [2, 1, 3, 0];
  const laneIdx = laneOrder[slotIndex % laneOrder.length];
  const row = Math.floor(slotIndex / laneOrder.length);
  return {
    x: CONVOY_LANE_CENTERS[laneIdx],
    z: row * 7.5,
  };
}
