import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGearAndRpm,
  createInitialPlayerState,
  stepVehiclePhysics,
} from './physics';
import { createInitialTraffic, stepTraffic } from './traffic';
import { VEHICLES } from './vehicles';
import { InputState, TrafficVehicle } from './types';

const idleInput: InputState = {
  throttle: false,
  brake: false,
  left: false,
  right: false,
  handbrake: false,
};

test('vehicle starts stationary on open lane and survives idle frames cleanly', () => {
  const player = createInitialPlayerState();
  const traffic = createInitialTraffic(0, 1923, 12);

  for (let i = 0; i < 120; i++) {
    const res = stepVehiclePhysics(
      player,
      idleInput,
      VEHICLES.togg_t10x,
      traffic,
      0.016,
      i * 0.016,
    );
    assert.equal(res.collided, false);
  }

  assert.equal(player.health, 100);
  assert.equal(player.crashed, false);
});

test('Togg T10X accelerates briskly, tracks distance, and respects top speed', () => {
  const player = createInitialPlayerState();
  const throttleInput: InputState = { ...idleInput, throttle: true };

  for (let i = 0; i < 400; i++) {
    stepVehiclePhysics(
      player,
      throttleInput,
      VEHICLES.togg_t10x,
      [],
      0.03,
      i * 0.03,
    );
  }

  const speedKmh = player.speedMs * 3.6;
  assert.ok(speedKmh > 170, `Expected high speed, got ${speedKmh}`);
  assert.ok(
    speedKmh <= VEHICLES.togg_t10x.maxSpeedKmh + 1,
    `Exceeded max speed: ${speedKmh}`,
  );
  assert.ok(player.distanceMeters > 400);
});

test('ICE cars shift gears cleanly through 6-speed gearbox', () => {
  const g1 = computeGearAndRpm(20 / 3.6, VEHICLES.fiat_egea);
  const g3 = computeGearAndRpm(90 / 3.6, VEHICLES.fiat_egea);
  const g6 = computeGearAndRpm(195 / 3.6, VEHICLES.fiat_egea);

  assert.equal(g1.gear, 1);
  assert.equal(g3.gear, 3);
  assert.equal(g6.gear, 6);
  assert.ok(g3.rpm >= 1150 && g3.rpm <= 7000);
});

test('steering moves player laterally and swings hanging Nazar Boncugu charm', () => {
  const player = createInitialPlayerState();
  const steerRight: InputState = { ...idleInput, throttle: true, right: true };
  const startX = player.x;

  for (let i = 0; i < 60; i++) {
    stepVehiclePhysics(
      player,
      steerRight,
      VEHICLES.tofas_sahin,
      [],
      0.02,
      i * 0.02,
    );
  }

  assert.ok(player.x > startX + 1.0, 'Expected vehicle to steer right (+X)');
  assert.ok(
    Math.abs(player.wheelVisualSteer) > 0.3,
    'Expected steering wheel rotation',
  );
  assert.ok(
    Math.abs(player.charmSwing) > 0.01,
    'Expected mirror Nazar Boncugu charm to react to lateral G',
  );
});

test('collision reduces health and near-miss awards bonus score', () => {
  const player = createInitialPlayerState();
  player.speedMs = 30; // 108 km/h
  player.x = 1.95;
  player.z = -10;

  const sideCar: TrafficVehicle = {
    id: 99,
    kind: 'istanbul_taxi',
    label: 'İstanbul Sarı Taksi',
    plateText: '34 TJK 48',
    laneIndex: 1,
    x: 4.15, // 2.2m lateral offset -> parallel close pass without overlapping!
    z: -10.5,
    speedMs: 20,
    targetSpeedMs: 20,
    length: 4.45,
    width: 1.78,
    height: 1.48,
    colorHex: '#f5b800',
    braking: false,
    passedNearMiss: false,
  };

  const passRes = stepVehiclePhysics(
    player,
    idleInput,
    VEHICLES.renault_megane,
    [sideCar],
    0.02,
    1.0,
  );
  assert.equal(passRes.collided, false);
  assert.equal(passRes.nearMissTriggered, true);
  assert.equal(player.nearMissCount, 1);
  assert.ok(player.score >= 150);

  // Now force overlap collision
  sideCar.x = player.x + 0.3;
  sideCar.z = player.z;
  const hitRes = stepVehiclePhysics(
    player,
    idleInput,
    VEHICLES.renault_megane,
    [sideCar],
    0.02,
    1.1,
  );
  assert.equal(hitRes.collided, true);
  assert.ok(player.health < 100);
});

