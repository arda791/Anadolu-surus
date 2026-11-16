export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraMode = 'cockpit' | 'hood' | 'chase';

export type AtmosphereMode = 'afternoon' | 'sunset' | 'night';

export type VehicleId = 'togg_t10x' | 'fiat_egea' | 'renault_megane' | 'tofas_sahin';

export type TrafficKind =
  | 'istanbul_taxi'
  | 'iett_bus'
  | 'ptt_kargo'
  | 'polis'
  | 'doblo'
  | 'civil_sedan';

export interface PaintOption {
  name: string;
  hex: string;
}

export interface VehicleSpec {
  id: VehicleId;
  brand: string;
  model: string;
  subtitle: string;
  originNote: string;
  drivetrain: 'EV AWD' | 'FWD' | 'RWD';
  isElectric: boolean;
  horsePower: number;
  massKg: number;
  maxSpeedKmh: number;
  accelForce: number;
  brakeForce: number;
  steeringResponse: number;
  lateralGrip: number;
  bodyLength: number;
  bodyWidth: number;
  bodyHeight: number;
  hoodLength: number;
  cockpitStyle: 'modern_ev' | 'modern_sedan' | 'classic_analog';
  interiorTrimHex: string;
  plateText: string;
  paints: PaintOption[];
}

export type HeadlightBeamMode = 'off' | 'low' | 'high';

export type HeadlightColorId = 'halogen' | 'xenon' | 'ice_blue' | 'amber_fog';

export type HeadlightHousingStyle = 'stock' | 'black_angel';

export type RimStyle = 'stock' | 'sport_black' | 'bbs_gold' | 'aero_ev';

export type SpoilerStyle = 'none' | 'lip' | 'gt_wing';

export type FrontLipStyle = 'none' | 'sport_lip';

export type SuspensionStyle = 'stock' | 'lowered';

export type WindowTintStyle = 'clear' | 'dark';

export type TuningStage = 'stock' | 'stage1' | 'stage2';

export type TitlePreviewAngle = 'front' | 'rear';

export interface VehicleMods {
  headlightColor: HeadlightColorId;
  headlightHousing: HeadlightHousingStyle;
  rimStyle: RimStyle;
  spoiler: SpoilerStyle;
  frontLip: FrontLipStyle;
  suspension: SuspensionStyle;
  windowTint: WindowTintStyle;
  tuningStage: TuningStage;
}

export interface InputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export interface PlayerPhysicsState {
  x: number;
  z: number; // Negative z is forward along the highway
  speedMs: number; // Forward speed in m/s
  lateralVel: number;
  heading: number; // Yaw angle in radians (0 = straight -Z)
  steerAngle: number; // Normalized [-1, 1]
  wheelVisualSteer: number; // Radian angle for steering wheel visual
  rpm: number; // 800..7500 (or 0..14000 for EV)
  gear: number; // 1..6, 0 = N, -1 = R
  pitch: number; // Suspension pitch rad
  roll: number; // Suspension roll rad
  charmSwing: number; // Nazar boncugu pendulum angle
  charmSwingVel: number;
  health: number; // 0..100
  distanceMeters: number;
  score: number;
  nearMissCount: number;
  comboCount: number;
  comboTimer: number;
  maxSpeedReachedKmh: number;
  hitstopTimer: number;
  cameraTrauma: number;
  headlightsOn: boolean;
  headlightMode: HeadlightBeamMode;
  flasherTimer: number;
  leftSignalOn: boolean;
  rightSignalOn: boolean;
  wipersOn: boolean;
  lastNearMissAt: number;
  crashed: boolean;
}

export interface TrafficVehicle {
  id: number;
  kind: TrafficKind;
  label: string;
  plateText: string;
  laneIndex: number;
  x: number;
  z: number;
  speedMs: number;
  targetSpeedMs: number;
  length: number;
  width: number;
  height: number;
  colorHex: string;
  braking: boolean;
  passedNearMiss: boolean;
}

export interface HudSnapshot {
  speedKmh: number;
  rpm: number;
  maxRpm: number;
  gear: number;
  health: number;
  distanceKm: number;
  score: number;
  bestScore: number;
  nearMissCount: number;
  comboCount: number;
  maxSpeedKmh: number;
  cameraMode: CameraMode;
  headlightsOn: boolean;
  headlightMode: HeadlightBeamMode;
  leftSignalOn: boolean;
  rightSignalOn: boolean;
  nearMissFlash: string | null;
  milestoneName: string;
  isElectric: boolean;
}
