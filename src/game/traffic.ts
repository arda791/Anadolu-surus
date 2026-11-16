import { LANE_CENTERS, TRAFFIC_TEMPLATES } from './vehicles';
import { TrafficVehicle } from './types';

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createInitialTraffic(
  playerZ = 0,
  seed = 1923,
  count = 14,
): TrafficVehicle[] {
  const rand = seededRandom(seed);
  const vehicles: TrafficVehicle[] = [];

  for (let i = 0; i < count; i++) {
    const laneIndex = i % LANE_CENTERS.length;
    // Spread vehicles comfortably ahead (-38m to -380m) with clear sightline at spawn
    const zOffset = -42 - i * 24 - rand() * 10;
    // Keep spawn lane 2 completely clear for first 80m
    const safeZ = laneIndex === 2 && zOffset > -85 ? zOffset - 55 : zOffset;
    vehicles.push(buildTrafficVehicle(i + 1, laneIndex, playerZ + safeZ, rand));
  }

  return vehicles;
}

function buildTrafficVehicle(
  id: number,
  laneIndex: number,
  z: number,
  rand: () => number,
): TrafficVehicle {
  // Heavy vehicles (iett_bus, ptt_kargo) prefer right lanes 2 & 3
  let pool = TRAFFIC_TEMPLATES;
  if (laneIndex <= 1) {
    pool = TRAFFIC_TEMPLATES.filter((t) => t.kind !== 'iett_bus');
  }
  const tpl = pool[Math.floor(rand() * pool.length)];
  const laneSpeedFactor = laneIndex === 0 ? 1.12 : laneIndex === 1 ? 1.0 : laneIndex === 2 ? 0.92 : 0.84;
  const kmh =
    (tpl.minSpeedKmh + rand() * (tpl.maxSpeedKmh - tpl.minSpeedKmh)) *
    laneSpeedFactor;
  const speedMs = kmh / 3.6;

  return {
    id,
    kind: tpl.kind,
    label: tpl.label,
    plateText: tpl.plates[Math.floor(rand() * tpl.plates.length)],
    laneIndex,
    x: LANE_CENTERS[laneIndex],
    z,
    speedMs,
    targetSpeedMs: speedMs,
    length: tpl.length,
    width: tpl.width,
    height: tpl.height,
    colorHex: tpl.colors[Math.floor(rand() * tpl.colors.length)],
    braking: false,
    passedNearMiss: false,
  };
}

export function stepTraffic(
  traffic: TrafficVehicle[],
  playerZ: number,
  dt: number,
  seedCounter = 1,
): void {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  const rand = seededRandom(Math.floor(Math.abs(playerZ)) * 31 + seedCounter);

  // First pass: check spacing inside each lane so traffic cars brake smoothly behind slower cars
  for (let i = 0; i < traffic.length; i++) {
    const car = traffic[i];
    let minGap = 999;
    let aheadSpeed = car.targetSpeedMs;

    for (let j = 0; j < traffic.length; j++) {
      if (i === j) continue;
      const other = traffic[j];
      if (other.laneIndex !== car.laneIndex) continue;
      // Since -Z is forward, other is ahead if other.z < car.z
      const gap = car.z - other.z - (car.length + other.length) * 0.5;
      if (gap > -1 && gap < minGap) {
        minGap = gap;
        aheadSpeed = other.speedMs;
      }
    }

    let desired = car.targetSpeedMs;
    car.braking = false;
    if (minGap < 24) {
      desired = Math.min(desired, Math.max(8, aheadSpeed * 0.92));
      car.braking = car.speedMs > desired + 1.2;
    }

    const accelRate = car.braking ? 6.5 : 2.2;
    car.speedMs += (desired - car.speedMs) * (1 - Math.exp(-accelRate * clampedDt));
    car.z -= car.speedMs * clampedDt;

    // Recycle cars that fell more than 45m behind the player or drifted > 420m ahead
    if (car.z > playerZ + 45 || car.z < playerZ - 420) {
      const newLane = Math.floor(rand() * LANE_CENTERS.length);
      let spawnZ = playerZ - 240 - rand() * 140;

      // Ensure safe 26m gap from any car already in that lane
      let attempts = 0;
      while (attempts < 6) {
        const conflict = traffic.some(
          (other) =>
            other.id !== car.id &&
            other.laneIndex === newLane &&
            Math.abs(other.z - spawnZ) < 26,
        );
        if (!conflict) break;
        spawnZ -= 28;
        attempts++;
      }

      const fresh = buildTrafficVehicle(car.id, newLane, spawnZ, rand);
      car.kind = fresh.kind;
      car.label = fresh.label;
      car.plateText = fresh.plateText;
      car.laneIndex = fresh.laneIndex;
      car.x = fresh.x;
      car.z = fresh.z;
      car.speedMs = fresh.speedMs;
      car.targetSpeedMs = fresh.targetSpeedMs;
      car.length = fresh.length;
      car.width = fresh.width;
      car.height = fresh.height;
      car.colorHex = fresh.colorHex;
      car.braking = false;
      car.passedNearMiss = false;
    }
  }
}
