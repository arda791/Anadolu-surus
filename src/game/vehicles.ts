import { TrafficKind, VehicleId, VehicleSpec } from './types';

// Highway geometry constants (meters, -Z is forward)
// 4 lanes: 0 (far left fast), 1 (center-left), 2 (center-right), 3 (right slow)
export const LANE_WIDTH = 3.9;
export const LANE_CENTERS = [-5.85, -1.95, 1.95, 5.85] as const;
export const ROAD_HALF_WIDTH = 8.4; // Includes narrow emergency shoulder strips
export const SHOULDER_LIMIT = 9.4;

export interface RouteMilestone {
  km: number;
  name: string;
}

export const TURKEY_MILESTONES: RouteMilestone[] = [
  { km: 0, name: 'Boğaziçi · 15 Temmuz Köprüsü Girişi' },
  { km: 1.5, name: 'O-4 Anadolu Otoyolu · Ataşehir' },
  { km: 3.5, name: 'Gebze · Osmangazi Bağlantısı' },
  { km: 6.0, name: 'İzmit Körfezi Sahil Kesimi' },
  { km: 9.0, name: 'Sapanca · Bolu Dağı Etekleri' },
  { km: 13.0, name: 'Ankara Otoyolu · Hızlı Etap' },
];

export const VEHICLES: Record<VehicleId, VehicleSpec> = {
  togg_t10x: {
    id: 'togg_t10x',
    brand: 'TOGG',
    model: 'T10X V2',
    subtitle: 'Yerli Elektrikli SUV',
    originNote: 'Gemlik Üretimi · 435 HP Çift Motor',
    drivetrain: 'EV AWD',
    isElectric: true,
    horsePower: 435,
    massKg: 2120,
    maxSpeedKmh: 210,
    accelForce: 22.5,
    brakeForce: 28,
    steeringResponse: 3.6,
    lateralGrip: 9.4,
    bodyLength: 4.6,
    bodyWidth: 1.9,
    bodyHeight: 1.62,
    hoodLength: 1.12,
    cockpitStyle: 'modern_ev',
    interiorTrimHex: '#1e242b',
    plateText: '34 TOG 2023',
    paints: [
      { name: 'Anadolu Kırmızısı', hex: '#a61c24' },
      { name: 'Gemlik Mavisi', hex: '#1d4d6b' },
      { name: 'Kula Grisi', hex: '#525860' },
      { name: 'Kapadokya Beji', hex: '#b8a992' },
    ],
  },
  fiat_egea: {
    id: 'fiat_egea',
    brand: 'FIAT',
    model: 'Egea 1.6 Multijet',
    subtitle: 'Bursa Üretimi Sedan',
    originNote: 'Tofaş Bursa · 130 HP Dizel',
    drivetrain: 'FWD',
    isElectric: false,
    horsePower: 130,
    massKg: 1380,
    maxSpeedKmh: 205,
    accelForce: 15.8,
    brakeForce: 25,
    steeringResponse: 3.8,
    lateralGrip: 8.8,
    bodyLength: 4.53,
    bodyWidth: 1.79,
    bodyHeight: 1.49,
    hoodLength: 1.15,
    cockpitStyle: 'modern_sedan',
    interiorTrimHex: '#202226',
    plateText: '16 EGE 412',
    paints: [
      { name: 'Buz Beyazı', hex: '#e9ecef' },
      { name: 'Kurşun Gri', hex: '#495057' },
      { name: 'Akdeniz Mavisi', hex: '#234b78' },
      { name: 'Tutku Kırmızısı', hex: '#b02128' },
    ],
  },
  renault_megane: {
    id: 'renault_megane',
    brand: 'RENAULT',
    model: 'Megane Sedan',
    subtitle: 'Otoyol Konforu',
    originNote: 'Oyak Renault Bursa · 140 HP TCe',
    drivetrain: 'FWD',
    isElectric: false,
    horsePower: 140,
    massKg: 1360,
    maxSpeedKmh: 215,
    accelForce: 17.2,
    brakeForce: 26,
    steeringResponse: 3.9,
    lateralGrip: 9.1,
    bodyLength: 4.63,
    bodyWidth: 1.81,
    bodyHeight: 1.44,
    hoodLength: 1.18,
    cockpitStyle: 'modern_sedan',
    interiorTrimHex: '#181a1f',
    plateText: '34 MGN 782',
    paints: [
      { name: 'Demir Mavi', hex: '#2b476b' },
      { name: 'Yıldız Siyah', hex: '#1c1f24' },
      { name: 'Platin Gri', hex: '#90969e' },
      { name: 'Sedef Beyaz', hex: '#edeff2' },
    ],
  },
  tofas_sahin: {
    id: 'tofas_sahin',
    brand: 'TOFAŞ',
    model: 'Şahin S 1.6',
    subtitle: 'Efsane Klasik',
    originNote: 'Arkadan İtişli · 82 HP Karbüratör',
    drivetrain: 'RWD',
    isElectric: false,
    horsePower: 82,
    massKg: 980,
    maxSpeedKmh: 178,
    accelForce: 13.4,
    brakeForce: 20,
    steeringResponse: 4.1,
    lateralGrip: 7.4,
    bodyLength: 4.31,
    bodyWidth: 1.66,
    bodyHeight: 1.43,
    hoodLength: 1.14,
    cockpitStyle: 'classic_analog',
    interiorTrimHex: '#2b2824',
    plateText: '06 SHN 94',
    paints: [
      { name: 'Kar Beyazı', hex: '#eceae1' },
      { name: 'Vişne Çürüğü', hex: '#631d25' },
      { name: 'Şampanya', hex: '#c7b89c' },
      { name: 'Gece Mavisi', hex: '#1d2f4a' },
    ],
  },
};

