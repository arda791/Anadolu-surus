import {
  Camera,
  Gamepad2,
  Lightbulb,
  Pause,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { FriendAlert } from '../game/onlineClient';
import { RoomPlayerSnapshot, RoomSnapshot } from '../game/multiplayer';
import {
  CameraMode,
  HeadlightBeamMode,
  HudSnapshot,
  InputState,
} from '../game/types';
import { MobileDrivingControls } from './MobileDrivingControls';

interface GameHudProps {
  hud: HudSnapshot;
  vehicleTitle: string;
  muted: boolean;
  showTouchControls: boolean;
  onlineRoom: RoomSnapshot | null;
  onlinePlayerId: string | null;
  remotePlayers: RoomPlayerSnapshot[];
  friendAlert: FriendAlert | null;
  onToggleTouchControls: () => void;
  onTouchControl: (control: keyof InputState, active: boolean) => void;
  onCycleCamera: () => void;
  onToggleHeadlights: () => void;
  onFlashHeadlights: () => void;
  onToggleLeftSignal: () => void;
  onToggleRightSignal: () => void;
  onHonk: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}

const CAMERA_LABELS: Record<CameraMode, string> = {
  cockpit: 'Kokpit (İç)',
  hood: 'Kaput Üstü',
  chase: 'Dış Kamera',
};

const CAMERA_SHORT_LABELS: Record<CameraMode, string> = {
  cockpit: 'Kokpit',
  hood: 'Kaput',
  chase: 'Dış',
};

const HEADLIGHT_LABELS: Record<HeadlightBeamMode, string> = {
  off: 'Far: Kapalı',
  low: 'Kısa Far',
  high: 'Uzun Far',
};

export function GameHud({
  hud,
  vehicleTitle,
  muted,
  showTouchControls,
  onlineRoom,
  onlinePlayerId,
  remotePlayers,
  friendAlert,
  onToggleTouchControls,
  onTouchControl,
  onCycleCamera,
  onToggleHeadlights,
  onFlashHeadlights,
  onToggleLeftSignal,
  onToggleRightSignal,
  onHonk,
  onToggleMute,
  onPause,
}: GameHudProps) {
  const rpmPct = Math.min(100, Math.round((hud.rpm / hud.maxRpm) * 100));
  const healthColor =
    hud.health > 60 ? '#22c55e' : hud.health > 30 ? '#f59e0b' : '#ef4444';

  const selfPlayer = onlineRoom?.players.find((p) => p.id === onlinePlayerId);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Top Perimeter Bar: Left Telemetry Cluster + Right Utility Controls */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          {/* Top-Left: Route Milestone, Distance, Score & Vehicle Integrity */}
          <div
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-white/10 text-zinc-100 min-w-0 max-w-[152px] sm:max-w-none sm:min-w-[230px]"
            style={{ backgroundColor: 'rgba(12, 14, 18, 0.84)' }}
          >
            <div className="text-[11px] sm:text-xs text-zinc-400 font-medium truncate max-w-[136px] sm:max-w-[260px]">
              {hud.milestoneName}
            </div>
            <div className="mt-1 flex items-baseline gap-2.5 sm:gap-4 tabular-nums">
              <div>
                <span className="text-[10px] sm:text-xs text-zinc-400 mr-1">PUAN</span>
                <span className="font-display font-bold text-sm sm:text-lg text-white">
                  {hud.score.toLocaleString('tr-TR')}
                </span>
              </div>
              <div>
                <span className="text-[10px] sm:text-xs text-zinc-400 mr-1">KM</span>
                <span className="font-display font-bold text-sm sm:text-lg text-amber-400">
                  {hud.distanceKm.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-[11px] text-zinc-400 shrink-0">Hasar</span>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${hud.health}%`,
                    backgroundColor: healthColor,
                  }}
                />
              </div>
              <span className="text-[10px] sm:text-[11px] text-zinc-300 tabular-nums w-7 sm:w-8 text-right">
                {hud.health}%
              </span>
            </div>
          </div>

          {/* Online Convoy Status Card (only shown when in an Online Room) */}
          {onlineRoom && (
            <div
              className="px-3 py-2 rounded-lg border border-emerald-500/35 text-zinc-100 max-w-[190px] sm:max-w-[250px]"
              style={{ backgroundColor: 'rgba(10, 16, 14, 0.86)' }}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-emerald-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  ODA: {onlineRoom.roomCode}
                </span>
                <span className="text-zinc-400 tabular-nums">
                  {onlineRoom.players.length} sürücü
                </span>
              </div>
              {remotePlayers.length > 0 ? (
                <div className="mt-1 space-y-0.5 text-[11px]">
                  {remotePlayers.slice(0, 3).map((rp) => {
                    const selfDist = selfPlayer?.distanceMeters ?? hud.distanceKm * 1000;
                    const diffM = Math.round(rp.distanceMeters - selfDist);
                    const gapLabel =
                      Math.abs(diffM) < 6
                        ? 'Yanında'
                        : diffM > 0
                          ? `+${diffM}m Önde`
                          : `${diffM}m`;
                    return (
                      <div
                        key={rp.id}
                        className="flex items-center justify-between gap-2 text-zinc-200 tabular-nums"
                      >
                        <span className="truncate">{rp.name}</span>
                        <span className="text-sky-300 shrink-0">{gapLabel}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-0.5 text-[10px] text-zinc-400">
                  Arkadaşın odaya katılabilir
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center-Top Near-Miss or Friend Horn Toast */}
        {(hud.nearMissFlash || friendAlert) && (
          <div
            className="hidden sm:block px-4 py-2 rounded-lg border border-amber-400/50 text-amber-300 font-display font-bold text-sm tracking-wide tabular-nums"
            style={{ backgroundColor: 'rgba(20, 16, 8, 0.9)' }}
          >
            {friendAlert ? friendAlert.message : hud.nearMissFlash}
          </div>
        )}

        {/* Top-Right Compact Utility Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto shrink-0">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleCamera();
            }}
            aria-label={`Kamera değiştir: ${CAMERA_LABELS[hud.cameraMode]}`}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-lg border border-white/15 text-xs font-medium text-zinc-100 hover:bg-zinc-800/90 transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(12, 14, 18, 0.84)' }}
          >
            <Camera className="w-4 h-4 text-sky-400" />
            <span className="sm:hidden whitespace-nowrap">
              {CAMERA_SHORT_LABELS[hud.cameraMode]}
            </span>
            <span className="hidden sm:inline whitespace-nowrap">
              {CAMERA_LABELS[hud.cameraMode]} [C]
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleHeadlights();
            }}
            aria-label={`Far modu: ${HEADLIGHT_LABELS[hud.headlightMode]}`}
            title={`${HEADLIGHT_LABELS[hud.headlightMode]} [L]`}
            className={`flex items-center gap-1 px-2 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              hud.headlightMode === 'high'
                ? 'border-sky-400/75 text-sky-300'
                : hud.headlightMode === 'low'
                  ? 'border-emerald-400/65 text-emerald-300'
                  : 'border-white/15 text-zinc-300 hover:text-white'
            }`}
            style={{ backgroundColor: 'rgba(12, 14, 18, 0.84)' }}
          >
            <Lightbulb className="w-4 h-4" />
            <span className="hidden md:inline whitespace-nowrap">
              {HEADLIGHT_LABELS[hud.headlightMode]}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.blur();
              onFlashHeadlights();
            }}
            aria-label="Selektör yap"
            title="Selektör [F]"
            className="p-2 rounded-lg border border-white/15 text-amber-300 hover:border-amber-400/60 transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(12, 14, 18, 0.84)' }}
          >
            <Zap className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleTouchControls();
            }}
            aria-label="Dokunmatik sürüş tuşlarını aç veya kapat"
            title="Dokunmatik Sürüş Tuşları"
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              showTouchControls
                ? 'border-emerald-400/60 text-emerald-300'
                : 'border-white/15 text-zinc-300 hover:text-white'
            }`}
            style={{ backgroundColor: 'rgba(12, 14, 18, 0.84)' }}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
            title="Ses [M]"
            className="p-2 rounded-lg border border-white/15 text-zinc-200 hover:bg-zinc-800/90 transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(12, 14, 18, 0.84)' }}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Oyunu duraklat"
            title="Duraklat [Esc]"
            className="p-2 rounded-lg border border-white/15 text-zinc-200 hover:bg-zinc-800/90 transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(12, 14, 18, 0.84)' }}
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Perimeter Stack: Telemetry + Optional Mobile Touch Driving Controls */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-end justify-between gap-4">
          <div
            className="hidden md:flex items-center gap-3 px-3.5 py-2 rounded-lg border border-white/10 text-xs text-zinc-300 pointer-events-auto"
            style={{ backgroundColor: 'rgba(12, 14, 18, 0.80)' }}
          >
            <span className="text-zinc-400">{vehicleTitle}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleLeftSignal();
              }}
              aria-label="Sol sinyal"
              className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                hud.leftSignalOn ? 'bg-emerald-500/25 text-emerald-400' : 'text-zinc-400 hover:text-white'
              }`}
            >
              ◄ [Z]
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleRightSignal();
              }}
              aria-label="Sağ sinyal"
              className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                hud.rightSignalOn ? 'bg-emerald-500/25 text-emerald-400' : 'text-zinc-400 hover:text-white'
              }`}
            >
              [X] ►
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onFlashHeadlights();
              }}
              aria-label="Selektör yap"
              className="px-2 py-0.5 rounded text-amber-300 hover:text-amber-200 cursor-pointer"
            >
              Selektör [F]
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onHonk();
              }}
              aria-label="Korna çal"
              className="px-2 py-0.5 rounded text-zinc-300 hover:text-white cursor-pointer"
            >
              Korna [H]
            </button>
          </div>

          {/* Compact Hero Speed & Gear Readout */}
          <div
            className="ml-auto px-3 sm:px-4 py-2 sm:py-3 rounded-lg border border-white/10 text-right min-w-[136px] sm:min-w-[180px]"
            style={{ backgroundColor: 'rgba(12, 14, 18, 0.86)' }}
          >
            <div className="flex items-baseline justify-end gap-1.5 sm:gap-2">
              <span
                data-testid="hud-speed"
                className="font-display font-bold text-3xl sm:text-4xl leading-none text-white tabular-nums"
              >
                {hud.speedKmh}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-zinc-400">KM/S</span>
            </div>

            <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-2 sm:gap-3 text-[11px] sm:text-xs tabular-nums">
              <span className="text-zinc-400">
                {hud.isElectric ? 'GÜÇ' : 'DEVİR'}{' '}
                <strong className="text-zinc-200">{hud.rpm}</strong>
              </span>
              <span className="font-display font-bold text-sky-400">
                VİTES {hud.gear < 0 ? 'R' : hud.isElectric ? 'D' : hud.gear}
              </span>
            </div>

            <div className="mt-1.5 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${rpmPct}%`,
                  backgroundColor: rpmPct > 84 ? '#ef4444' : '#38bdf8',
                }}
              />
            </div>
          </div>
        </div>

        {showTouchControls && (
          <MobileDrivingControls
            onControlChange={onTouchControl}
            onHonk={onHonk}
          />
        )}
      </div>
    </div>
  );
}
