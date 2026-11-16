import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DrivingAudioEngine } from '../game/audio';
import {
  getOnlineSpawnPosition,
  OnlinePlayerTelemetry,
  RoomPlayerSnapshot,
} from '../game/multiplayer';
import {
  createInitialPlayerState,
  cycleHeadlightMode,
  stepVehiclePhysics,
} from '../game/physics';
import { createInitialTraffic, stepTraffic } from '../game/traffic';
import {
  AtmosphereMode,
  CameraMode,
  GamePhase,
  HudSnapshot,
  InputState,
  TitlePreviewAngle,
  TrafficVehicle,
  VehicleId,
  VehicleMods,
} from '../game/types';
import {
  applyVehicleMods,
  getMilestoneForKm,
  VEHICLES,
} from '../game/vehicles';
import {
  buildPlayerCarRig,
  buildTrafficCarRig,
  createDriverNameSprite,
  PlayerCarRig,
  TrafficCarRig,
} from './carModels';
import { createContactShadowTexture } from './textures';
import { createTurkishWorld } from './turkishWorld';

export interface DrivingActionHandle {
  cycleCamera: () => void;
  toggleHeadlights: () => void;
  flashHeadlights: () => void;
  toggleLeftSignal: () => void;
  toggleRightSignal: () => void;
  honk: () => void;
  resetRun: (spawnSlot?: number, trafficSeed?: number) => void;
  setTouchControl: (control: keyof InputState, active: boolean) => void;
}

interface DrivingCanvasProps {
  phase: GamePhase;
  vehicleId: VehicleId;
  paintHex: string;
  mods: VehicleMods;
  atmosphere: AtmosphereMode;
  cameraMode: CameraMode;
  previewAngle: TitlePreviewAngle;
  previewHeadlightsOn: boolean;
  muted: boolean;
  bestScore: number;
  onlineRoomActive: boolean;
  onlineSpawnSlot: number;
  onlineTrafficSeed: number;
  remotePlayersRef: React.MutableRefObject<Map<string, RoomPlayerSnapshot>>;
  onSendTelemetry?: (telemetry: OnlinePlayerTelemetry) => void;
  onCameraModeChange: (mode: CameraMode) => void;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onGameOver: (finalSnapshot: HudSnapshot) => void;
  actionRef: React.MutableRefObject<DrivingActionHandle | null>;
}

// Pre-allocated math helpers outside render loop (zero GC)
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _localEye = new THREE.Vector3();
const _localLook = new THREE.Vector3();

interface RemoteCarEntry {
  rig: PlayerCarRig;
  nameSprite: { sprite: THREE.Sprite; dispose: () => void };
  signature: string;
  x: number;
  z: number;
  heading: number;
  wheelSpin: number;
}

