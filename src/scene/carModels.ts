import * as THREE from 'three';
import { RimStyle, TrafficVehicle, VehicleMods, VehicleSpec } from '../game/types';
import { getHeadlightPreset } from '../game/vehicles';
import {
  CockpitDisplayController,
  createHeadlightThrowTexture,
  createPlateTexture,
} from './textures';

export interface PlayerCarRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  exteriorRoofGroup: THREE.Group;
  interiorGroup: THREE.Group;
  steeringWheel: THREE.Group;
  charmPivot: THREE.Group;
  wheels: THREE.Group[];
  frontWheelPivots: THREE.Group[];
  brakeLightMats: THREE.MeshStandardMaterial[];
  headlightMats: THREE.MeshStandardMaterial[];
  drlMats: THREE.MeshStandardMaterial[];
  fogLightMats: THREE.MeshStandardMaterial[];
  leftSignalMats: THREE.MeshStandardMaterial[];
  rightSignalMats: THREE.MeshStandardMaterial[];
  headlightSpotLeft: THREE.SpotLight;
  headlightSpotRight: THREE.SpotLight;
  headlightThrowMesh: THREE.Mesh;
  headlightThrowMat: THREE.MeshBasicMaterial;
  beamCones: THREE.Mesh[];
  beamConeMats: THREE.MeshBasicMaterial[];
  rideHeightOffset: number;
  displays: CockpitDisplayController;
  dispose: () => void;
}

export interface TrafficCarRig {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  brakeLightMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  policeRedMat?: THREE.MeshStandardMaterial;
  policeBlueMat?: THREE.MeshStandardMaterial;
}

function makeWheelGroup(
  radius: number,
  width: number,
  isClassic: boolean,
  rimStyle: RimStyle,
): THREE.Group {
  const g = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18191c,
    roughness: 0.85,
    metalness: 0.05,
  });

  const rimColor =
    rimStyle === 'sport_black'
      ? 0x181b20
      : rimStyle === 'bbs_gold'
        ? 0xd4a024
        : rimStyle === 'aero_ev'
          ? 0x334155
          : isClassic
            ? 0xd4d4d8
            : 0xcbd5e1;

  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    roughness: rimStyle === 'sport_black' ? 0.34 : 0.22,
    metalness: rimStyle === 'sport_black' ? 0.65 : 0.88,
  });

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 24),
    tireMat,
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.63, radius * 0.63, width + 0.015, 20),
    rimMat,
  );
  rim.rotation.z = Math.PI / 2;
  g.add(rim);

  // Outer chrome barrel ring for BBS Gold or Aero EV
  if (rimStyle === 'bbs_gold' || rimStyle === 'aero_ev') {
    const lipRing = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.66, radius * 0.66, width + 0.022, 20, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.14,
        metalness: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    lipRing.rotation.z = Math.PI / 2;
    g.add(lipRing);
  }

  const spokeCount =
    rimStyle === 'bbs_gold' ? 8 : rimStyle === 'sport_black' ? 7 : 5;
  const spokeColor =
    rimStyle === 'sport_black'
      ? 0x27272a
      : rimStyle === 'bbs_gold'
        ? 0xeab308
        : rimStyle === 'aero_ev'
          ? 0xe2e8f0
          : isClassic
            ? 0x52525b
            : 0x334155;

  const spokeMat = new THREE.MeshStandardMaterial({
    color: spokeColor,
    roughness: 0.28,
    metalness: 0.82,
  });

  for (let i = 0; i < spokeCount; i++) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        width + 0.028,
        radius * (rimStyle === 'aero_ev' ? 1.08 : 0.98),
        rimStyle === 'aero_ev' ? 0.068 : 0.04,
      ),
      spokeMat,
    );
    spoke.rotation.x = (i * Math.PI) / spokeCount;
    g.add(spoke);
  }

  // Sport brake caliper accent behind rim spokes for tuned rims
  if (rimStyle === 'sport_black' || rimStyle === 'bbs_gold') {
    const caliper = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.55, radius * 0.42, 0.11),
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.35,
        metalness: 0.35,
      }),
    );
    caliper.position.set(0, 0.04, -radius * 0.28);
    g.add(caliper);
  }

  return g;
}

// Helper to orient a structural pillar cleanly from point A to point B
function makePillarBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  thicknessX: number,
  thicknessZ: number,
  mat: THREE.Material,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(thicknessX, len, thicknessZ),
    mat,
  );
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  return mesh;
}

