import * as THREE from 'three';
import { AtmosphereMode } from '../game/types';
import { ROAD_HALF_WIDTH } from '../game/vehicles';
import {
  createAsphaltTextures,
  createHighwaySignTexture,
  createTurkishFlagTexture,
} from './textures';

export const CHUNK_LENGTH = 160;
export const CHUNK_COUNT = 6;

interface WorldChunk {
  group: THREE.Group;
  zStart: number;
  flagMesh?: THREE.Mesh;
  ferryMesh?: THREE.Group;
}

export interface TurkishWorldHandle {
  update: (playerZ: number, elapsedSec: number) => void;
  setAtmosphere: (mode: AtmosphereMode, scene: THREE.Scene) => void;
  dispose: () => void;
}

function buildMosqueLandmark(): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xe7e2d8,
    roughness: 0.78,
  });
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x5d6770,
    roughness: 0.42,
    metalness: 0.45,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.25,
    metalness: 0.85,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 16), stoneMat);
  base.position.y = 4;
  g.add(base);

  const mainDome = new THREE.Mesh(
    new THREE.SphereGeometry(6.8, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    domeMat,
  );
  mainDome.position.y = 8;
  g.add(mainDome);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 8), goldMat);
  finial.position.y = 15.4;
  g.add(finial);

  // Twin slender minarets
  for (const mz of [-7.5, 7.5]) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.95, 22, 12),
      stoneMat,
    );
    shaft.position.set(7.5, 11, mz);
    g.add(shaft);

    const balcony = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.0, 0.7, 12),
      stoneMat,
    );
    balcony.position.set(7.5, 16.5, mz);
    g.add(balcony);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.75, 4.5, 12), domeMat);
    spire.position.set(7.5, 24.2, mz);
    g.add(spire);
  }

  return g;
}

function buildIstanbulFerry(): THREE.Group {
  const ferry = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 34), darkMat);
  hull.position.y = 1.1;
  ferry.add(hull);

  const deck1 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.6, 26), whiteMat);
  deck1.position.y = 3.8;
  ferry.add(deck1);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(7.35, 0.6, 26.2), greenMat);
  stripe.position.y = 2.8;
  ferry.add(stripe);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.2, 12), whiteMat);
  bridge.position.set(0, 6.0, -2);
  ferry.add(bridge);

  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.5, 10), greenMat);
  funnel.position.set(0, 7.6, 2);
  ferry.add(funnel);

  return ferry;
}

function buildSuspensionBridge(
  flagTex: THREE.CanvasTexture,
  beaconMat: THREE.MeshStandardMaterial,
): { bridge: THREE.Group; flagMesh: THREE.Mesh } {
  const bridge = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.35,
    metalness: 0.65,
  });
  const redAccentMat = new THREE.MeshStandardMaterial({
    color: 0xc81e1e,
    roughness: 0.4,
    metalness: 0.4,
  });

  const towerX = 12.2;
  const towerH = 44;

  // Twin bridge pylons + crossbeams
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, towerH, 3.4),
      steelMat,
    );
    leg.position.set(side * towerX, towerH * 0.5, 0);
    leg.castShadow = true;
    bridge.add(leg);

    const redCap = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 3.2, 3.7),
      redAccentMat,
    );
    redCap.position.set(side * towerX, towerH - 1.5, 0);
    bridge.add(redCap);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 10, 10),
      beaconMat,
    );
    beacon.position.set(side * towerX, towerH + 0.9, 0);
    bridge.add(beacon);
  }

  for (const yBeam of [15, 29, 41]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(towerX * 2 + 2.2, 2.1, 2.6),
      steelMat,
    );
    beam.position.set(0, yBeam, 0);
    bridge.add(beam);
  }

  // Main catenary suspension cables sloping cleanly down from tower peak to deck anchorages
  for (const side of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = -10; i <= 10; i++) {
      const z = i * 7.5;
      const t = Math.abs(i) / 10;
      // Peak at tower (t=0 -> y=42.5), sloping down cleanly to deck anchor at t=1 -> y=2.5
      const y = 2.5 + 40.0 * Math.pow(1 - t, 1.45);
      pts.push(new THREE.Vector3(side * towerX, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const cableGeo = new THREE.TubeGeometry(curve, 24, 0.34, 6, false);
    const cable = new THREE.Mesh(cableGeo, redAccentMat);
    bridge.add(cable);

    // Vertical suspender cables
    for (let i = -8; i <= 8; i += 2) {
      if (i === 0) continue;
      const z = i * 7.5;
      const t = Math.abs(i) / 10;
      const topY = 2.5 + 40.0 * Math.pow(1 - t, 1.45);
      const len = Math.max(0.5, topY - 1.0);
      const hanger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, len, 6),
        steelMat,
      );
      hanger.position.set(side * towerX, 1.0 + len * 0.5, z);
      bridge.add(hanger);
    }
  }

  // Proud Turkish Flag waving on right bridge approach pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 22, 8),
    steelMat,
  );
  pole.position.set(10.8, 11, 18);
  bridge.add(pole);

  const flagMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 4.8, 8, 4),
    new THREE.MeshStandardMaterial({
      map: flagTex,
      side: THREE.DoubleSide,
      roughness: 0.65,
    }),
  );
  flagMesh.position.set(14.4, 19.3, 18);
  bridge.add(flagMesh);

  return { bridge, flagMesh };
}

