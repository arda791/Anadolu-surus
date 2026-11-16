import { SHOULDER_LIMIT } from './vehicles';
import {
  HeadlightBeamMode,
  InputState,
  PlayerPhysicsState,
  TrafficVehicle,
  VehicleSpec,
} from './types';

export function cycleHeadlightMode(current: HeadlightBeamMode): HeadlightBeamMode {
  if (current === 'off') return 'low';
  if (current === 'low') return 'high';
  return 'off';
}

export function createInitialPlayerState(headlightsOn = false): PlayerPhysicsState {
  const headlightMode: HeadlightBeamMode = headlightsOn ? 'low' : 'off';
  return {
    x: 1.95, // Start cleanly in lane 2 (center-right), facing straight ahead (-Z)
    z: 0,
    speedMs: 0,
    lateralVel: 0,
    heading: 0,
    steerAngle: 0,
    wheelVisualSteer: 0,
    rpm: 900,
    gear: 1,
    pitch: 0,
    roll: 0,
    charmSwing: 0,
    charmSwingVel: 0,
    health: 100,
    distanceMeters: 0,
    score: 0,
    nearMissCount: 0,
    comboCount: 0,
    comboTimer: 0,
    maxSpeedReachedKmh: 0,
    hitstopTimer: 0,
    cameraTrauma: 0,
    headlightsOn,
    headlightMode,
    flasherTimer: 0,
    leftSignalOn: false,
    rightSignalOn: false,
    wipersOn: false,
    lastNearMissAt: -10,
    crashed: false,
  };
}

export function computeGearAndRpm(
  speedMs: number,
  spec: VehicleSpec,
): { gear: number; rpm: number; maxRpm: number } {
  const speedKmh = Math.abs(speedMs) * 3.6;

  if (spec.isElectric) {
    // Single-speed EV direct drive up to 14,000 RPM
    const ratio = Math.min(1, speedKmh / spec.maxSpeedKmh);
    const rpm = Math.round(800 + ratio * 12200);
    return { gear: speedMs < -0.5 ? -1 : 1, rpm, maxRpm: 14000 };
  }

  // 6-speed gearbox thresholds (km/h)
  const gearThresholds = [0, 34, 68, 106, 146, 185, 240];
  let gear = 1;
  for (let i = 1; i < gearThresholds.length; i++) {
    if (speedKmh >= gearThresholds[i]) {
      gear = Math.min(6, i + 1);
    }
  }

  const low = gearThresholds[gear - 1];
  const high = gearThresholds[gear];
  const span = Math.max(20, high - low);
  const frac = Math.max(0, Math.min(1, (speedKmh - low) / span));
  const rpm = Math.round(1150 + frac * 5350);
  return { gear, rpm, maxRpm: 7000 };
}

export interface PhysicsStepResult {
  collided: boolean;
  impactSeverity: number; // 0..1
  nearMissTriggered: boolean;
  nearMissLabel: string | null;
}

