import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import { GarageTab, TitleOverlay } from './components/TitleOverlay';
import { normalizeRoomCode, RoomPlayerSnapshot } from './game/multiplayer';
import { useOnlineRoom } from './game/onlineClient';
import {
  AtmosphereMode,
  CameraMode,
  GamePhase,
  HudSnapshot,
  TitlePreviewAngle,
  VehicleId,
  VehicleMods,
} from './game/types';
import {
  getDefaultModsForVehicle,
  TURKEY_MILESTONES,
  VEHICLES,
} from './game/vehicles';
import { DrivingActionHandle, DrivingCanvas } from './scene/DrivingCanvas';

const BEST_SCORE_KEY = 'anadolu_surus_best_score_v1';
const GARAGE_PREFS_KEY = 'anadolu_surus_garage_v1';

interface SavedGaragePrefs {
  vehicleId: VehicleId;
  paintHex: string;
  mods: VehicleMods;
  playerName: string;
}

function readBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(val: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(Math.round(val)));
  } catch {
    // Ignore storage errors
  }
}

function readGaragePrefs(): SavedGaragePrefs {
  const fallback: SavedGaragePrefs = {
    vehicleId: 'togg_t10x',
    paintHex: VEHICLES.togg_t10x.paints[0].hex,
    mods: getDefaultModsForVehicle('togg_t10x'),
    playerName: 'Sürücü 1',
  };
  try {
    const raw = window.localStorage.getItem(GARAGE_PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SavedGaragePrefs>;
    const vId =
      parsed.vehicleId && parsed.vehicleId in VEHICLES
        ? parsed.vehicleId
        : 'togg_t10x';
    return {
      vehicleId: vId,
      paintHex: parsed.paintHex || VEHICLES[vId].paints[0].hex,
      mods: {
        ...getDefaultModsForVehicle(vId),
        ...(parsed.mods || {}),
      },
      playerName: parsed.playerName || 'Sürücü 1',
    };
  } catch {
    return fallback;
  }
}

function makeInitialHud(vehicleId: VehicleId, bestScore: number): HudSnapshot {
  const spec = VEHICLES[vehicleId];
  return {
    speedKmh: 0,
    rpm: 900,
    maxRpm: spec.isElectric ? 14000 : 7000,
    gear: 1,
    health: 100,
    distanceKm: 0,
    score: 0,
    bestScore,
    nearMissCount: 0,
    comboCount: 0,
    maxSpeedKmh: 0,
    cameraMode: 'cockpit',
    headlightsOn: false,
    headlightMode: 'off',
    leftSignalOn: false,
    rightSignalOn: false,
    nearMissFlash: null,
    milestoneName: TURKEY_MILESTONES[0].name,
    isElectric: spec.isElectric,
  };
}

export default function App() {
  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;
  const autostart = searchParams?.get('autostart') === '1';
  const inviteCode = normalizeRoomCode(searchParams?.get('oda') || '');

  const initialPrefs = useRef<SavedGaragePrefs>(readGaragePrefs()).current;

  const [phase, setPhase] = useState<GamePhase>(autostart ? 'playing' : 'title');
  const [garageTab, setGarageTab] = useState<GarageTab>(
    inviteCode ? 'online' : 'car',
  );
  const [vehicleId, setVehicleId] = useState<VehicleId>(initialPrefs.vehicleId);
  const [paintHex, setPaintHex] = useState<string>(initialPrefs.paintHex);
  const [mods, setMods] = useState<VehicleMods>(initialPrefs.mods);
  const [atmosphere, setAtmosphere] = useState<AtmosphereMode>('afternoon');
  const [previewAngle, setPreviewAngle] = useState<TitlePreviewAngle>('front');
  const [previewHeadlightsOn, setPreviewHeadlightsOn] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('cockpit');
  const [muted, setMuted] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>(initialPrefs.playerName);
  const [joinCodeInput, setJoinCodeInput] = useState<string>(inviteCode);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth < 768 ||
      window.matchMedia?.('(pointer: coarse)').matches === true
    );
  });
  const [bestScore, setBestScore] = useState<number>(() => readBestScore());
  const [hud, setHud] = useState<HudSnapshot>(() =>
    makeInitialHud(initialPrefs.vehicleId, readBestScore()),
  );
  const [finalStats, setFinalStats] = useState<HudSnapshot | null>(null);
  const [remoteHudPlayers, setRemoteHudPlayers] = useState<RoomPlayerSnapshot[]>([]);

  const actionRef = useRef<DrivingActionHandle | null>(null);

  const startDriving = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    setFinalStats(null);
    setCameraMode('cockpit');
    setPhase('playing');
  }, []);

  const online = useOnlineRoom({
    onAtmosphereSync: (mode) => {
      setAtmosphere(mode);
    },
    onRoomStarted: (room, myId) => {
      const me = room.players.find((p) => p.id === myId);
      actionRef.current?.resetRun(me?.slotIndex ?? 0, room.trafficSeed);
      setHud(makeInitialHud(vehicleId, bestScore));
      startDriving();
    },
  });

  // Persist garage selections locally
  useEffect(() => {
    try {
      const payload: SavedGaragePrefs = {
        vehicleId,
        paintHex,
        mods,
        playerName,
      };
      window.localStorage.setItem(GARAGE_PREFS_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }, [vehicleId, paintHex, mods, playerName]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768) {
        setShowTouchControls(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sync document.body.dataset.state immediately
  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const handleSelectVehicle = useCallback(
    (id: VehicleId) => {
      const nextPaint = VEHICLES[id].paints[0].hex;
      const nextMods = getDefaultModsForVehicle(id);
      setVehicleId(id);
      setPaintHex(nextPaint);
      setMods(nextMods);
      online.updateRoomCar({
        vehicleId: id,
        paintHex: nextPaint,
        mods: nextMods,
      });
    },
    [online],
  );

  const handleSelectPaint = useCallback(
    (hex: string) => {
      setPaintHex(hex);
      online.updateRoomCar({
        vehicleId,
        paintHex: hex,
        mods,
      });
    },
    [mods, online, vehicleId],
  );

  const handleUpdateMods = useCallback(
    (patch: Partial<VehicleMods>) => {
      setMods((prev) => {
        const next = { ...prev, ...patch };
        online.updateRoomCar({
          vehicleId,
          paintHex,
          mods: next,
        });
        return next;
      });
    },
    [online, paintHex, vehicleId],
  );

  const handleResetMods = useCallback(() => {
    const next = getDefaultModsForVehicle(vehicleId);
    setMods(next);
    online.updateRoomCar({
      vehicleId,
      paintHex,
      mods: next,
    });
  }, [online, paintHex, vehicleId]);

  const handleSelectAtmosphere = useCallback(
    (mode: AtmosphereMode) => {
      setAtmosphere(mode);
      if (online.room && online.isHost) {
        online.updateRoomCar({
          vehicleId,
          paintHex,
          mods,
          atmosphere: mode,
        });
      }
    },
    [mods, online, paintHex, vehicleId],
  );

  const handleHudUpdate = useCallback(
    (snapshot: HudSnapshot) => {
      setHud(snapshot);
      if (online.room) {
        setRemoteHudPlayers(Array.from(online.remotePlayersRef.current.values()));
      } else if (remoteHudPlayers.length > 0) {
        setRemoteHudPlayers([]);
      }
    },
    [online.remotePlayersRef, online.room, remoteHudPlayers.length],
  );

  const handleGameOver = useCallback(
    (snapshot: HudSnapshot) => {
      document.exitPointerLock?.();
      const updatedBest = Math.max(bestScore, snapshot.score);
      if (updatedBest > bestScore) {
        setBestScore(updatedBest);
        writeBestScore(updatedBest);
      }
      setFinalStats({ ...snapshot, bestScore: updatedBest });
      document.body.dataset.state = 'gameover';
      setPhase('gameover');
    },
    [bestScore],
  );

  const handlePrimaryStart = useCallback(() => {
    if (online.room) {
      if (online.isHost && !online.room.started) {
        online.startRoom();
        return;
      }
      const me = online.room.players.find((p) => p.id === online.playerId);
      actionRef.current?.resetRun(me?.slotIndex ?? 0, online.room.trafficSeed);
      setHud(makeInitialHud(vehicleId, bestScore));
      startDriving();
      return;
    }
    startDriving();
  }, [bestScore, online, startDriving, vehicleId]);

  const handleRestart = useCallback(() => {
    if (online.room) {
      const me = online.room.players.find((p) => p.id === online.playerId);
      actionRef.current?.resetRun(me?.slotIndex ?? 0, online.room.trafficSeed);
    } else {
      actionRef.current?.resetRun();
    }
    setHud(makeInitialHud(vehicleId, bestScore));
    startDriving();
  }, [bestScore, online.playerId, online.room, startDriving, vehicleId]);

  const handleBackToTitle = useCallback(() => {
    actionRef.current?.resetRun();
    setHud(makeInitialHud(vehicleId, bestScore));
    document.body.dataset.state = 'title';
    setPhase('title');
  }, [bestScore, vehicleId]);

  const handleHonk = useCallback(() => {
    actionRef.current?.honk();
    if (online.room) {
      online.sendHonk();
    }
  }, [online]);

  // Global keyboard shortcuts (ignore when typing in lobby inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        if (online.room && !online.isHost && !online.room.started) return;
        e.preventDefault();
        handlePrimaryStart();
      } else if (phase === 'playing' && (e.code === 'Escape' || e.code === 'KeyP')) {
        e.preventDefault();
        document.body.dataset.state = 'paused';
        setPhase('paused');
      } else if (phase === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) {
        e.preventDefault();
        document.body.dataset.state = 'playing';
        setPhase('playing');
      } else if (phase === 'playing' && e.code === 'KeyH') {
        if (online.room) online.sendHonk();
      } else if (e.code === 'KeyM') {
        setMuted((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePrimaryStart, online, phase]);

  const activeSpec = VEHICLES[vehicleId];
  const vehicleTitle = `${activeSpec.brand} ${activeSpec.model}`;
  const selfOnlinePlayer = online.room?.players.find(
    (p) => p.id === online.playerId,
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-zinc-950">
      <DrivingCanvas
        phase={phase}
        vehicleId={vehicleId}
        paintHex={paintHex}
        mods={mods}
        atmosphere={atmosphere}
        cameraMode={cameraMode}
        previewAngle={previewAngle}
        previewHeadlightsOn={previewHeadlightsOn}
        muted={muted}
        bestScore={bestScore}
        onlineRoomActive={Boolean(online.room)}
        onlineSpawnSlot={selfOnlinePlayer?.slotIndex ?? 0}
        onlineTrafficSeed={online.room?.trafficSeed ?? 1923}
        remotePlayersRef={online.remotePlayersRef}
        onSendTelemetry={online.sendTelemetry}
        onCameraModeChange={setCameraMode}
        onHudUpdate={handleHudUpdate}
        onGameOver={handleGameOver}
        actionRef={actionRef}
      />

      {phase === 'title' && (
        <TitleOverlay
          activeTab={garageTab}
          selectedVehicleId={vehicleId}
          selectedPaintHex={paintHex}
          mods={mods}
          atmosphere={atmosphere}
          previewAngle={previewAngle}
          previewHeadlightsOn={previewHeadlightsOn}
          bestScore={bestScore}
          playerName={playerName}
          joinCodeInput={joinCodeInput}
          onlineStatus={online.status}
          onlineError={online.errorMsg}
          onlineRoom={online.room}
          onlinePlayerId={online.playerId}
          isHost={online.isHost}
          onTabChange={setGarageTab}
          onSelectVehicle={handleSelectVehicle}
          onSelectPaint={handleSelectPaint}
          onUpdateMods={handleUpdateMods}
          onResetMods={handleResetMods}
          onSelectAtmosphere={handleSelectAtmosphere}
          onPreviewAngleChange={setPreviewAngle}
          onTogglePreviewHeadlights={() =>
            setPreviewHeadlightsOn((prev) => !prev)
          }
          onPlayerNameChange={setPlayerName}
          onJoinCodeInputChange={setJoinCodeInput}
          onCreateRoom={() =>
            online.createRoom({
              playerName,
              vehicleId,
              paintHex,
              mods,
              atmosphere,
            })
          }
          onJoinRoom={() =>
            online.joinRoom({
              roomCode: joinCodeInput,
              playerName,
              vehicleId,
              paintHex,
              mods,
            })
          }
          onLeaveRoom={online.leaveRoom}
          onStart={handlePrimaryStart}
        />
      )}

      {phase === 'playing' && (
        <GameHud
          hud={hud}
          vehicleTitle={vehicleTitle}
          muted={muted}
          showTouchControls={showTouchControls}
          onlineRoom={online.room}
          onlinePlayerId={online.playerId}
          remotePlayers={remoteHudPlayers}
          friendAlert={online.friendAlert}
          onToggleTouchControls={() => setShowTouchControls((s) => !s)}
          onTouchControl={(control, active) =>
            actionRef.current?.setTouchControl(control, active)
          }
          onCycleCamera={() => actionRef.current?.cycleCamera()}
          onToggleHeadlights={() => actionRef.current?.toggleHeadlights()}
          onFlashHeadlights={() => actionRef.current?.flashHeadlights()}
          onToggleLeftSignal={() => actionRef.current?.toggleLeftSignal()}
          onToggleRightSignal={() => actionRef.current?.toggleRightSignal()}
          onHonk={handleHonk}
          onToggleMute={() => setMuted((m) => !m)}
          onPause={() => setPhase('paused')}
        />
      )}

      {phase === 'paused' && (
        <PauseModal
          onResume={() => setPhase('playing')}
          onRestart={handleRestart}
          onBackToTitle={handleBackToTitle}
        />
      )}

      {phase === 'gameover' && finalStats && (
        <GameOverModal
          stats={finalStats}
          vehicleTitle={vehicleTitle}
          onRetry={handleRestart}
          onBackToTitle={handleBackToTitle}
        />
      )}
    </main>
  );
}