export function buildPlayerCarRig(
  spec: VehicleSpec,
  paintHex: string,
  mods: VehicleMods,
  contactShadowTex: THREE.Texture,
  maxAniso: number,
  isSoftwareGl: boolean,
  isRemote = false,
): PlayerCarRig {
  const root = new THREE.Group();
  const dropOffset = mods.suspension === 'lowered' ? 0.055 : 0;
  const chassisGroup = new THREE.Group();
  chassisGroup.position.y = -dropOffset;
  root.add(chassisGroup);

  const exteriorRoofGroup = new THREE.Group();
  chassisGroup.add(exteriorRoofGroup);

  const interiorGroup = new THREE.Group();
  chassisGroup.add(interiorGroup);

  // Contact shadow disc grounded flush at y = 0.02
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.bodyWidth * 1.45, spec.bodyLength * 1.25),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  const bodyPaint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    metalness: spec.id === 'tofas_sahin' ? 0.25 : 0.75,
    roughness: spec.id === 'tofas_sahin' ? 0.36 : 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x16181c,
    roughness: 0.78,
    metalness: 0.12,
  });

  const glossBlackMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e1014,
    roughness: 0.18,
    metalness: 0.35,
    clearcoat: 0.9,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.16,
    metalness: 0.94,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9ec5e6,
    metalness: 0.05,
    roughness: 0.08,
    transparent: true,
    opacity: isSoftwareGl ? 0.18 : 0.22,
    depthWrite: false,
  });

  const exteriorWindowMat = new THREE.MeshPhysicalMaterial({
    color: mods.windowTint === 'dark' ? 0x090b10 : 0x1e293b,
    metalness: mods.windowTint === 'dark' ? 0.18 : 0.35,
    roughness: 0.08,
    clearcoat: 0.9,
  });

  const dashMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.interiorTrimHex),
    roughness: 0.82,
    metalness: 0.08,
  });

  const accentTrimMat = new THREE.MeshStandardMaterial({
    color: spec.cockpitStyle === 'classic_analog' ? 0x6b4226 : 0x64748b,
    roughness: spec.cockpitStyle === 'classic_analog' ? 0.42 : 0.32,
    metalness: spec.cockpitStyle === 'classic_analog' ? 0.1 : 0.78,
  });

  const isSuv = spec.id === 'togg_t10x';
  const isClassic = spec.id === 'tofas_sahin';
  const beltY = isSuv ? 0.94 : 0.84;
  const roofY = isSuv ? 1.56 : 1.41;
  const halfW = spec.bodyWidth * 0.5;
  const halfL = spec.bodyLength * 0.5;

  // --- 1. LOWER CHASSIS, BUMPERS & SCULPTED HOOD ---
  const lowerSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth, 0.24, spec.bodyLength),
    darkTrimMat,
  );
  lowerSkirt.position.set(0, 0.34, 0);
  lowerSkirt.castShadow = true;
  chassisGroup.add(lowerSkirt);

  // Front & Rear bumpers
  const frontBumper = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth * 0.98, 0.28, 0.24),
    bodyPaint,
  );
  frontBumper.position.set(0, 0.45, -halfL + 0.05);
  chassisGroup.add(frontBumper);

  const rearBumper = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth * 0.98, 0.28, 0.24),
    bodyPaint,
  );
  rearBumper.position.set(0, 0.45, halfL - 0.05);
  chassisGroup.add(rearBumper);

  // Sculpted Hood (Kaput) visible out front over dashboard in cockpit camera
  const hoodZStart = -0.74;
  const hoodZEnd = -halfL + 0.08;
  const hoodLen = Math.abs(hoodZEnd - hoodZStart);
  const hoodMidZ = (hoodZStart + hoodZEnd) * 0.5;

  const hoodMesh = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth - 0.12, 0.14, hoodLen),
    bodyPaint,
  );
  hoodMesh.position.set(0, beltY + 0.01, hoodMidZ);
  hoodMesh.rotation.x = isClassic ? 0.025 : 0.065;
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  chassisGroup.add(hoodMesh);

  // Hood character creases for strong forward depth cues in Kokpit camera
  for (const sx of [-0.48, 0.48]) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.03, hoodLen * 0.88),
      bodyPaint,
    );
    rib.position.set(sx, beltY + 0.082, hoodMidZ + 0.04);
    rib.rotation.x = isClassic ? 0.025 : 0.065;
    chassisGroup.add(rib);
  }

  // Side lower body panels & fenders
  for (const side of [-1, 1]) {
    const fender = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.50, spec.bodyLength * 0.94),
      bodyPaint,
    );
    fender.position.set(side * (halfW - 0.09), beltY - 0.20, 0);
    fender.castShadow = true;
    chassisGroup.add(fender);
  }

  // Watertight Front Nose Fascia bridging bumper (y=0.34) cleanly up into hood (beltY)
  const fasciaHeight = beltY - 0.30;
  const frontFascia = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth - 0.04, fasciaHeight, 0.44),
    bodyPaint,
  );
  frontFascia.position.set(0, 0.32 + fasciaHeight * 0.5, -halfL + 0.17);
  frontFascia.castShadow = true;
  chassisGroup.add(frontFascia);

  // Front grille + recessed dark core + Turkish TR license plate
  const grilleRecess = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth * 0.56, 0.24, 0.035),
    darkTrimMat,
  );
  grilleRecess.position.set(0, isSuv ? 0.67 : 0.61, -halfL - 0.048);
  chassisGroup.add(grilleRecess);

  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth * 0.58, 0.26, 0.025),
    isClassic ? darkTrimMat : chromeMat,
  );
  grille.position.set(0, isSuv ? 0.67 : 0.61, -halfL - 0.038);
  chassisGroup.add(grille);

  const plateTex = createPlateTexture(spec.plateText, maxAniso);
  const plateMat = new THREE.MeshStandardMaterial({
    map: plateTex,
    roughness: 0.4,
    metalness: 0.1,
  });
  const frontPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.12), plateMat);
  frontPlate.position.set(0, 0.42, -halfL - 0.076);
  frontPlate.rotation.y = Math.PI;
  chassisGroup.add(frontPlate);

  const rearPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.12), plateMat);
  rearPlate.position.set(0, 0.56, halfL + 0.075);
  chassisGroup.add(rearPlate);

  // Rear trunk deck + optional Rear Spoiler (Bagaj Çıtası / GT Kanat)
  const rearBody = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth - 0.06, 0.50, halfL - 0.35),
    bodyPaint,
  );
  rearBody.position.set(0, beltY - 0.12, halfL * 0.55 + 0.14);
  rearBody.castShadow = true;
  chassisGroup.add(rearBody);

  const deckY = beltY + 0.14;
  if (mods.spoiler === 'lip') {
    const lipSpoiler = new THREE.Mesh(
      new THREE.BoxGeometry(spec.bodyWidth - 0.26, 0.05, 0.11),
      glossBlackMat,
    );
    lipSpoiler.position.set(0, deckY + 0.01, halfL - 0.10);
    lipSpoiler.rotation.x = 0.22;
    chassisGroup.add(lipSpoiler);
  } else if (mods.spoiler === 'gt_wing') {
    for (const sx of [-0.42, 0.42]) {
      const pylon = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.22, 0.16),
        glossBlackMat,
      );
      pylon.position.set(sx, deckY + 0.10, halfL - 0.20);
      chassisGroup.add(pylon);
    }
    const wingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(spec.bodyWidth - 0.10, 0.035, 0.26),
      glossBlackMat,
    );
    wingBlade.position.set(0, deckY + 0.22, halfL - 0.16);
    wingBlade.rotation.x = 0.12;
    wingBlade.castShadow = true;
    chassisGroup.add(wingBlade);

    for (const side of [-1, 1]) {
      const endPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.15, 0.30),
        bodyPaint,
      );
      endPlate.position.set(side * (halfW - 0.05), deckY + 0.21, halfL - 0.16);
      chassisGroup.add(endPlate);
    }
  }

  // Optional Front Sport Lip / Splitter (Ön Tampon Eki)
  if (mods.frontLip === 'sport_lip') {
    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(spec.bodyWidth + 0.02, 0.055, 0.26),
      glossBlackMat,
    );
    splitter.position.set(0, 0.26, -halfL - 0.04);
    chassisGroup.add(splitter);

    for (const side of [-1, 1]) {
      const canard = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.12, 0.18),
        glossBlackMat,
      );
      canard.position.set(side * (halfW - 0.02), 0.31, -halfL - 0.01);
      chassisGroup.add(canard);
    }
  }

  // --- 2. EXTERIOR ROOF, PILLARS & GREENHOUSE (hidden only inside cockpit camera) ---
  const roofStartZ = -0.22;
  const roofEndZ = isSuv ? 1.48 : 1.02;
  const roofLen = roofEndZ - roofStartZ;

  const cabinRoof = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth - 0.28, 0.075, roofLen),
    bodyPaint,
  );
  cabinRoof.position.set(0, roofY, (roofStartZ + roofEndZ) * 0.5);
  cabinRoof.castShadow = true;
  exteriorRoofGroup.add(cabinRoof);

  // B-pillars & C-pillars connecting roof solidly to lower body
  for (const side of [-1, 1]) {
    const bPillar = makePillarBetween(
      new THREE.Vector3(side * (halfW - 0.12), beltY, 0.25),
      new THREE.Vector3(side * (halfW - 0.18), roofY, 0.25),
      0.08,
      0.14,
      darkTrimMat,
    );
    exteriorRoofGroup.add(bPillar);

    const cPillar = makePillarBetween(
      new THREE.Vector3(side * (halfW - 0.12), beltY, isSuv ? 1.75 : 1.45),
      new THREE.Vector3(side * (halfW - 0.18), roofY, roofEndZ - 0.05),
      0.10,
      0.18,
      bodyPaint,
    );
    exteriorRoofGroup.add(cPillar);

    // Side window glass panes
    const sideGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, roofY - beltY - 0.06, 1.35),
      exteriorWindowMat,
    );
    sideGlass.position.set(side * (halfW - 0.16), (beltY + roofY) * 0.5, 0.45);
    exteriorRoofGroup.add(sideGlass);
  }

  // Rear window glass
  const rearGlass = makePillarBetween(
    new THREE.Vector3(0, beltY + 0.05, isSuv ? 1.78 : 1.50),
    new THREE.Vector3(0, roofY - 0.02, roofEndZ),
    spec.bodyWidth - 0.38,
    0.04,
    exteriorWindowMat,
  );
  exteriorRoofGroup.add(rearGlass);

  // --- 3. DETAILED LIGHTING (Headlights, DRLs, Fog Lights, Beams, Taillights, Signals) ---
  const hlPreset = getHeadlightPreset(mods.headlightColor);
  const headlightMats: THREE.MeshStandardMaterial[] = [];
  const drlMats: THREE.MeshStandardMaterial[] = [];
  const fogLightMats: THREE.MeshStandardMaterial[] = [];
  const brakeLightMats: THREE.MeshStandardMaterial[] = [];
  const leftSignalMats: THREE.MeshStandardMaterial[] = [];
  const rightSignalMats: THREE.MeshStandardMaterial[] = [];
  const beamCones: THREE.Mesh[] = [];
  const beamConeMats: THREE.MeshBasicMaterial[] = [];

  const isBlackedHousing = mods.headlightHousing === 'black_angel';
  const hlHousingMat = isBlackedHousing ? glossBlackMat : chromeMat;

  for (const side of [-1, 1]) {
    const hlX = side * (halfW - 0.28);
    const hlY = isSuv ? 0.72 : 0.64;
    const hlZ = -halfL - 0.046;

    // Outer headlight bezel/bucket integrated flush against frontFascia
    const hlBucket = new THREE.Mesh(
      new THREE.BoxGeometry(0.37, 0.14, 0.05),
      hlHousingMat,
    );
    hlBucket.position.set(hlX, hlY, hlZ + 0.015);
    chassisGroup.add(hlBucket);

    // Dual optical projector lenses inside headlight housing
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: hlPreset.beamHex,
      emissiveIntensity: 0.45,
      roughness: 0.08,
      metalness: 0.15,
    });
    headlightMats.push(hlMat);

    for (const innerOff of [-0.072, 0.072]) {
      const projector = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.036, 16),
        hlMat,
      );
      projector.rotation.x = Math.PI / 2;
      projector.position.set(hlX + innerOff, hlY, hlZ - 0.004);
      chassisGroup.add(projector);

      // Angel-eye halo ring when Karartmalı LED is selected
      if (isBlackedHousing) {
        const haloMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: hlPreset.drlHex,
          emissiveIntensity: 1.5,
          roughness: 0.15,
        });
        drlMats.push(haloMat);
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.048, 0.007, 8, 20),
          haloMat,
        );
        halo.position.set(hlX + innerOff, hlY, hlZ - 0.022);
        chassisGroup.add(halo);
      }
    }

    // Signature LED Gündüz Farı (DRL) blade/strip per model
    const drlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: hlPreset.drlHex,
      emissiveIntensity: 1.35,
      roughness: 0.12,
    });
    drlMats.push(drlMat);

    const drlBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.022, 0.028),
      drlMat,
    );
    drlBar.position.set(hlX, hlY + (isSuv ? 0.06 : -0.056), hlZ - 0.015);
    chassisGroup.add(drlBar);

    if (isSuv) {
      // TOGG signature vertical boomerang corner blade
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.17, 0.028),
        drlMat,
      );
      blade.position.set(side * (halfW - 0.12), hlY - 0.11, hlZ - 0.015);
      chassisGroup.add(blade);
    }

    // Front Bumper Fog Lights (Sis Farları) — flush on lower bumper corners
    const fogMat = new THREE.MeshStandardMaterial({
      color: mods.headlightColor === 'amber_fog' ? 0xfde047 : 0xfef9c3,
      emissive:
        mods.headlightColor === 'ice_blue'
          ? 0x38bdf8
          : mods.headlightColor === 'amber_fog'
            ? 0xfacc15
            : 0xfef08a,
      emissiveIntensity: mods.frontLip === 'sport_lip' ? 1.2 : 0.25,
      roughness: 0.12,
    });
    fogLightMats.push(fogMat);
    const fogHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.052, 0.036, 14),
      darkTrimMat,
    );
    fogHousing.rotation.x = Math.PI / 2;
    fogHousing.position.set(side * (halfW - 0.27), 0.39, -halfL - 0.062);
    chassisGroup.add(fogHousing);

    const fogLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.04, 14),
      fogMat,
    );
    fogLens.rotation.x = Math.PI / 2;
    fogLens.position.set(side * (halfW - 0.27), 0.39, -halfL - 0.066);
    chassisGroup.add(fogLens);

    // Subtle volumetric headlight cone mesh projecting forward from projector lens
    const coneMat = new THREE.MeshBasicMaterial({
      color: hlPreset.beamHex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    beamConeMats.push(coneMat);
    const coneGeo = new THREE.CylinderGeometry(0.11, 1.35, 11.5, 16, 1, true);
    coneGeo.translate(0, -5.75, 0);
    coneGeo.rotateX(Math.PI / 2);
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.set(hlX, hlY, hlZ - 0.03);
    coneMesh.rotation.x = 0.045;
    chassisGroup.add(coneMesh);
    beamCones.push(coneMesh);

    const blMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    });
    brakeLightMats.push(blMat);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.06), blMat);
    bl.position.set(side * (halfW - 0.28), 0.70, halfL + 0.01);
    chassisGroup.add(bl);

    const sigMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.0,
      roughness: 0.25,
    });
    if (side < 0) leftSignalMats.push(sigMat);
    else rightSignalMats.push(sigMat);

    const sigFront = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.025, 0.025), sigMat);
    sigFront.position.set(side * (halfW - 0.105), hlY - 0.028, hlZ - 0.012);
    chassisGroup.add(sigFront);

    const sigRear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.065), sigMat);
    sigRear.position.set(side * (halfW - 0.14), 0.70, halfL + 0.015);
    chassisGroup.add(sigRear);
  }

  // Asphalt Headlight Ground Throw Projection (grounded on road surface ahead of car)
  const throwTex = createHeadlightThrowTexture();
  const headlightThrowMat = new THREE.MeshBasicMaterial({
    map: throwTex,
    color: hlPreset.beamHex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const headlightThrowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 36),
    headlightThrowMat,
  );
  headlightThrowMesh.rotation.x = -Math.PI / 2;
  headlightThrowMesh.position.set(0, 0.035, -halfL - 17.5);
  root.add(headlightThrowMesh);

  const headlightSpotLeft = new THREE.SpotLight(hlPreset.beamHex, 0, 90, Math.PI / 4.6, 0.45, 1.25);
  headlightSpotLeft.position.set(-0.62, 0.68, -halfL);
  headlightSpotLeft.target.position.set(-0.8, 0.0, -36);

  const headlightSpotRight = new THREE.SpotLight(hlPreset.beamHex, 0, 90, Math.PI / 4.6, 0.45, 1.25);
  headlightSpotRight.position.set(0.62, 0.68, -halfL);
  headlightSpotRight.target.position.set(0.8, 0.0, -36);

  if (!isRemote) {
    chassisGroup.add(headlightSpotLeft);
    chassisGroup.add(headlightSpotLeft.target);
    chassisGroup.add(headlightSpotRight);
    chassisGroup.add(headlightSpotRight.target);
  }

  // --- 4. WHEELS (Grounded at y = wheelRadius regardless of lowered suspension!) ---
  const wheelRadius = isSuv ? 0.36 : 0.32;
  const wheelWidth = isSuv ? 0.25 : 0.21;
  const wheelZ = halfL - 0.68;
  const wheels: THREE.Group[] = [];
  const frontWheelPivots: THREE.Group[] = [];

  for (const zPos of [-wheelZ, wheelZ]) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (halfW - 0.08), wheelRadius + dropOffset, zPos);
      const wg = makeWheelGroup(wheelRadius, wheelWidth, isClassic, mods.rimStyle);
      pivot.add(wg);
      chassisGroup.add(pivot);
      wheels.push(wg);
      if (zPos < 0) frontWheelPivots.push(pivot);
    }
  }

  // --- 5. REALISTIC 3D INTERIOR COCKPIT ---
  const dashBaseY = isSuv ? 0.88 : 0.78;
  const driverX = -0.34;

  // Main upper dashboard cowl
  const dashUpper = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth - 0.22, 0.16, 0.42),
    dashMat,
  );
  dashUpper.position.set(0, dashBaseY + 0.08, -0.56);
  interiorGroup.add(dashUpper);

  const dashTrimStrip = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth - 0.26, 0.032, 0.04),
    accentTrimMat,
  );
  dashTrimStrip.position.set(0, dashBaseY + 0.04, -0.34);
  interiorGroup.add(dashTrimStrip);

  // Open hooded instrument binnacle (top visor + left/right cheeks so gauges are 100% unobstructed!)
  const binnacleVisor = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.03, 0.18),
    dashMat,
  );
  binnacleVisor.position.set(driverX, dashBaseY + 0.33, -0.45);
  interiorGroup.add(binnacleVisor);

  for (const sx of [-0.23, 0.23]) {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.19, 0.18),
      dashMat,
    );
    cheek.position.set(driverX + sx, dashBaseY + 0.24, -0.45);
    interiorGroup.add(cheek);
  }

  // Live Cockpit Gauge Cluster Screen + Infotainment Screen
  const displays = new CockpitDisplayController(
    spec.cockpitStyle,
    `${spec.brand} ${spec.model}`,
    maxAniso,
  );

  const clusterScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.43, 0.17),
    new THREE.MeshBasicMaterial({ map: displays.clusterTexture }),
  );
  clusterScreen.position.set(driverX, dashBaseY + 0.24, -0.45);
  clusterScreen.rotation.x = -0.10;
  interiorGroup.add(clusterScreen);

  // Center Infotainment Screen / Classic Console
  const centerPod = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.22, 0.10),
    darkTrimMat,
  );
  centerPod.position.set(0.05, dashBaseY + 0.22, -0.46);
  centerPod.rotation.y = 0.14;
  interiorGroup.add(centerPod);

  const infoScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.18),
    new THREE.MeshBasicMaterial({ map: displays.infotainmentTexture }),
  );
  infoScreen.position.set(0.05, dashBaseY + 0.22, -0.405);
  infoScreen.rotation.y = 0.14;
  interiorGroup.add(infoScreen);

  // Air vents under infotainment
  for (const vx of [-0.04, 0.14]) {
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.045, 0.03),
      darkTrimMat,
    );
    vent.position.set(vx, dashBaseY + 0.08, -0.35);
    interiorGroup.add(vent);
  }

  // Center Console Tunnel & Gear Shifter (Vites Kolu)
  const centerTunnel = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.26, 0.90),
    dashMat,
  );
  centerTunnel.position.set(0.0, dashBaseY - 0.18, -0.06);
  interiorGroup.add(centerTunnel);

  const shifterBoot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.058, 0.13, 12),
    darkTrimMat,
  );
  shifterBoot.position.set(0.02, dashBaseY - 0.02, -0.18);
  shifterBoot.rotation.x = 0.15;
  interiorGroup.add(shifterBoot);

  const shifterKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 14, 12),
    isClassic ? darkTrimMat : chromeMat,
  );
  shifterKnob.position.set(0.02, dashBaseY + 0.055, -0.17);
  interiorGroup.add(shifterKnob);

  // Steering Column + Rotating 3D Steering Wheel (slightly lower so gauges shine clearly through upper arc!)
  const steeringColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.052, 0.24, 12),
    darkTrimMat,
  );
  steeringColumn.position.set(driverX, dashBaseY + 0.09, -0.34);
  steeringColumn.rotation.x = Math.PI / 2 - 0.34;
  interiorGroup.add(steeringColumn);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(driverX, dashBaseY + 0.13, -0.24);
  steeringWheel.rotation.x = -0.34;
  interiorGroup.add(steeringWheel);

  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.165, 0.019, 14, 36),
    new THREE.MeshStandardMaterial({
      color: isClassic ? 0x1c1917 : 0x111317,
      roughness: 0.62,
      metalness: 0.18,
    }),
  );
  steeringWheel.add(wheelRim);

  const topMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.165, 0.021, 8, 8, 0.16),
    new THREE.MeshStandardMaterial({
      color: spec.id === 'togg_t10x' ? 0x38bdf8 : 0xef4444,
      roughness: 0.35,
    }),
  );
  topMarker.rotation.z = Math.PI / 2 - 0.08;
  steeringWheel.add(topMarker);

  const hornHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.055, 0.036, 18),
    darkTrimMat,
  );
  hornHub.rotation.x = Math.PI / 2;
  steeringWheel.add(hornHub);

  const emblem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.019, 0.042, 16),
    chromeMat,
  );
  emblem.rotation.x = Math.PI / 2;
  steeringWheel.add(emblem);

  for (const ang of [0, Math.PI, -Math.PI / 2]) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.026, 0.016),
      isClassic ? darkTrimMat : accentTrimMat,
    );
    spoke.position.set(Math.cos(ang) * 0.085, Math.sin(ang) * 0.085, -0.005);
    spoke.rotation.z = ang;
    steeringWheel.add(spoke);
  }

  // Properly angled A-Pillars connecting front cowl cleanly backward up to roof header!
  for (const side of [-1, 1]) {
    const cowlPt = new THREE.Vector3(side * (halfW - 0.13), beltY + 0.04, -0.74);
    const roofPt = new THREE.Vector3(side * (halfW - 0.18), roofY - 0.01, roofStartZ);
    const aPillar = makePillarBetween(cowlPt, roofPt, 0.068, 0.075, dashMat);
    interiorGroup.add(aPillar);

    // Door sill armrest
    const doorSill = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.22, 1.05),
      dashMat,
    );
    doorSill.position.set(side * (halfW - 0.09), dashBaseY - 0.04, -0.08);
    interiorGroup.add(doorSill);

    // Exterior Side Mirror (Yan Ayna) mounted on A-pillar base
    const mirrorStem = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.04, 0.05),
      darkTrimMat,
    );
    mirrorStem.position.set(side * (halfW - 0.03), beltY + 0.11, -0.52);
    chassisGroup.add(mirrorStem);

    const mirrorHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.10, 0.10),
      bodyPaint,
    );
    mirrorHousing.position.set(side * (halfW + 0.06), beltY + 0.12, -0.52);
    chassisGroup.add(mirrorHousing);

    const mirrorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.075),
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.05,
        metalness: 0.96,
      }),
    );
    mirrorGlass.position.set(side * (halfW + 0.06), beltY + 0.12, -0.468);
    chassisGroup.add(mirrorGlass);
  }

  // Windshield upper roof header
  const headerBar = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyWidth - 0.28, 0.07, 0.12),
    dashMat,
  );
  headerBar.position.set(0, roofY - 0.02, roofStartZ);
  interiorGroup.add(headerBar);

  // Slanted Windshield glass connecting cowl (-0.74) to roof (-0.22)
  const windshield = makePillarBetween(
    new THREE.Vector3(0, beltY + 0.04, -0.74),
    new THREE.Vector3(0, roofY - 0.02, roofStartZ),
    spec.bodyWidth - 0.30,
    0.02,
    glassMat,
  );
  interiorGroup.add(windshield);

  // Resting Windshield Wipers (Silecekler)
  for (const wx of [-0.36, 0.24]) {
    const wiper = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.016, 0.02),
      darkTrimMat,
    );
    wiper.position.set(wx, beltY + 0.07, -0.73);
    wiper.rotation.z = 0.05;
    interiorGroup.add(wiper);
  }

  // Interior Rearview Mirror (Dikiz Aynası) + Swinging Turkish Nazar Boncuğu!
  const mirrorStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.08, 8),
    darkTrimMat,
  );
  mirrorStem.position.set(-0.04, roofY - 0.09, -0.26);
  interiorGroup.add(mirrorStem);

  const mirrorBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.064, 0.03),
    darkTrimMat,
  );
  mirrorBody.position.set(-0.04, roofY - 0.14, -0.25);
  interiorGroup.add(mirrorBody);

  const mirrorFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.20, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.06,
      metalness: 0.95,
    }),
  );
  mirrorFace.position.set(-0.04, roofY - 0.14, -0.233);
  interiorGroup.add(mirrorFace);

  const charmPivot = new THREE.Group();
  charmPivot.position.set(-0.04, roofY - 0.175, -0.24);
  interiorGroup.add(charmPivot);

  const charmCord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0025, 0.0025, 0.065, 6),
    new THREE.MeshBasicMaterial({ color: 0xe5e7eb }),
  );
  charmCord.position.y = -0.032;
  charmPivot.add(charmCord);

  const nazarOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.023, 0.009, 18),
    new THREE.MeshPhysicalMaterial({
      color: 0x1d4ed8,
      roughness: 0.1,
      clearcoat: 1.0,
    }),
  );
  nazarOuter.rotation.x = Math.PI / 2;
  nazarOuter.position.y = -0.075;
  charmPivot.add(nazarOuter);

  const nazarWhite = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.011, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  nazarWhite.rotation.x = Math.PI / 2;
  nazarWhite.position.y = -0.075;
  charmPivot.add(nazarWhite);

  const nazarEye = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0065, 0.0065, 0.013, 14),
    new THREE.MeshBasicMaterial({ color: 0x0f172a }),
  );
  nazarEye.rotation.x = Math.PI / 2;
  nazarEye.position.y = -0.075;
  charmPivot.add(nazarEye);

  return {
    root,
    chassisGroup,
    exteriorRoofGroup,
    interiorGroup,
    steeringWheel,
    charmPivot,
    wheels,
    frontWheelPivots,
    brakeLightMats,
    headlightMats,
    drlMats,
    fogLightMats,
    leftSignalMats,
    rightSignalMats,
    headlightSpotLeft,
    headlightSpotRight,
    headlightThrowMesh,
    headlightThrowMat,
    beamCones,
    beamConeMats,
    rideHeightOffset: -dropOffset,
    displays,
    dispose: () => {
      displays.dispose();
      plateTex.dispose();
      throwTex.dispose();
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    },
  };
}