export const VEHICLE_LIST: VehicleSpec[] = [
  VEHICLES.togg_t10x,
  VEHICLES.fiat_egea,
  VEHICLES.renault_megane,
  VEHICLES.tofas_sahin,
];

export interface TrafficTemplate {
  kind: TrafficKind;
  label: string;
  length: number;
  width: number;
  height: number;
  minSpeedKmh: number;
  maxSpeedKmh: number;
  colors: string[];
  plates: string[];
}

export const TRAFFIC_TEMPLATES: TrafficTemplate[] = [
  {
    kind: 'istanbul_taxi',
    label: 'İstanbul Sarı Taksi',
    length: 4.45,
    width: 1.78,
    height: 1.48,
    minSpeedKmh: 76,
    maxSpeedKmh: 108,
    colors: ['#f5b800'],
    plates: ['34 TJK 48', '34 TAE 92', '34 TBZ 17'],
  },
  {
    kind: 'iett_bus',
    label: 'İETT Otobüsü',
    length: 9.8,
    width: 2.38,
    height: 2.95,
    minSpeedKmh: 62,
    maxSpeedKmh: 82,
    colors: ['#e0a100', '#c82829'],
    plates: ['34 HO 1954', '34 TP 4410'],
  },
  {
    kind: 'ptt_kargo',
    label: 'Kargo Minibüsü',
    length: 5.4,
    width: 2.02,
    height: 2.35,
    minSpeedKmh: 72,
    maxSpeedKmh: 96,
    colors: ['#f0c419', '#1d4f91'],
    plates: ['34 KRG 318', '06 PTT 804'],
  },
  {
    kind: 'polis',
    label: 'Trafik Polisi',
    length: 4.55,
    width: 1.82,
    height: 1.52,
    minSpeedKmh: 88,
    maxSpeedKmh: 118,
    colors: ['#164488'],
    plates: ['34 A 4512', '06 A 9104'],
  },
  {
    kind: 'doblo',
    label: 'Fiat Doblo Ticari',
    length: 4.42,
    width: 1.84,
    height: 1.82,
    minSpeedKmh: 74,
    maxSpeedKmh: 102,
    colors: ['#e9ecef', '#6c757d', '#2b476b'],
    plates: ['16 DBL 219', '34 YLD 551', '35 KSK 802'],
  },
  {
    kind: 'civil_sedan',
    label: 'Sivil Binek Araç',
    length: 4.5,
    width: 1.79,
    height: 1.46,
    minSpeedKmh: 82,
    maxSpeedKmh: 116,
    colors: ['#dee2e6', '#343a40', '#7f1d1d', '#1e3a5f', '#4b5563'],
    plates: ['34 KLM 601', '06 ANK 312', '35 IZM 108', '16 BRS 774'],
  },
];

export function getMilestoneForKm(km: number): string {
  let current = TURKEY_MILESTONES[0].name;
  for (const m of TURKEY_MILESTONES) {
    if (km >= m.km) current = m.name;
  }
  return current;
}

import type {
  FrontLipStyle,
  HeadlightColorId,
  HeadlightHousingStyle,
  RimStyle,
  SpoilerStyle,
  SuspensionStyle,
  TuningStage,
  VehicleMods,
  WindowTintStyle,
} from './types';

export interface HeadlightPreset {
  id: HeadlightColorId;
  label: string;
  swatchHex: string;
  beamHex: number;
  drlHex: number;
}