function buildOverheadGantry(
  signTex: THREE.CanvasTexture,
  isHgs = false,
): THREE.Group {
  const g = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.38,
    metalness: 0.78,
  });

  const postX = ROAD_HALF_WIDTH + 1.4;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 7.6, 10),
      steelMat,
    );
    post.position.set(side * postX, 3.8, 0);
    g.add(post);
  }

  const truss = new THREE.Mesh(
    new THREE.BoxGeometry(postX * 2 + 0.8, 0.55, 0.55),
    steelMat,
  );
  truss.position.set(0, 7.4, 0);
  g.add(truss);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(isHgs ? 15.2 : 11.4, isHgs ? 3.2 : 3.6, 0.25),
    [
      steelMat,
      steelMat,
      steelMat,
      steelMat,
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 }),
      steelMat,
    ],
  );
  signBoard.position.set(0, 6.4, 0.32);
  g.add(signBoard);

  return g;
}

function buildFuelStation(signTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
  });
  const brandRed = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.35,
  });
  const brandAmber = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.35,
  });

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.2, 26),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }),
  );
  pad.position.y = 0.1;
  g.add(pad);

  for (const pz of [-7, 7]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.2, 0.9), brandRed);
    col.position.set(0, 2.7, pz);
    g.add(col);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(11, 1.1, 20), canopyMat);
  roof.position.y = 5.6;
  g.add(roof);

  const fascia = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.5, 20.2), brandAmber);
  fascia.position.y = 5.9;
  g.add(fascia);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 2.6),
    new THREE.MeshBasicMaterial({ map: signTex }),
  );
  sign.position.set(-5.65, 5.7, 0);
  sign.rotation.y = -Math.PI / 2;
  g.add(sign);

  return g;
}