export function buildTrafficCarRig(
  tv: TrafficVehicle,
  contactShadowTex: THREE.Texture,
  maxAniso: number,
): TrafficCarRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(tv.width * 1.4, tv.length * 1.2),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  root.add(shadow);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tv.colorHex),
    metalness: tv.kind === 'iett_bus' ? 0.25 : 0.6,
    roughness: tv.kind === 'iett_bus' ? 0.42 : 0.26,
    clearcoat: 0.85,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.78,
  });

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.12,
    metalness: 0.65,
  });

  const wheelRadius = tv.kind === 'iett_bus' ? 0.48 : 0.31;
  const wheels: THREE.Mesh[] = [];
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2);

  for (const wz of [-tv.length * 0.33, tv.length * 0.33]) {
    for (const wx of [-tv.width * 0.46, tv.width * 0.46]) {
      const wm = new THREE.Mesh(wheelGeo, trimMat);
      wm.position.set(wx, wheelRadius, wz);
      root.add(wm);
      wheels.push(wm);
    }
  }

  if (tv.kind === 'iett_bus') {
    const busHull = new THREE.Mesh(
      new THREE.BoxGeometry(tv.width, tv.height - 0.45, tv.length),
      bodyMat,
    );
    busHull.position.y = tv.height * 0.5 + 0.15;
    busHull.castShadow = true;
    root.add(busHull);

    const glassBand = new THREE.Mesh(
      new THREE.BoxGeometry(tv.width + 0.02, 1.05, tv.length - 0.35),
      windowMat,
    );
    glassBand.position.y = tv.height * 0.64;
    root.add(glassBand);

    const acPod = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.24, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.55 }),
    );
    acPod.position.set(0, tv.height + 0.04, -0.8);
    root.add(acPod);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(tv.width + 0.03, 0.18, tv.length + 0.01),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 }),
    );
    stripe.position.y = 1.02;
    root.add(stripe);
  } else if (tv.kind === 'ptt_kargo') {
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(tv.width * 0.96, 1.55, 1.45),
      bodyMat,
    );
    cab.position.set(0, 1.05, -tv.length * 0.34);
    cab.castShadow = true;
    root.add(cab);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(tv.width, tv.height - 0.35, tv.length - 1.55),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }),
    );
    cargoBox.position.set(0, (tv.height - 0.35) * 0.5 + 0.35, 0.72);
    cargoBox.castShadow = true;
    root.add(cargoBox);

    const kargoBand = new THREE.Mesh(
      new THREE.BoxGeometry(tv.width + 0.02, 0.38, tv.length - 1.5),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 }),
    );
    kargoBand.position.set(0, 1.45, 0.72);
    root.add(kargoBand);
  } else {
    const lowerH = tv.kind === 'doblo' ? 0.68 : 0.56;
    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(tv.width, lowerH, tv.length),
      bodyMat,
    );
    lowerBody.position.y = 0.32 + lowerH * 0.5;
    lowerBody.castShadow = true;
    root.add(lowerBody);

    const cabinLen = tv.kind === 'doblo' ? tv.length * 0.68 : tv.length * 0.52;
    const cabinH = tv.height - lowerH - 0.26;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(tv.width * 0.86, cabinH, cabinLen),
      bodyMat,
    );
    cabin.position.set(0, 0.32 + lowerH + cabinH * 0.45, 0.18);
    cabin.castShadow = true;
    root.add(cabin);

    const greenhouse = new THREE.Mesh(
      new THREE.BoxGeometry(tv.width * 0.87, cabinH * 0.75, cabinLen * 0.92),
      windowMat,
    );
    greenhouse.position.set(0, 0.32 + lowerH + cabinH * 0.45, 0.18);
    root.add(greenhouse);

    if (tv.kind === 'istanbul_taxi') {
      const taxiSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.14, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfacc15,
          emissiveIntensity: 0.75,
        }),
      );
      taxiSign.position.set(0, tv.height + 0.05, 0.05);
      root.add(taxiSign);

      const checkerStripe = new THREE.Mesh(
        new THREE.BoxGeometry(tv.width + 0.02, 0.09, tv.length * 0.7),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 }),
      );
      checkerStripe.position.set(0, 0.64, 0);
      root.add(checkerStripe);
    }

    if (tv.kind === 'polis') {
      const whiteDoorBand = new THREE.Mesh(
        new THREE.BoxGeometry(tv.width + 0.02, 0.44, tv.length * 0.45),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }),
      );
      whiteDoorBand.position.set(0, 0.62, 0.08);
      root.add(whiteDoorBand);
    }
  }

  let policeRedMat: THREE.MeshStandardMaterial | undefined;
  let policeBlueMat: THREE.MeshStandardMaterial | undefined;
  if (tv.kind === 'polis') {
    policeRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.5,
    });
    policeBlueMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x3b82f6,
      emissiveIntensity: 1.5,
    });
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.22), policeRedMat);
    barR.position.set(-0.24, tv.height + 0.04, 0.05);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.22), policeBlueMat);
    barB.position.set(0.24, tv.height + 0.04, 0.05);
    root.add(barR, barB);
  }

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff3d1,
    emissiveIntensity: 0.75,
  });
  for (const side of [-1, 1]) {
    const frontHl = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.10, 0.05),
      headlightMat,
    );
    frontHl.position.set(side * (tv.width * 0.34), 0.64, -tv.length * 0.5 - 0.015);
    root.add(frontHl);
  }

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.5,
  });
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.11, 0.05),
      brakeLightMat,
    );
    tail.position.set(side * (tv.width * 0.36), 0.72, tv.length * 0.5 + 0.015);
    root.add(tail);
  }

  const plateTex = createPlateTexture(tv.plateText, maxAniso, tv.kind === 'polis');
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.12),
    new THREE.MeshBasicMaterial({ map: plateTex }),
  );
  plate.position.set(0, 0.56, tv.length * 0.5 + 0.02);
  root.add(plate);

  return {
    root,
    wheels,
    brakeLightMat,
    headlightMat,
    policeRedMat,
    policeBlueMat,
  };
}

export function createDriverNameSprite(name: string, maxAniso: number): {
  sprite: THREE.Sprite;
  dispose: () => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);

  ctx.fillStyle = 'rgba(12, 14, 18, 0.86)';
  ctx.beginPath();
  ctx.roundRect(18, 10, 220, 44, 12);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 14), 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 0.6, 1);

  return {
    sprite,
    dispose: () => {
      tex.dispose();
      mat.dispose();
    },
  };
}