export const HEADLIGHT_PRESETS: HeadlightPreset[] = [
  {
    id: 'halogen',
    label: 'Halojen 3200K',
    swatchHex: '#fde68a',
    beamHex: 0xffe4a8,
    drlHex: 0xffedd5,
  },
  {
    id: 'xenon',
    label: 'Xenon 6000K',
    swatchHex: '#f8fafc',
    beamHex: 0xf4f8ff,
    drlHex: 0xffffff,
  },
  {
    id: 'ice_blue',
    label: 'Buz Mavisi LED',
    swatchHex: '#38bdf8',
    beamHex: 0x7dd3fc,
    drlHex: 0x38bdf8,
  },
  {
    id: 'amber_fog',
    label: 'Sarı Ralli',
    swatchHex: '#facc15',
    beamHex: 0xfde047,
    drlHex: 0xfacc15,
  },
];

export const HEADLIGHT_HOUSING_OPTIONS: { id: HeadlightHousingStyle; label: string }[] = [
  { id: 'stock', label: 'Krom Far' },
  { id: 'black_angel', label: 'Karartmalı LED' },
];

export const RIM_OPTIONS: { id: RimStyle; label: string }[] = [
  { id: 'stock', label: 'Fabrika' },
  { id: 'sport_black', label: 'Siyah Spor' },
  { id: 'bbs_gold', label: 'Altın BBS' },
  { id: 'aero_ev', label: 'Aero Kesim' },
];

export const SPOILER_OPTIONS: { id: SpoilerStyle; label: string }[] = [
  { id: 'none', label: 'Yok' },
  { id: 'lip', label: 'İnce Çıta' },
  { id: 'gt_wing', label: 'GT Kanat' },
];

export const FRONT_LIP_OPTIONS: { id: FrontLipStyle; label: string }[] = [
  { id: 'none', label: 'Standart' },
  { id: 'sport_lip', label: 'Ön Lip + Sis' },
];

export const SUSPENSION_OPTIONS: { id: SuspensionStyle; label: string }[] = [
  { id: 'stock', label: 'Standart' },
  { id: 'lowered', label: 'Basık (Coilover)' },
];

export const WINDOW_TINT_OPTIONS: { id: WindowTintStyle; label: string }[] = [
  { id: 'clear', label: 'Şeffaf' },
  { id: 'dark', label: '2 Numara Film' },
];

export const TUNING_OPTIONS: { id: TuningStage; label: string; note: string }[] = [
  { id: 'stock', label: 'Stok', note: 'Fabrika' },
  { id: 'stage1', label: 'Stage 1', note: '+%14 Güç' },
  { id: 'stage2', label: 'Stage 2', note: '+%28 Güç' },
];

export function getDefaultModsForVehicle(id: VehicleId): VehicleMods {
  if (id === 'togg_t10x') {
    return {
      headlightColor: 'xenon',
      headlightHousing: 'stock',
      rimStyle: 'aero_ev',
      spoiler: 'none',
      frontLip: 'none',
      suspension: 'stock',
      windowTint: 'clear',
      tuningStage: 'stock',
    };
  }
  if (id === 'tofas_sahin') {
    return {
      headlightColor: 'halogen',
      headlightHousing: 'stock',
      rimStyle: 'stock',
      spoiler: 'none',
      frontLip: 'none',
      suspension: 'stock',
      windowTint: 'clear',
      tuningStage: 'stock',
    };
  }
  return {
    headlightColor: 'xenon',
    headlightHousing: 'stock',
    rimStyle: 'stock',
    spoiler: 'none',
    frontLip: 'none',
    suspension: 'stock',
    windowTint: 'clear',
    tuningStage: 'stock',
  };
}

export function getHeadlightPreset(id: HeadlightColorId): HeadlightPreset {
  return (
    HEADLIGHT_PRESETS.find((p) => p.id === id) ?? HEADLIGHT_PRESETS[1]
  );
}

export function applyVehicleMods(spec: VehicleSpec, mods: VehicleMods): VehicleSpec {
  const powerMult =
    mods.tuningStage === 'stage2' ? 1.28 : mods.tuningStage === 'stage1' ? 1.14 : 1.0;
  const speedBonus =
    mods.tuningStage === 'stage2' ? 24 : mods.tuningStage === 'stage1' ? 12 : 0;
  const brakeMult =
    mods.tuningStage === 'stage2' ? 1.18 : mods.tuningStage === 'stage1' ? 1.09 : 1.0;
  const gripMult = mods.suspension === 'lowered' ? 1.12 : 1.0;
  const steerMult = mods.suspension === 'lowered' ? 1.08 : 1.0;

  return {
    ...spec,
    horsePower: Math.round(spec.horsePower * powerMult),
    maxSpeedKmh: spec.maxSpeedKmh + speedBonus,
    accelForce: Number((spec.accelForce * powerMult).toFixed(2)),
    brakeForce: Number((spec.brakeForce * brakeMult).toFixed(2)),
    lateralGrip: Number((spec.lateralGrip * gripMult).toFixed(2)),
    steeringResponse: Number((spec.steeringResponse * steerMult).toFixed(2)),
  };
}