export function stepVehiclePhysics(
  state: PlayerPhysicsState,
  input: InputState,
  spec: VehicleSpec,
  traffic: TrafficVehicle[],
  dt: number,
  elapsedSec: number,
): PhysicsStepResult {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - clampedDt);
    state.cameraTrauma = Math.max(0, state.cameraTrauma - clampedDt * 1.4);
    return {
      collided: false,
      impactSeverity: 0,
      nearMissTriggered: false,
      nearMissLabel: null,
    };
  }

  const maxSpeedMs = spec.maxSpeedKmh / 3.6;

  // Steering input smoothing (-1 = left, +1 = right in lane coordinates where +X is right)
  let steerTarget = 0;
  if (input.left) steerTarget -= 1;
  if (input.right) steerTarget += 1;

  // Speed-sensitive steering authority so highway lane changes stay stable at 180 km/h
  const speedRatio = Math.min(1, Math.abs(state.speedMs) / 45);
  const steerAuthority = 1 - speedRatio * 0.42;
  const steerLerp = 1 - Math.exp(-spec.steeringResponse * 2.4 * clampedDt);
  state.steerAngle += (steerTarget * steerAuthority - state.steerAngle) * steerLerp;

  // Visual steering wheel turns up to ~400 degrees
  state.wheelVisualSteer +=
    (state.steerAngle * 2.2 - state.wheelVisualSteer) *
    (1 - Math.exp(-12 * clampedDt));

  // Longitudinal forces
  let longAccel = 0;
  if (input.throttle) {
    const torqueCurve = spec.isElectric
      ? 1.08 - 0.35 * Math.pow(state.speedMs / maxSpeedMs, 1.5)
      : 0.78 + 0.32 * Math.sin((state.rpm / 7000) * Math.PI);
    longAccel += spec.accelForce * Math.max(0.25, torqueCurve);
  }
  if (input.brake) {
    if (state.speedMs > 1.2) {
      longAccel -= spec.brakeForce;
    } else {
      // Gentle reverse capability capped at 28 km/h
      longAccel -= spec.accelForce * 0.42;
    }
  }
  if (input.handbrake) {
    longAccel -= Math.sign(state.speedMs) * spec.brakeForce * 0.72;
  }

  // Aerodynamic drag & rolling resistance
  const aeroDrag = 0.0024 * state.speedMs * Math.abs(state.speedMs);
  const rollingDrag = state.speedMs * 0.14;
  longAccel -= aeroDrag + rollingDrag;

  const prevSpeed = state.speedMs;
  state.speedMs = Math.max(
    -8,
    Math.min(maxSpeedMs, state.speedMs + longAccel * clampedDt),
  );
  if (!input.throttle && !input.brake && Math.abs(state.speedMs) < 0.25) {
    state.speedMs = 0;
  }

  // Bicycle-style yaw & lateral dynamics
  const effectiveSpeed = Math.abs(state.speedMs);
  const gripFactor = input.handbrake
    ? spec.lateralGrip * 0.45
    : spec.lateralGrip;
  const turnSign = state.speedMs >= -0.2 ? 1 : -1;
  const yawRate =
    state.steerAngle *
    turnSign *
    Math.min(1, effectiveSpeed / 6.5) *
    (1.18 - speedRatio * 0.45);

  // Heading points slightly into turn, then self-centers on straightaways
  const headingTarget = state.steerAngle * 0.24 * Math.min(1, effectiveSpeed / 10);
  state.heading +=
    (headingTarget - state.heading) * (1 - Math.exp(-gripFactor * clampedDt));
  // Add direct yaw kick
  state.heading = Math.max(
    -0.42,
    Math.min(0.42, state.heading + yawRate * clampedDt * 0.35),
  );

  // Move forward along -Z and laterally along X
  const forwardVx = Math.sin(state.heading) * state.speedMs;
  const forwardVz = -Math.cos(state.heading) * state.speedMs;
  const lateralSlide =
    state.steerAngle * Math.min(18, effectiveSpeed * 0.42) * turnSign;

  state.lateralVel +=
    (lateralSlide - state.lateralVel) *
    (1 - Math.exp(-gripFactor * clampedDt));

  state.x += (forwardVx + state.lateralVel * 0.55) * clampedDt;
  state.z += forwardVz * clampedDt;

  // Guardrail bounds & shoulder rumble
  const halfWidth = spec.bodyWidth * 0.5;
  const maxX = SHOULDER_LIMIT - halfWidth;
  let collided = false;
  let impactSeverity = 0;

  if (state.x < -maxX) {
    state.x = -maxX;
    if (state.lateralVel < -3) {
      impactSeverity = Math.min(0.5, Math.abs(state.lateralVel) / 16);
      collided = true;
    }
    state.lateralVel = Math.max(0, -state.lateralVel * 0.3);
    state.heading *= 0.4;
    state.speedMs *= 0.96;
  } else if (state.x > maxX) {
    state.x = maxX;
    if (state.lateralVel > 3) {
      impactSeverity = Math.min(0.5, Math.abs(state.lateralVel) / 16);
      collided = true;
    }
    state.lateralVel = Math.min(0, -state.lateralVel * 0.3);
    state.heading *= 0.4;
    state.speedMs *= 0.96;
  }

  // Distance & top speed tracking
  if (state.speedMs > 0) {
    state.distanceMeters += state.speedMs * clampedDt;
    const kmh = state.speedMs * 3.6;
    if (kmh > state.maxSpeedReachedKmh) {
      state.maxSpeedReachedKmh = kmh;
    }
    // High-speed highway cruising points (> 70 km/h)
    if (kmh > 70) {
      state.score += (kmh / 35) * clampedDt * 4;
    }
  }

  // Suspension pitch (dive under braking, squat under acceleration) & roll
  const rawLongAccel = (state.speedMs - prevSpeed) / clampedDt;
  const targetPitch = Math.max(-0.045, Math.min(0.045, -rawLongAccel * 0.0022));
  const targetRoll = Math.max(
    -0.065,
    Math.min(0.065, -state.steerAngle * Math.min(1, effectiveSpeed / 22) * 0.045),
  );
  state.pitch += (targetPitch - state.pitch) * (1 - Math.exp(-10 * clampedDt));
  state.roll += (targetRoll - state.roll) * (1 - Math.exp(-9 * clampedDt));

  // Hanging Nazar Boncugu pendulum physics on interior mirror
  const lateralG = -state.steerAngle * Math.min(1.2, effectiveSpeed / 25);
  const springAcc = -28 * state.charmSwing - 4.2 * state.charmSwingVel + lateralG * 9.5;
  state.charmSwingVel += springAcc * clampedDt;
  state.charmSwing = Math.max(
    -0.55,
    Math.min(0.55, state.charmSwing + state.charmSwingVel * clampedDt),
  );

  // RPM & Gear
  const drivetrain = computeGearAndRpm(state.speedMs, spec);
  state.gear = drivetrain.gear;
  state.rpm += (drivetrain.rpm - state.rpm) * (1 - Math.exp(-14 * clampedDt));

  // Combo decay
  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - clampedDt);
    if (state.comboTimer === 0) state.comboCount = 0;
  }

  // Camera trauma & headlight flasher (Selektör) decay
  state.cameraTrauma = Math.max(0, state.cameraTrauma - clampedDt * 1.5);
  if (state.flasherTimer > 0) {
    state.flasherTimer = Math.max(0, state.flasherTimer - clampedDt);
  }
  state.headlightsOn = state.headlightMode !== 'off';

  // Traffic collision & close-pass (Yakın Geçiş) checks
  let nearMissTriggered = false;
  let nearMissLabel: string | null = null;

  const pHalfW = spec.bodyWidth * 0.47;
  const pHalfL = spec.bodyLength * 0.47;

  for (const tv of traffic) {
    const tHalfW = tv.width * 0.47;
    const tHalfL = tv.length * 0.47;

    const dx = state.x - tv.x;
    const dz = state.z - tv.z;
    const overlapX = pHalfW + tHalfW - Math.abs(dx);
    const overlapZ = pHalfL + tHalfL - Math.abs(dz);

    if (overlapX > 0 && overlapZ > 0) {
      // Genuine collision!
      const relSpeed = Math.abs(state.speedMs - tv.speedMs);
      const sev = Math.max(0.2, Math.min(1.0, relSpeed / 28));
      collided = true;
      impactSeverity = Math.max(impactSeverity, sev);

      // Separate player cleanly outside the traffic car
      if (overlapX < overlapZ) {
        state.x += Math.sign(dx || 1) * (overlapX + 0.12);
        state.lateralVel = Math.sign(dx || 1) * 4.5;
      } else {
        state.z += Math.sign(dz || 1) * (overlapZ + 0.25);
        state.speedMs = Math.max(4, tv.speedMs * 0.65);
      }

      const damage = Math.round(12 + sev * 24);
      state.health = Math.max(0, state.health - damage);
      state.comboCount = 0;
      state.comboTimer = 0;
      state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.55 + sev * 0.45);
      state.hitstopTimer = 0.045;
      tv.passedNearMiss = true;

      if (state.health <= 0) {
        state.crashed = true;
      }
      break;
    }

    // Check close overtake (Yakın Geçiş) when passing alongside a traffic vehicle at >= 75 km/h
    const speedKmh = state.speedMs * 3.6;
    if (
      !tv.passedNearMiss &&
      speedKmh >= 75 &&
      Math.abs(dz) < pHalfL + tHalfL + 0.5 &&
      Math.abs(dx) < pHalfW + tHalfW + 1.35 &&
      state.z < tv.z + 1.0
    ) {
      tv.passedNearMiss = true;
      nearMissTriggered = true;
      state.nearMissCount += 1;
      state.comboCount = Math.min(10, state.comboCount + 1);
      state.comboTimer = 4.5;
      const bonus = 150 * state.comboCount;
      state.score += bonus;
      state.lastNearMissAt = elapsedSec;
      nearMissLabel =
        state.comboCount > 1
          ? `Yakın Geçiş x${state.comboCount} · +${bonus}`
          : `Yakın Geçiş · +${bonus}`;
    }
  }

  return {
    collided,
    impactSeverity,
    nearMissTriggered,
    nearMissLabel,
  };
}