test('traffic vehicles advance forward and maintain safe spacing in initial spawn', () => {
  const traffic = createInitialTraffic(0, 1923, 14);
  const startZs = traffic.map((t) => t.z);

  // Verify no spawn sits closer than 40m to player start (0, 0)
  for (const tv of traffic) {
    assert.ok(tv.z <= -40, `Traffic spawned too close: ${tv.z}`);
  }

  for (let i = 0; i < 60; i++) {
    stepTraffic(traffic, -10, 0.03, i + 1);
  }

  for (let i = 0; i < traffic.length; i++) {
    assert.ok(traffic[i].z < startZs[i], 'Expected traffic to drive forward (-Z)');
  }
});

import { cycleHeadlightMode } from './physics';
import { applyVehicleMods, getDefaultModsForVehicle } from './vehicles';

test('vehicle modification tuning increases power, top speed, and grip cleanly', () => {
  const base = VEHICLES.tofas_sahin;
  const mods = getDefaultModsForVehicle('tofas_sahin');
  const stage2Mods = {
    ...mods,
    tuningStage: 'stage2' as const,
    suspension: 'lowered' as const,
  };

  const tuned = applyVehicleMods(base, stage2Mods);
  assert.ok(tuned.horsePower > base.horsePower);
  assert.ok(tuned.maxSpeedKmh >= base.maxSpeedKmh + 20);
  assert.ok(tuned.accelForce > base.accelForce);
  assert.ok(tuned.lateralGrip > base.lateralGrip);
  // Base spec remains immutable
  assert.equal(base.horsePower, 82);

  // Verify tuned car reaches higher top speed than stock
  const stockPlayer = createInitialPlayerState();
  const tunedPlayer = createInitialPlayerState();
  const throttleInput: InputState = { ...idleInput, throttle: true };

  for (let i = 0; i < 320; i++) {
    stepVehiclePhysics(stockPlayer, throttleInput, base, [], 0.03, i * 0.03);
    stepVehiclePhysics(tunedPlayer, throttleInput, tuned, [], 0.03, i * 0.03);
  }
  assert.ok(
    tunedPlayer.speedMs > stockPlayer.speedMs + 4,
    'Expected Stage 2 tuned Sahin to clearly out-accelerate and outrun stock',
  );
});

test('headlight mode cycles off -> low -> high -> off and flasher timer decays', () => {
  assert.equal(cycleHeadlightMode('off'), 'low');
  assert.equal(cycleHeadlightMode('low'), 'high');
  assert.equal(cycleHeadlightMode('high'), 'off');

  const player = createInitialPlayerState(false);
  assert.equal(player.headlightMode, 'off');
  player.flasherTimer = 0.25;

  for (let i = 0; i < 15; i++) {
    stepVehiclePhysics(player, idleInput, VEHICLES.fiat_egea, [], 0.03, i * 0.03);
  }
  assert.equal(player.flasherTimer, 0);
});

import {
  generateRoomCode,
  getOnlineSpawnPosition,
  normalizeRoomCode,
  sanitizePlayerName,
} from './multiplayer';

test('online room helpers normalize codes, sanitize names, and assign separate lanes', () => {
  const code = generateRoomCode(() => 0.1);
  assert.equal(code.length, 5);
  assert.equal(normalizeRoomCode(' ist-42 '), 'IST42');
  assert.equal(sanitizePlayerName('   '), 'Sürücü');
  assert.equal(sanitizePlayerName('  Ahmet   Kaya '), 'Ahmet Kaya');

  const p0 = getOnlineSpawnPosition(0);
  const p1 = getOnlineSpawnPosition(1);
  assert.notEqual(p0.x, p1.x, 'First two friends must spawn in distinct lanes');
  assert.equal(p0.z, 0);
  assert.equal(p1.z, 0);
});