export function DrivingCanvas({
  phase,
  vehicleId,
  paintHex,
  mods,
  atmosphere,
  cameraMode,
  previewAngle,
  previewHeadlightsOn,
  muted,
  bestScore,
  onlineRoomActive,
  onlineSpawnSlot,
  onlineTrafficSeed,
  remotePlayersRef,
  onSendTelemetry,
  onCameraModeChange,
  onHudUpdate,
  onGameOver,
  actionRef,
}: DrivingCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Sync latest React props into refs so WebGLRenderer mounts once and never tears down
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const vehicleIdRef = useRef(vehicleId);
  vehicleIdRef.current = vehicleId;
  const paintHexRef = useRef(paintHex);
  paintHexRef.current = paintHex;
  const modsRef = useRef(mods);
  modsRef.current = mods;
  const atmosphereRef = useRef(atmosphere);
  atmosphereRef.current = atmosphere;
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  const previewAngleRef = useRef(previewAngle);
  previewAngleRef.current = previewAngle;
  const previewHeadlightsRef = useRef(previewHeadlightsOn);
  previewHeadlightsRef.current = previewHeadlightsOn;
  const bestScoreRef = useRef(bestScore);
  bestScoreRef.current = bestScore;
  const onlineActiveRef = useRef(onlineRoomActive);
  onlineActiveRef.current = onlineRoomActive;
  const onlineSpawnSlotRef = useRef(onlineSpawnSlot);
  onlineSpawnSlotRef.current = onlineSpawnSlot;
  const onlineSeedRef = useRef(onlineTrafficSeed);
  onlineSeedRef.current = onlineTrafficSeed;
  const remotePlayersPropRef = remotePlayersRef;

  const callbacksRef = useRef({
    onCameraModeChange,
    onHudUpdate,
    onGameOver,
    onSendTelemetry,
  });
  callbacksRef.current = {
    onCameraModeChange,
    onHudUpdate,
    onGameOver,
    onSendTelemetry,
  };

  const audioRef = useRef<DrivingAudioEngine | null>(null);
  const rebuildVehicleRef = useRef<(() => void) | null>(null);
  const resetRunRef = useRef<((spawnSlot?: number, trafficSeed?: number) => void) | null>(null);
  const applyAtmoRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    audioRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    rebuildVehicleRef.current?.();
  }, [vehicleId, paintHex, mods]);

  useEffect(() => {
    applyAtmoRef.current?.();
  }, [atmosphere]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Software WebGL guard (read renderer string only for rendering cost)
    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      64,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.08,
      750,
    );

    // Mandatory studio environment map for metallic car paint & glass reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmrem.dispose();

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const contactShadowTex = createContactShadowTexture();
    const world = createTurkishWorld(scene, renderer, isSoftwareGl);

    const audio = new DrivingAudioEngine();
    audio.setMuted(muted);
    audioRef.current = audio;

    // Mutable Simulation State
    let playerState = createInitialPlayerState(atmosphereRef.current === 'night');
    let traffic: TrafficVehicle[] = createInitialTraffic(0, onlineSeedRef.current || 1923, 14);
    let playerRig: PlayerCarRig | null = null;
    const trafficRigs = new Map<number, TrafficCarRig>();
    const remoteRigs = new Map<string, RemoteCarEntry>();

    let nearMissToast: string | null = null;
    let nearMissToastTimer = 0;
    let wheelSpinAngle = 0;
    let lookYaw = 0;
    let lookYawTarget = 0;
    let titleOrbitYaw = 0;
    let pointerDragging = false;
    let lastPointerX = 0;
    let prevPhase: GamePhase = phaseRef.current;
    let prevCamMode: CameraMode = cameraModeRef.current;
    let titleCameraSnapped = false;

    const keyInput: InputState = {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      handbrake: false,
    };

    const touchInput: InputState = {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      handbrake: false,
    };

    const input: InputState = {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      handbrake: false,
    };

    function spawnPlayerRig(): void {
      if (playerRig) {
        scene.remove(playerRig.root);
        playerRig.dispose();
      }
      const spec = VEHICLES[vehicleIdRef.current];
      playerRig = buildPlayerCarRig(
        spec,
        paintHexRef.current,
        modsRef.current,
        contactShadowTex,
        maxAniso,
        isSoftwareGl,
        false,
      );
      scene.add(playerRig.root);
      audio.setElectricMode(spec.isElectric);
    }

    function syncTrafficRigs(): void {
      const activeIds = new Set(traffic.map((t) => t.id));
      for (const [id, rig] of trafficRigs.entries()) {
        if (!activeIds.has(id)) {
          scene.remove(rig.root);
          trafficRigs.delete(id);
        }
      }
      for (const tv of traffic) {
        let rig = trafficRigs.get(tv.id);
        if (!rig || rig.root.userData.kind !== tv.kind || rig.root.userData.color !== tv.colorHex) {
          if (rig) scene.remove(rig.root);
          rig = buildTrafficCarRig(tv, contactShadowTex, maxAniso);
          rig.root.userData.kind = tv.kind;
          rig.root.userData.color = tv.colorHex;
          scene.add(rig.root);
          trafficRigs.set(tv.id, rig);
        }
        rig.root.position.set(tv.x, 0, tv.z);
        rig.brakeLightMat.emissiveIntensity = tv.braking ? 2.2 : 0.45;
        rig.headlightMat.emissiveIntensity =
          atmosphereRef.current === 'night'
            ? 2.2
            : atmosphereRef.current === 'sunset'
              ? 1.4
              : 0.45;
      }
    }

    function clearRemoteRigs(): void {
      for (const entry of remoteRigs.values()) {
        scene.remove(entry.rig.root);
        entry.nameSprite.dispose();
        entry.rig.dispose();
      }
      remoteRigs.clear();
    }

    function resetRun(spawnSlot?: number, trafficSeed?: number): void {
      playerState = createInitialPlayerState(atmosphereRef.current === 'night');
      if (onlineActiveRef.current) {
        const slot = typeof spawnSlot === 'number' ? spawnSlot : onlineSpawnSlotRef.current;
        const pos = getOnlineSpawnPosition(slot);
        playerState.x = pos.x;
        playerState.z = pos.z;
      }
      const seed =
        typeof trafficSeed === 'number'
          ? trafficSeed
          : onlineActiveRef.current
            ? onlineSeedRef.current
            : 1923 + Math.floor(Math.random() * 500);
      traffic = createInitialTraffic(0, seed, 14);
      nearMissToast = null;
      nearMissToastTimer = 0;
      lookYaw = 0;
      lookYawTarget = 0;
      keyInput.throttle = false;
      keyInput.brake = false;
      keyInput.left = false;
      keyInput.right = false;
      keyInput.handbrake = false;
      touchInput.throttle = false;
      touchInput.brake = false;
      touchInput.left = false;
      touchInput.right = false;
      touchInput.handbrake = false;
      input.throttle = false;
      input.brake = false;
      input.left = false;
      input.right = false;
      input.handbrake = false;
      syncTrafficRigs();
    }

    spawnPlayerRig();
    syncTrafficRigs();

    rebuildVehicleRef.current = spawnPlayerRig;
    resetRunRef.current = resetRun;
    applyAtmoRef.current = () => {
      world.setAtmosphere(atmosphereRef.current, scene);
      const nightOn = atmosphereRef.current === 'night';
      playerState.headlightMode = nightOn ? 'low' : 'off';
      playerState.headlightsOn = nightOn;
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const cycleCamera = () => {
      const order: CameraMode[] = ['cockpit', 'hood', 'chase'];
      const next = order[(order.indexOf(cameraModeRef.current) + 1) % order.length];
      cameraModeRef.current = next;
      callbacksRef.current.onCameraModeChange(next);
    };

    actionRef.current = {
      cycleCamera,
      toggleHeadlights: () => {
        playerState.headlightMode = cycleHeadlightMode(playerState.headlightMode);
        playerState.headlightsOn = playerState.headlightMode !== 'off';
      },
      flashHeadlights: () => {
        playerState.flasherTimer = 0.28;
      },
      toggleLeftSignal: () => {
        playerState.leftSignalOn = !playerState.leftSignalOn;
        if (playerState.leftSignalOn) playerState.rightSignalOn = false;
      },
      toggleRightSignal: () => {
        playerState.rightSignalOn = !playerState.rightSignalOn;
        if (playerState.rightSignalOn) playerState.leftSignalOn = false;
      },
      honk: () => {
        audio.playHorn();
      },
      resetRun,
      setTouchControl: (control, active) => {
        if (active && phaseRef.current === 'playing') {
          audio.init();
        }
        touchInput[control] = active;
      },
    };

    // Keyboard & Pointer Listeners on Window
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (phaseRef.current !== 'playing') return;

      if (code === 'KeyW' || code === 'ArrowUp') {
        keyInput.throttle = true;
        audio.init();
      } else if (code === 'KeyS' || code === 'ArrowDown') {
        keyInput.brake = true;
        audio.init();
      } else if (code === 'KeyA' || code === 'ArrowLeft') {
        keyInput.left = true;
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        keyInput.right = true;
      } else if (code === 'Space') {
        e.preventDefault();
        keyInput.handbrake = true;
      } else if (code === 'KeyC' && !e.repeat) {
        cycleCamera();
      } else if (code === 'KeyL' && !e.repeat) {
        playerState.headlightMode = cycleHeadlightMode(playerState.headlightMode);
        playerState.headlightsOn = playerState.headlightMode !== 'off';
      } else if (code === 'KeyF' && !e.repeat) {
        playerState.flasherTimer = 0.28;
      } else if (code === 'KeyZ' && !e.repeat) {
        playerState.leftSignalOn = !playerState.leftSignalOn;
        if (playerState.leftSignalOn) playerState.rightSignalOn = false;
      } else if (code === 'KeyX' && !e.repeat) {
        playerState.rightSignalOn = !playerState.rightSignalOn;
        if (playerState.rightSignalOn) playerState.leftSignalOn = false;
      } else if (code === 'KeyH' && !e.repeat) {
        audio.playHorn();
      } else if (code === 'KeyQ') {
        lookYawTarget = 0.65;
      } else if (code === 'KeyE') {
        lookYawTarget = -0.65;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keyInput.throttle = false;
      else if (code === 'KeyS' || code === 'ArrowDown') keyInput.brake = false;
      else if (code === 'KeyA' || code === 'ArrowLeft') keyInput.left = false;
      else if (code === 'KeyD' || code === 'ArrowRight') keyInput.right = false;
      else if (code === 'Space') keyInput.handbrake = false;
      else if (code === 'KeyQ' || code === 'KeyE') lookYawTarget = 0;
    };

    const clearInputs = () => {
      keyInput.throttle = false;
      keyInput.brake = false;
      keyInput.left = false;
      keyInput.right = false;
      keyInput.handbrake = false;
      touchInput.throttle = false;
      touchInput.brake = false;
      touchInput.left = false;
      touchInput.right = false;
      touchInput.handbrake = false;
      input.throttle = false;
      input.brake = false;
      input.left = false;
      input.right = false;
      input.handbrake = false;
      lookYawTarget = 0;
      pointerDragging = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (phaseRef.current !== 'playing' && phaseRef.current !== 'title') return;
      if (phaseRef.current === 'playing') audio.init();
      pointerDragging = true;
      lastPointerX = e.clientX;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDragging) return;
      const dx = e.clientX - lastPointerX;
      lastPointerX = e.clientX;
      if (phaseRef.current === 'playing') {
        lookYawTarget = Math.max(-0.85, Math.min(0.85, lookYawTarget - dx * 0.0045));
      } else if (phaseRef.current === 'title') {
        titleOrbitYaw = Math.max(-1.4, Math.min(1.4, titleOrbitYaw - dx * 0.006));
      }
    };

    const onPointerUp = () => {
      pointerDragging = false;
      lookYawTarget = 0;
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, entry.contentRect.width);
      const h = Math.max(1, entry.contentRect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // Loop State & Pacing
    const clock = new THREE.Clock();
    let hudEmitTimer = 0;
    let netEmitTimer = 0;
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function buildHudSnapshot(): HudSnapshot {
      const spec = applyVehicleMods(VEHICLES[vehicleIdRef.current], modsRef.current);
      const distKm = playerState.distanceMeters / 1000;
      const roundedScore = Math.round(playerState.score);
      return {
        speedKmh: Math.round(Math.abs(playerState.speedMs) * 3.6),
        rpm: Math.round(playerState.rpm),
        maxRpm: spec.isElectric ? 14000 : 7000,
        gear: playerState.gear,
        health: Math.round(playerState.health),
        distanceKm: Number(distKm.toFixed(2)),
        score: roundedScore,
        bestScore: Math.max(bestScoreRef.current, roundedScore),
        nearMissCount: playerState.nearMissCount,
        comboCount: playerState.comboCount,
        maxSpeedKmh: Math.round(playerState.maxSpeedReachedKmh),
        cameraMode: cameraModeRef.current,
        headlightsOn: playerState.headlightMode !== 'off',
        headlightMode: playerState.headlightMode,
        leftSignalOn: playerState.leftSignalOn,
        rightSignalOn: playerState.rightSignalOn,
        nearMissFlash: nearMissToastTimer > 0 ? nearMissToast : null,
        milestoneName: getMilestoneForKm(distKm),
        isElectric: spec.isElectric,
      };
    }

    function syncRemoteFriendRigs(dt: number, elapsed: number): void {
      if (!onlineActiveRef.current) {
        if (remoteRigs.size > 0) clearRemoteRigs();
        return;
      }

      const remoteMap = remotePlayersPropRef.current;
      for (const [id, entry] of remoteRigs.entries()) {
        if (!remoteMap.has(id)) {
          scene.remove(entry.rig.root);
          entry.nameSprite.dispose();
          entry.rig.dispose();
          remoteRigs.delete(id);
        }
      }

      const blinkOn = Math.floor(elapsed * 2.4) % 2 === 0;
      const isNight = atmosphereRef.current === 'night';
      const isSunset = atmosphereRef.current === 'sunset';

      for (const [id, rp] of remoteMap.entries()) {
        const sig = `${rp.vehicleId}|${rp.paintHex}|${rp.name}|${JSON.stringify(rp.mods)}`;
        let entry = remoteRigs.get(id);
        if (!entry || entry.signature !== sig) {
          if (entry) {
            scene.remove(entry.rig.root);
            entry.nameSprite.dispose();
            entry.rig.dispose();
          }
          const rSpec = VEHICLES[rp.vehicleId];
          const rig = buildPlayerCarRig(
            rSpec,
            rp.paintHex,
            rp.mods,
            contactShadowTex,
            maxAniso,
            isSoftwareGl,
            true,
          );
          const nameSprite = createDriverNameSprite(rp.name, maxAniso);
          nameSprite.sprite.position.set(0, rSpec.bodyHeight + 0.72, 0);
          rig.root.add(nameSprite.sprite);
          scene.add(rig.root);
          entry = {
            rig,
            nameSprite,
            signature: sig,
            x: rp.x,
            z: rp.z,
            heading: rp.heading,
            wheelSpin: 0,
          };
          remoteRigs.set(id, entry);
        }

        // Smooth interpolation + forward velocity prediction
        const damp = 1 - Math.exp(-14 * dt);
        const predictedZ = rp.z - Math.cos(rp.heading) * rp.speedMs * Math.min(dt, 0.05);
        entry.x += (rp.x - entry.x) * damp;
        entry.z += (predictedZ - entry.z) * damp;
        entry.heading += (rp.heading - entry.heading) * damp;

        entry.rig.root.position.set(entry.x, 0, entry.z);
        entry.rig.root.rotation.y = -entry.heading;
        entry.rig.chassisGroup.position.y = entry.rig.rideHeightOffset;

        entry.wheelSpin -= rp.speedMs * dt * 2.9;
        for (const wg of entry.rig.wheels) {
          wg.rotation.x = entry.wheelSpin;
        }
        for (const fp of entry.rig.frontWheelPivots) {
          fp.rotation.y = -rp.steerAngle * 0.35;
        }

        const activeBeam = rp.flasherActive ? 'high' : rp.headlightMode;
        const beamOn = activeBeam !== 'off';
        const isHigh = activeBeam === 'high';
        const hlEmissive = isHigh ? 3.2 : beamOn ? 2.1 : 0.45;
        entry.rig.headlightMats.forEach((m) => (m.emissiveIntensity = hlEmissive));
        entry.rig.drlMats.forEach((m) => (m.emissiveIntensity = beamOn ? 2.1 : 1.35));
        entry.rig.fogLightMats.forEach(
          (m) => (m.emissiveIntensity = beamOn && rp.mods.frontLip === 'sport_lip' ? 2.2 : beamOn ? 1.1 : 0.25),
        );
        entry.rig.headlightThrowMat.opacity = beamOn
          ? (isHigh ? 0.55 : 0.36) * (isNight ? 1.0 : isSunset ? 0.65 : 0.32)
          : 0;
        entry.rig.beamConeMats.forEach((m) => {
          m.opacity = beamOn ? (isHigh ? 0.11 : 0.06) : 0;
        });

        entry.rig.brakeLightMats.forEach(
          (m) => (m.emissiveIntensity = rp.braking ? 2.5 : beamOn ? 0.9 : 0.35),
        );
        entry.rig.leftSignalMats.forEach(
          (m) => (m.emissiveIntensity = rp.leftSignalOn && blinkOn ? 2.4 : 0),
        );
        entry.rig.rightSignalMats.forEach(
          (m) => (m.emissiveIntensity = rp.rightSignalOn && blinkOn ? 2.4 : 0),
        );
      }
    }

    function tick() {
      if (disposed) return;

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.elapsedTime;
      const curPhase = phaseRef.current;

      // Clear inputs & reset on transition into playing from title or gameover
      if (curPhase === 'playing' && (prevPhase === 'title' || prevPhase === 'gameover')) {
        if (prevPhase === 'gameover') {
          resetRun();
        } else if (prevPhase === 'title' && onlineActiveRef.current) {
          resetRun(onlineSpawnSlotRef.current, onlineSeedRef.current);
        }
        audio.init();
      }
      if (curPhase !== 'playing' && prevPhase === 'playing') {
        clearInputs();
        audio.silence();
      }
      if (curPhase !== 'title') {
        titleCameraSnapped = false;
      }
      prevPhase = curPhase;

      const baseSpec = VEHICLES[vehicleIdRef.current];
      const spec = applyVehicleMods(baseSpec, modsRef.current);

      if (curPhase === 'playing') {
        input.throttle = keyInput.throttle || touchInput.throttle;
        input.brake = keyInput.brake || touchInput.brake;
        input.left = keyInput.left || touchInput.left;
        input.right = keyInput.right || touchInput.right;
        input.handbrake = keyInput.handbrake || touchInput.handbrake;

        const stepRes = stepVehiclePhysics(
          playerState,
          input,
          spec,
          traffic,
          dt,
          elapsed,
        );

        stepTraffic(traffic, playerState.z, dt, Math.floor(elapsed * 10));
        syncTrafficRigs();

        if (stepRes.collided) {
          audio.playCollision(stepRes.impactSeverity);
        }
        if (stepRes.nearMissTriggered && stepRes.nearMissLabel) {
          nearMissToast = stepRes.nearMissLabel;
          nearMissToastTimer = 2.0;
          audio.playNearMiss();
        }
        if (nearMissToastTimer > 0) {
          nearMissToastTimer = Math.max(0, nearMissToastTimer - dt);
        }

        const slip = Math.abs(playerState.steerAngle) * Math.min(1, Math.abs(playerState.speedMs) / 28) + (input.handbrake && playerState.speedMs > 6 ? 0.5 : 0);
        audio.update(
          playerState.rpm,
          playerState.speedMs,
          input.throttle,
          slip,
          playerState.leftSignalOn || playerState.rightSignalOn,
          dt,
          true,
        );

        if (onlineActiveRef.current && callbacksRef.current.onSendTelemetry) {
          netEmitTimer += dt;
          if (netEmitTimer >= 0.05) {
            netEmitTimer = 0;
            callbacksRef.current.onSendTelemetry({
              x: playerState.x,
              z: playerState.z,
              speedMs: playerState.speedMs,
              heading: playerState.heading,
              steerAngle: playerState.steerAngle,
              headlightMode: playerState.headlightMode,
              flasherActive: playerState.flasherTimer > 0,
              leftSignalOn: playerState.leftSignalOn,
              rightSignalOn: playerState.rightSignalOn,
              braking: input.brake || input.handbrake,
              score: Math.round(playerState.score),
              distanceMeters: playerState.distanceMeters,
              health: Math.round(playerState.health),
              crashed: playerState.crashed,
            });
          }
        }

        if (playerState.crashed) {
          audio.silence();
          callbacksRef.current.onGameOver(buildHudSnapshot());
        }
      } else if (curPhase === 'title') {
        // Live world cruising traffic on Title Screen
        stepTraffic(traffic, 0, dt, Math.floor(elapsed * 5));
        syncTrafficRigs();
      }

      // Sync remote online friends' 3D vehicles
      syncRemoteFriendRigs(dt, elapsed);

      // Update Turkish Highway Chunks
      world.update(playerState.z, elapsed);

      // Update Player 3D Rig
      if (playerRig) {
        playerRig.root.position.set(playerState.x, 0, playerState.z);
        playerRig.root.rotation.y = -playerState.heading;
        playerRig.chassisGroup.position.y = playerRig.rideHeightOffset;
        playerRig.chassisGroup.rotation.x = playerState.pitch;
        playerRig.chassisGroup.rotation.z = playerState.roll;

        // Steering wheel rotation (counter-clockwise for left turn)
        playerRig.steeringWheel.rotation.z = -playerState.wheelVisualSteer;
        // Swinging Nazar Boncugu charm
        playerRig.charmPivot.rotation.z = playerState.charmSwing;

        // Wheel spin & front wheel turn angle
        wheelSpinAngle -= playerState.speedMs * dt * 2.9;
        for (const wg of playerRig.wheels) {
          wg.rotation.x = wheelSpinAngle;
        }
        for (const fp of playerRig.frontWheelPivots) {
          fp.rotation.y = -playerState.steerAngle * 0.35;
        }

        const inCockpit = curPhase === 'playing' && cameraModeRef.current === 'cockpit';

        // Detailed Headlights, DRLs, Fog Lights, Beams & Signals
        const blinkOn = Math.floor(elapsed * 2.4) % 2 === 0;
        const activeBeam =
          curPhase === 'title'
            ? previewHeadlightsRef.current
              ? 'high'
              : 'off'
            : playerState.flasherTimer > 0
              ? 'high'
              : playerState.headlightMode;
        const isHigh = activeBeam === 'high';
        const isLow = activeBeam === 'low';
        const isOn = activeBeam !== 'off';

        const isNight = atmosphereRef.current === 'night';
        const isSunset = atmosphereRef.current === 'sunset';
        const atmoBeamFactor = isNight ? 1.0 : isSunset ? 0.68 : 0.36;

        const hlIntensity = isHigh ? 3.2 : isLow ? 2.2 : 0.45;
        playerRig.headlightMats.forEach((m) => (m.emissiveIntensity = hlIntensity));
        playerRig.drlMats.forEach((m) => (m.emissiveIntensity = isOn ? 2.2 : 1.4));
        playerRig.fogLightMats.forEach(
          (m) =>
            (m.emissiveIntensity =
              isOn && modsRef.current.frontLip === 'sport_lip'
                ? 2.4
                : isOn
                  ? 1.15
                  : modsRef.current.frontLip === 'sport_lip'
                    ? 0.9
                    : 0.25),
        );

        const spotInt = isHigh ? 92 : isLow ? 52 : 0;
        const spotDist = isHigh ? 135 : 90;
        const spotAngle = isHigh ? Math.PI / 4.0 : Math.PI / 4.8;
        playerRig.headlightSpotLeft.intensity = spotInt;
        playerRig.headlightSpotRight.intensity = spotInt;
        playerRig.headlightSpotLeft.distance = spotDist;
        playerRig.headlightSpotRight.distance = spotDist;
        playerRig.headlightSpotLeft.angle = spotAngle;
        playerRig.headlightSpotRight.angle = spotAngle;

        playerRig.headlightThrowMat.opacity = isOn
          ? (isHigh ? 0.64 : 0.42) * atmoBeamFactor
          : 0;
        playerRig.headlightThrowMesh.scale.set(isHigh ? 1.18 : 1.0, isHigh ? 1.35 : 1.0, 1);

        playerRig.beamConeMats.forEach((m) => {
          m.opacity = !inCockpit && isOn ? (isHigh ? 0.14 : 0.075) * atmoBeamFactor : 0;
        });

        const brakeIntensity =
          input.brake || input.handbrake ? 2.5 : isOn ? 0.85 : 0.35;
        playerRig.brakeLightMats.forEach((m) => (m.emissiveIntensity = brakeIntensity));

        playerRig.leftSignalMats.forEach(
          (m) => (m.emissiveIntensity = playerState.leftSignalOn && blinkOn ? 2.4 : 0),
        );
        playerRig.rightSignalMats.forEach(
          (m) => (m.emissiveIntensity = playerState.rightSignalOn && blinkOn ? 2.4 : 0),
        );

        // Live 3D Cockpit Gauge Cluster CanvasTexture update
        const speedKmh = Math.abs(playerState.speedMs) * 3.6;
        playerRig.displays.updateCluster(
          speedKmh,
          playerState.rpm,
          playerState.gear,
          playerState.leftSignalOn,
          playerState.rightSignalOn,
          isOn,
          isHigh,
          elapsed,
        );

        // Hide exterior ceiling cap only while inside cockpit so windshield/pillars stay clean
        playerRig.exteriorRoofGroup.visible = !inCockpit;
      }

      // Spin traffic wheels & flash police lightbars
      for (const tv of traffic) {
        const rig = trafficRigs.get(tv.id);
        if (!rig) continue;
        for (const w of rig.wheels) {
          w.rotation.x -= tv.speedMs * dt * 2.6;
        }
        if (rig.policeRedMat && rig.policeBlueMat) {
          const phaseFlash = Math.floor(elapsed * 6) % 2 === 0;
          rig.policeRedMat.emissiveIntensity = phaseFlash ? 2.6 : 0.15;
          rig.policeBlueMat.emissiveIntensity = phaseFlash ? 0.15 : 2.6;
        }
      }

      // Camera Choreography
      if (curPhase === 'title') {
        const frontMode = previewAngleRef.current === 'front';
        const sway = Math.sin(elapsed * 0.25) * 0.08;
        if (frontMode) {
          // Hero 3/4 front-right view showcasing full car, headlights, DRLs, fog lights, front lip & rims
          const orbitAngle = 0.62 + sway + titleOrbitYaw;
          const radius = 7.7;
          _camPos.set(
            playerState.x + Math.sin(orbitAngle) * radius,
            1.66 + Math.sin(elapsed * 0.38) * 0.08,
            playerState.z - Math.cos(orbitAngle) * radius,
          );
          _camTarget.set(playerState.x - 2.15, 0.84, playerState.z - 0.15);
        } else {
          // Hero 3/4 rear-right view framing spoiler, taillights & Bosphorus bridge behind
          const orbitAngle = 0.50 + sway + titleOrbitYaw;
          const radius = 7.4;
          _camPos.set(
            playerState.x + Math.sin(orbitAngle) * radius,
            1.84 + Math.sin(elapsed * 0.38) * 0.10,
            playerState.z + Math.cos(orbitAngle) * radius,
          );
          _camTarget.set(playerState.x - 2.35, 0.98, playerState.z - 2.2);
        }
        if (!titleCameraSnapped) {
          camera.position.copy(_camPos);
          titleCameraSnapped = true;
        } else {
          camera.position.lerp(_camPos, 1 - Math.exp(-7 * dt));
        }
        camera.lookAt(_camTarget);
        camera.fov = 54;
        camera.updateProjectionMatrix();
        prevCamMode = cameraModeRef.current;
      } else {
        const camMode = cameraModeRef.current;
        const camSwitched = camMode !== prevCamMode;
        prevCamMode = camMode;
        const isSuv = spec.id === 'togg_t10x';
        lookYaw += (lookYawTarget - lookYaw) * (1 - Math.exp(-10 * dt));

        // Trauma shake
        const shake = playerState.cameraTrauma * playerState.cameraTrauma;
        const shakeX = shake * Math.sin(elapsed * 53) * 0.09;
        const shakeY = shake * Math.cos(elapsed * 61) * 0.07;

        const speedKmh = Math.abs(playerState.speedMs) * 3.6;

        if (camMode === 'cockpit') {
          const eyeY = (isSuv ? 1.24 : 1.13) + playerState.pitch * 0.2;
          _localEye.set(-0.34, eyeY, 0.09);
          _localEye.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -playerState.heading);
          _camPos.set(
            playerState.x + _localEye.x + shakeX,
            _localEye.y + shakeY,
            playerState.z + _localEye.z,
          );

          const lookDist = 18;
          const totalYaw = -playerState.heading + lookYaw;
          _localLook.set(
            -Math.sin(totalYaw) * lookDist,
            -1.65 - playerState.pitch * 3.2,
            -Math.cos(totalYaw) * lookDist,
          );
          _camTarget.set(
            _camPos.x + _localLook.x,
            _camPos.y + _localLook.y,
            _camPos.z + _localLook.z,
          );

          camera.position.copy(_camPos);
          camera.lookAt(_camTarget);
          camera.rotation.z += playerState.roll * 0.45;
          const targetFov = 66 + Math.min(10, (speedKmh / 200) * 10);
          camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-6 * dt));
          camera.updateProjectionMatrix();
        } else if (camMode === 'hood') {
          const hoodY = isSuv ? 1.18 : 1.07;
          _localEye.set(0, hoodY, -1.05);
          _localEye.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -playerState.heading);
          camera.position.set(
            playerState.x + _localEye.x + shakeX,
            hoodY + shakeY,
            playerState.z + _localEye.z,
          );

          _localLook.set(
            Math.sin(playerState.heading) * 22,
            hoodY - 0.65,
            -Math.cos(playerState.heading) * 22,
          );
          camera.lookAt(
            camera.position.x + _localLook.x,
            _localLook.y,
            camera.position.z + _localLook.z,
          );
          const targetFov = 68 + Math.min(12, (speedKmh / 200) * 12);
          camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-6 * dt));
          camera.updateProjectionMatrix();
        } else {
          // Third-Person Chase Camera (snap on mode switch, then smoothly damp)
          _localEye.set(
            -Math.sin(playerState.heading) * 6.0,
            2.35,
            Math.cos(playerState.heading) * 6.0,
          );
          _camPos.set(
            playerState.x + _localEye.x + shakeX,
            _localEye.y + shakeY,
            playerState.z + _localEye.z,
          );
          if (camSwitched) {
            camera.position.copy(_camPos);
          } else {
            camera.position.lerp(_camPos, 1 - Math.exp(-9 * dt));
          }
          _camTarget.set(
            playerState.x + Math.sin(playerState.heading) * 5,
            1.15,
            playerState.z - Math.cos(playerState.heading) * 5,
          );
          camera.lookAt(_camTarget);
          const targetFov = 62 + Math.min(12, (speedKmh / 200) * 12);
          camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-6 * dt));
          camera.updateProjectionMatrix();
        }
      }

      renderer.render(scene, camera);

      // Throttled HUD update (<= 10Hz) when playing
      if (curPhase === 'playing') {
        hudEmitTimer += dt;
        if (hudEmitTimer >= 0.1) {
          hudEmitTimer = 0;
          callbacksRef.current.onHudUpdate(buildHudSnapshot());
        }
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      audio.dispose();
      if (playerRig) playerRig.dispose();
      clearRemoteRigs();
      contactShadowTex.dispose();
      world.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="driving-canvas-container"
      className="absolute inset-0 w-full h-full"
    />
  );
}
