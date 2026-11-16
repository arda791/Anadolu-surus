import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClientWsMessage,
  normalizeRoomCode,
  OnlinePlayerTelemetry,
  RoomPlayerSnapshot,
  RoomSnapshot,
  ServerWsMessage,
} from './multiplayer';
import { AtmosphereMode, VehicleId, VehicleMods } from './types';

export type OnlineConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface FriendAlert {
  id: number;
  message: string;
}

export interface UseOnlineRoomOptions {
  onRoomStarted?: (room: RoomSnapshot, myPlayerId: string) => void;
  onAtmosphereSync?: (mode: AtmosphereMode) => void;
}

export function useOnlineRoom({
  onRoomStarted,
  onAtmosphereSync,
}: UseOnlineRoomOptions) {
  const [status, setStatus] = useState<OnlineConnectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [friendAlert, setFriendAlert] = useState<FriendAlert | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingMsgsRef = useRef<ClientWsMessage[]>([]);
  const remotePlayersRef = useRef<Map<string, RoomPlayerSnapshot>>(new Map());
  const myPlayerIdRef = useRef<string | null>(null);
  const prevStartedRef = useRef<boolean>(false);
  const callbacksRef = useRef({ onRoomStarted, onAtmosphereSync });
  callbacksRef.current = { onRoomStarted, onAtmosphereSync };

  const syncRemoteMap = useCallback(
    (players: RoomPlayerSnapshot[], selfId: string | null) => {
      const map = remotePlayersRef.current;
      const seen = new Set<string>();
      for (const p of players) {
        if (p.id === selfId) continue;
        seen.add(p.id);
        map.set(p.id, p);
      }
      for (const id of map.keys()) {
        if (!seen.has(id)) {
          map.delete(id);
        }
      }
    },
    [],
  );

  const ensureSocket = useCallback((): WebSocket | null => {
    if (typeof window === 'undefined') return null;
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return existing;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    setStatus('connecting');
    setErrorMsg(null);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setErrorMsg(null);
      const queue = pendingMsgsRef.current.splice(0);
      for (const item of queue) {
        ws.send(JSON.stringify(item));
      }
    };

    ws.onmessage = (event) => {
      let msg: ServerWsMessage;
      try {
        msg = JSON.parse(String(event.data)) as ServerWsMessage;
      } catch {
        return;
      }

      if (msg.type === 'room:joined') {
        myPlayerIdRef.current = msg.playerId;
        setPlayerId(msg.playerId);
        setRoom(msg.room);
        setErrorMsg(null);
        syncRemoteMap(msg.room.players, msg.playerId);
        callbacksRef.current.onAtmosphereSync?.(msg.room.atmosphere);
        if (msg.room.started && !prevStartedRef.current) {
          prevStartedRef.current = true;
          callbacksRef.current.onRoomStarted?.(msg.room, msg.playerId);
        }
        return;
      }

      if (msg.type === 'room:state') {
        setRoom(msg.room);
        syncRemoteMap(msg.room.players, myPlayerIdRef.current);
        callbacksRef.current.onAtmosphereSync?.(msg.room.atmosphere);
        if (msg.room.started && !prevStartedRef.current && myPlayerIdRef.current) {
          prevStartedRef.current = true;
          callbacksRef.current.onRoomStarted?.(msg.room, myPlayerIdRef.current);
        }
        if (!msg.room.started) {
          prevStartedRef.current = false;
        }
        return;
      }

      if (msg.type === 'players:tick') {
        syncRemoteMap(msg.players, myPlayerIdRef.current);
        return;
      }

      if (msg.type === 'player:honked') {
        setFriendAlert({
          id: Date.now(),
          message: `${msg.playerName} korna çaldı!`,
        });
        return;
      }

      if (msg.type === 'room:error') {
        setErrorMsg(msg.message);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setErrorMsg('Sunucuya bağlanılamadı.');
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
    };

    return ws;
  }, [syncRemoteMap]);

  const sendMessage = useCallback(
    (msg: ClientWsMessage) => {
      const ws = ensureSocket();
      if (!ws) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      } else {
        pendingMsgsRef.current.push(msg);
      }
    },
    [ensureSocket],
  );

  const createRoom = useCallback(
    (params: {
      playerName: string;
      vehicleId: VehicleId;
      paintHex: string;
      mods: VehicleMods;
      atmosphere: AtmosphereMode;
    }) => {
      prevStartedRef.current = false;
      sendMessage({ type: 'room:create', ...params });
    },
    [sendMessage],
  );

  const joinRoom = useCallback(
    (params: {
      roomCode: string;
      playerName: string;
      vehicleId: VehicleId;
      paintHex: string;
      mods: VehicleMods;
    }) => {
      const clean = normalizeRoomCode(params.roomCode);
      if (clean.length < 3) {
        setErrorMsg('Lütfen geçerli bir oda kodu girin.');
        return;
      }
      prevStartedRef.current = false;
      sendMessage({ type: 'room:join', ...params, roomCode: clean });
    },
    [sendMessage],
  );

  const updateRoomCar = useCallback(
    (params: {
      vehicleId: VehicleId;
      paintHex: string;
      mods: VehicleMods;
      atmosphere?: AtmosphereMode;
    }) => {
      if (!room) return;
      sendMessage({ type: 'room:update_car', ...params });
    },
    [room, sendMessage],
  );

  const startRoom = useCallback(() => {
    if (!room) return;
    sendMessage({ type: 'room:start' });
  }, [room, sendMessage]);

  const leaveRoom = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
    }
    remotePlayersRef.current.clear();
    myPlayerIdRef.current = null;
    prevStartedRef.current = false;
    setPlayerId(null);
    setRoom(null);
    setErrorMsg(null);
  }, []);

  const sendTelemetry = useCallback((telemetry: OnlinePlayerTelemetry) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'player:state', telemetry }));
    }
  }, []);

  const sendHonk = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'player:honk' }));
    }
  }, []);

  useEffect(() => {
    if (!friendAlert) return;
    const t = window.setTimeout(() => setFriendAlert(null), 2200);
    return () => window.clearTimeout(t);
  }, [friendAlert]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return {
    status,
    errorMsg,
    room,
    playerId,
    isHost: Boolean(room && playerId && room.hostId === playerId),
    remotePlayersRef,
    friendAlert,
    createRoom,
    joinRoom,
    updateRoomCar,
    startRoom,
    leaveRoom,
    sendTelemetry,
    sendHonk,
  };
}