export function createTurkishWorld(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): TurkishWorldHandle {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const worldRoot = new THREE.Group();
  scene.add(worldRoot);

  // Studio environment reflections (RoomEnvironment)
  const asphalt = createAsphaltTextures(maxAniso);
  asphalt.map.repeat.set(1, 5);

  const roadMat = new THREE.MeshStandardMaterial({
    map: asphalt.map,
    bumpMap: asphalt.bumpMap,
    bumpScale: 0.03,
    roughness: 0.82,
    metalness: 0.05,
  });

  const guardrailMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.38,
    metalness: 0.72,
  });

  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x4e6642,
    roughness: 0.92,
    metalness: 0.02,
  });

  const seaMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f4c6c,
    roughness: 0.14,
    metalness: 0.35,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.86,
  });

  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.35,
  });

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.1,
  });

  const flagTex = createTurkishFlagTexture(maxAniso);
  const signOtoyolTex = createHighwaySignTexture(
    'O-4 ANADOLU OTOYOLU',
    ['ANKARA · İZMİT · BOLU', 'KADIKÖY · ATAŞEHİR'],
    'otoyol',
    maxAniso,
  );
  const signSehirTex = createHighwaySignTexture(
    'D-100 İSTANBUL',
    ['15 TEMMUZ ŞEHİTLER KÖPRÜSÜ', 'BEŞİKTAŞ · TAKSİM'],
    'sehir',
    maxAniso,
  );
  const signHgsTex = createHighwaySignTexture(
    'OTOYOL GEÇİŞ',
    ['SERBEST GEÇİŞ · 120 KM/S', 'TÜM ŞERİTLER AÇIK'],
    'hgs',
    maxAniso,
  );
  const signTesisTex = createHighwaySignTexture(
    'ANADOLU DİNLENME TESİSİ',
    ['AKARYAKIT · MARKET', 'KAHVE & MOLA'],
    'tesis',
    maxAniso,
  );

  // Lighting rig: Warm Key Light + Cool Sky/Ground HemisphereLight (<= 1 shadow caster)
  const hemiLight = new THREE.HemisphereLight(0x9bd0ff, 0x5c5346, 0.85);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sunLight.position.set(42, 65, 28);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -45;
  sunLight.shadow.camera.right = 45;
  sunLight.shadow.camera.top = 45;
  sunLight.shadow.camera.bottom = -45;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
  rimLight.position.set(-35, 24, -45);
  scene.add(rimLight);

  // Distant Sea & Terrain Ground Plane that tracks playerZ so horizon never ends
  const vastSea = new THREE.Mesh(new THREE.PlaneGeometry(900, 1200), seaMat);
  vastSea.rotation.x = -Math.PI / 2;
  vastSea.position.set(240, -1.2, -320);
  worldRoot.add(vastSea);

  const vastHills = new THREE.Mesh(new THREE.PlaneGeometry(700, 1200), hillMat);
  vastHills.rotation.x = -Math.PI / 2;
  vastHills.position.set(-280, -0.4, -320);
  worldRoot.add(vastHills);

  // Build 6 cycling highway chunks
  const chunks: WorldChunk[] = [];
  const disposableTex: THREE.Texture[] = [
    asphalt.map,
    asphalt.bumpMap,
    flagTex,
    signOtoyolTex,
    signSehirTex,
    signHgsTex,
    signTesisTex,
  ];

  // Shared tree geometry for InstancedMesh per chunk
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 3.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.9 });
  const crownGeo = new THREE.ConeGeometry(1.45, 7.2, 7);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2d5a36, roughness: 0.88 });

  const buildingMat = new THREE.MeshStandardMaterial({ color: 0xd6d3cd, roughness: 0.82 });
  const roofTileMat = new THREE.MeshStandardMaterial({ color: 0x9c422c, roughness: 0.78 });

  for (let idx = 0; idx < CHUNK_COUNT; idx++) {
    const group = new THREE.Group();
    // Place chunk 5 immediately behind spawn (+160..0) so chase & title cameras always sit over paved highway
    const zStart = idx === CHUNK_COUNT - 1 ? CHUNK_LENGTH : -idx * CHUNK_LENGTH;
    group.position.z = zStart;

    // 1. Road Asphalt Surface (offset cleanly above base terrain)
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2 + 2.2, CHUNK_LENGTH),
      roadMat,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.0, -CHUNK_LENGTH * 0.5);
    road.receiveShadow = true;
    group.add(road);

    // 2. Left & Right Guardrails + Coastal Seawall
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.52, CHUNK_LENGTH),
        guardrailMat,
      );
      rail.position.set(side * (ROAD_HALF_WIDTH + 1.15), 0.58, -CHUNK_LENGTH * 0.5);
      rail.castShadow = true;
      group.add(rail);

      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.25, CHUNK_LENGTH),
        concreteMat,
      );
      kerb.position.set(side * (ROAD_HALF_WIDTH + 1.5), 0.12, -CHUNK_LENGTH * 0.5);
      group.add(kerb);
    }

    // Coastal promenade on right side overlooking the Bosphorus
    const seawall = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 1.4, CHUNK_LENGTH),
      concreteMat,
    );
    seawall.position.set(ROAD_HALF_WIDTH + 4.0, -0.5, -CHUNK_LENGTH * 0.5);
    group.add(seawall);

    // Left grassy embankment
    const embankment = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.6, CHUNK_LENGTH),
      hillMat,
    );
    embankment.position.set(-(ROAD_HALF_WIDTH + 15.5), -0.25, -CHUNK_LENGTH * 0.5);
    group.add(embankment);

    // 3. Highway Streetlamps every 32m along median/shoulders
    for (let lz = -16; lz > -CHUNK_LENGTH; lz -= 32) {
      for (const side of [-1, 1]) {
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.16, 7.5, 8),
          guardrailMat,
        );
        mast.position.set(side * (ROAD_HALF_WIDTH + 1.7), 3.75, lz);
        group.add(mast);

        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.12, 0.14),
          guardrailMat,
        );
        arm.position.set(side * (ROAD_HALF_WIDTH + 0.7), 7.45, lz);
        group.add(arm);

        const bulb = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.14, 0.28),
          lampGlowMat,
        );
        bulb.position.set(side * (ROAD_HALF_WIDTH - 0.1), 7.36, lz);
        group.add(bulb);
      }
    }

    // 4. Instanced Mediterranean Cypress Trees on Left Hills (24 trees/chunk)
    const treeCount = 24;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let t = 0; t < treeCount; t++) {
      const tx = -(ROAD_HALF_WIDTH + 5 + ((t * 17) % 34));
      const tz = -(t * (CHUNK_LENGTH / treeCount)) - 3;
      const s = 0.85 + ((t * 7) % 10) * 0.035;
      dummy.position.set(tx, 1.5 * s, tz);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      trunks.setMatrixAt(t, dummy.matrix);

      dummy.position.set(tx, 5.2 * s, tz);
      dummy.updateMatrix();
      crowns.setMatrixAt(t, dummy.matrix);

      color.setHSL(0.32 + ((t % 5) - 2) * 0.015, 0.35, 0.24 + (t % 3) * 0.04);
      crowns.setColorAt(t, color);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    group.add(trunks, crowns);

    // 5. Turkish Residential Apartments with Terracotta Roofs on Left Ridge
    for (let b = 0; b < 3; b++) {
      const bz = -28 - b * 50;
      const bw = 11 + (b % 2) * 3;
      const bh = 12 + ((idx + b) % 3) * 5;
      const bx = -(ROAD_HALF_WIDTH + 22 + (b % 2) * 8);

      const block = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 14),
        buildingMat,
      );
      block.position.set(bx, bh * 0.5, bz);
      group.add(block);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(bw * 0.78, 3.2, 4),
        roofTileMat,
      );
      roof.position.set(bx, bh + 1.6, bz);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
    }

    // 6. Signature Turkish Landmarks per Chunk
    const chunkObj: WorldChunk = { group, zStart };

    if (idx === 0) {
      // Initial Spawn Vista: KGM Otoyol Sign at -52m + Iconic Bosphorus Suspension Bridge at -120m!
      const gantry = buildOverheadGantry(signOtoyolTex, false);
      gantry.position.z = -52;
      group.add(gantry);

      const { bridge, flagMesh } = buildSuspensionBridge(flagTex, beaconMat);
      bridge.position.z = -125;
      group.add(bridge);
      chunkObj.flagMesh = flagMesh;

      const ferry = buildIstanbulFerry();
      ferry.position.set(58, 0, -90);
      group.add(ferry);
      chunkObj.ferryMesh = ferry;
    } else if (idx === 1) {
      // Mosque landmark overlooking highway on left hill
      const mosque = buildMosqueLandmark();
      mosque.position.set(-(ROAD_HALF_WIDTH + 28), 0, -75);
      mosque.rotation.y = Math.PI / 2;
      group.add(mosque);
    } else if (idx === 2) {
      // HGS Toll Plaza Gantry
      const hgs = buildOverheadGantry(signHgsTex, true);
      hgs.position.z = -80;
      group.add(hgs);
    } else if (idx === 3) {
      // Istanbul City Sign + Ferry
      const citySign = buildOverheadGantry(signSehirTex, false);
      citySign.position.z = -65;
      group.add(citySign);

      const ferry = buildIstanbulFerry();
      ferry.position.set(72, 0, -100);
      ferry.rotation.y = Math.PI;
      group.add(ferry);
      chunkObj.ferryMesh = ferry;
    } else if (idx === 4) {
      // Dinlenme Tesisi (Roadside Fuel Station on left pull-off)
      const station = buildFuelStation(signTesisTex);
      station.position.set(-(ROAD_HALF_WIDTH + 9.5), 0, -80);
      group.add(station);
    } else if (idx === 5) {
      const gantry = buildOverheadGantry(signOtoyolTex, false);
      gantry.position.z = -90;
      group.add(gantry);
    }

    worldRoot.add(group);
    chunks.push(chunkObj);
  }

  function setAtmosphere(mode: AtmosphereMode, targetScene: THREE.Scene): void {
    if (mode === 'afternoon') {
      const sky = new THREE.Color(0x9bc7ec);
      targetScene.background = sky;
      targetScene.fog = new THREE.FogExp2(0x9bc7ec, 0.0026);
      sunLight.color.setHex(0xfff4dd);
      sunLight.intensity = 2.25;
      sunLight.position.set(42, 65, 28);
      hemiLight.color.setHex(0x9bd0ff);
      hemiLight.groundColor.setHex(0x5c5346);
      hemiLight.intensity = 0.88;
      lampGlowMat.emissiveIntensity = 0.15;
    } else if (mode === 'sunset') {
      const sky = new THREE.Color(0xd9875c);
      targetScene.background = sky;
      targetScene.fog = new THREE.FogExp2(0xd9875c, 0.0031);
      sunLight.color.setHex(0xffa96b);
      sunLight.intensity = 2.1;
      sunLight.position.set(60, 22, -25);
      hemiLight.color.setHex(0xfdba74);
      hemiLight.groundColor.setHex(0x3a2b35);
      hemiLight.intensity = 0.72;
      lampGlowMat.emissiveIntensity = 1.2;
    } else {
      const sky = new THREE.Color(0x0b1528);
      targetScene.background = sky;
      targetScene.fog = new THREE.FogExp2(0x0b1528, 0.0034);
      sunLight.color.setHex(0x93c5fd);
      sunLight.intensity = 0.65;
      sunLight.position.set(-25, 45, 20);
      hemiLight.color.setHex(0x334155);
      hemiLight.groundColor.setHex(0x0f172a);
      hemiLight.intensity = 0.52;
      lampGlowMat.emissiveIntensity = 2.4;
    }
  }

  setAtmosphere('afternoon', scene);

  function update(playerZ: number, elapsedSec: number): void {
    // Keep vast sea, hills, and shadow frustum centered around playerZ
    vastSea.position.z = playerZ - 260;
    vastHills.position.z = playerZ - 260;
    sunLight.position.z = playerZ + 28;
    sunLight.target.position.set(0, 0, playerZ - 20);

    const totalCycle = CHUNK_LENGTH * CHUNK_COUNT;
    for (const chunk of chunks) {
      // Recycle chunk forward once its rear edge passes > 1 chunk behind player
      if (chunk.zStart - CHUNK_LENGTH > playerZ + CHUNK_LENGTH) {
        chunk.zStart -= totalCycle;
        chunk.group.position.z = chunk.zStart;
      } else if (chunk.zStart < playerZ - totalCycle + CHUNK_LENGTH) {
        chunk.zStart += totalCycle;
        chunk.group.position.z = chunk.zStart;
      }

      if (chunk.flagMesh) {
        chunk.flagMesh.rotation.y = Math.sin(elapsedSec * 3.1) * 0.14;
      }
      if (chunk.ferryMesh) {
        chunk.ferryMesh.position.y = Math.sin(elapsedSec * 1.4) * 0.18;
      }
    }
  }

  function dispose(): void {
    disposableTex.forEach((t) => t.dispose());
    worldRoot.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    scene.remove(worldRoot);
  }

  return { update, setAtmosphere, dispose };
}
