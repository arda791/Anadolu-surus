import { Check, Copy, Lightbulb, LogOut, RotateCcw, Users } from 'lucide-react';
import { useState } from 'react';
import { OnlineConnectionStatus } from '../game/onlineClient';
import { RoomSnapshot } from '../game/multiplayer';
import {
  AtmosphereMode,
  TitlePreviewAngle,
  VehicleId,
  VehicleMods,
} from '../game/types';
import {
  applyVehicleMods,
  FRONT_LIP_OPTIONS,
  HEADLIGHT_HOUSING_OPTIONS,
  HEADLIGHT_PRESETS,
  RIM_OPTIONS,
  SPOILER_OPTIONS,
  SUSPENSION_OPTIONS,
  TUNING_OPTIONS,
  VEHICLE_LIST,
  VEHICLES,
  WINDOW_TINT_OPTIONS,
} from '../game/vehicles';

export type GarageTab = 'car' | 'mods' | 'online';

interface TitleOverlayProps {
  activeTab: GarageTab;
  selectedVehicleId: VehicleId;
  selectedPaintHex: string;
  mods: VehicleMods;
  atmosphere: AtmosphereMode;
  previewAngle: TitlePreviewAngle;
  previewHeadlightsOn: boolean;
  bestScore: number;
  playerName: string;
  joinCodeInput: string;
  onlineStatus: OnlineConnectionStatus;
  onlineError: string | null;
  onlineRoom: RoomSnapshot | null;
  onlinePlayerId: string | null;
  isHost: boolean;
  onTabChange: (tab: GarageTab) => void;
  onSelectVehicle: (id: VehicleId) => void;
  onSelectPaint: (hex: string) => void;
  onUpdateMods: (patch: Partial<VehicleMods>) => void;
  onResetMods: () => void;
  onSelectAtmosphere: (mode: AtmosphereMode) => void;
  onPreviewAngleChange: (angle: TitlePreviewAngle) => void;
  onTogglePreviewHeadlights: () => void;
  onPlayerNameChange: (name: string) => void;
  onJoinCodeInputChange: (code: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onLeaveRoom: () => void;
  onStart: () => void;
}

const ATMOSPHERES: { id: AtmosphereMode; label: string }[] = [
  { id: 'afternoon', label: 'Boğaz Güneşi' },
  { id: 'sunset', label: 'Gün Batımı' },
  { id: 'night', label: 'Gece Sürüşü' },
];

export function TitleOverlay({
  activeTab,
  selectedVehicleId,
  selectedPaintHex,
  mods,
  atmosphere,
  previewAngle,
  previewHeadlightsOn,
  bestScore,
  playerName,
  joinCodeInput,
  onlineStatus,
  onlineError,
  onlineRoom,
  onlinePlayerId,
  isHost,
  onTabChange,
  onSelectVehicle,
  onSelectPaint,
  onUpdateMods,
  onResetMods,
  onSelectAtmosphere,
  onPreviewAngleChange,
  onTogglePreviewHeadlights,
  onPlayerNameChange,
  onJoinCodeInputChange,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onStart,
}: TitleOverlayProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);

  const baseSpec = VEHICLES[selectedVehicleId];
  const tunedSpec = applyVehicleMods(baseSpec, mods);
  const canEditAtmo = !onlineRoom || isHost;

  const handleCopyInvite = async () => {
    if (!onlineRoom) return;
    const url = `${window.location.origin}${window.location.pathname}?oda=${onlineRoom.roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 1800);
    } catch {
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 1800);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Left gradient scrim preserving wide 3D viewport on right */}
      <div
        className="absolute inset-y-0 left-0 w-full md:w-[570px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(9,9,11,0.94) 0%, rgba(9,9,11,0.78) 68%, rgba(9,9,11,0) 100%)',
        }}
      />

      {/* Top-Right Showcase Camera & Headlight Preview Controls */}
      <div className="relative z-20 hidden sm:flex items-center gap-2 self-end px-6 pt-5 pointer-events-auto">
        <div
          className="flex items-center gap-1 p-1 rounded-lg border border-white/10"
          style={{ backgroundColor: 'rgba(12, 14, 18, 0.86)' }}
        >
          <button
            type="button"
            onClick={() => onPreviewAngleChange('front')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              previewAngle === 'front'
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            Ön · Farlar
          </button>
          <button
            type="button"
            onClick={() => onPreviewAngleChange('rear')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              previewAngle === 'rear'
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            Arka · Köprü
          </button>
        </div>

        <button
          type="button"
          onClick={onTogglePreviewHeadlights}
          aria-label="Önizleme farlarını aç veya kapat"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
            previewHeadlightsOn
              ? 'border-sky-400/70 text-sky-300'
              : 'border-white/15 text-zinc-300 hover:text-white'
          }`}
          style={{ backgroundColor: 'rgba(12, 14, 18, 0.86)' }}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>{previewHeadlightsOn ? 'Farlar Açık' : 'Farlar Kapalı'}</span>
        </button>
      </div>

      {/* Main Left Selection & Garage Column */}
      <div className="relative z-10 flex flex-col justify-start md:justify-center flex-1 px-4 sm:px-9 py-4 sm:py-5 max-w-[500px] overflow-y-auto pointer-events-auto">
        {/* Bespoke Inline SVG Title Emblem */}
        <div className="mb-3.5">
          <svg
            viewBox="0 0 360 68"
            className="w-[270px] sm:w-[330px] h-auto"
            role="img"
            aria-label="Anadolu Sürüş"
          >
            <rect
              x="2"
              y="6"
              width="52"
              height="52"
              rx="10"
              fill="#18181b"
              stroke="#dc2626"
              strokeWidth="2.5"
            />
            <path d="M12 44 Q28 14 44 44" fill="none" stroke="#f4f4f5" strokeWidth="2.4" />
            <line x1="19" y1="21" x2="19" y2="48" stroke="#dc2626" strokeWidth="2.5" />
            <line x1="37" y1="21" x2="37" y2="48" stroke="#dc2626" strokeWidth="2.5" />
            <circle cx="28" cy="36" r="6.5" fill="none" stroke="#f8fafc" strokeWidth="2" />
            <text
              x="68"
              y="34"
              fill="#f8fafc"
              fontFamily="Oxanium, system-ui, sans-serif"
              fontWeight="700"
              fontSize="27"
              letterSpacing="1.4"
            >
              ANADOLU SÜRÜŞ
            </text>
            <text
              x="69"
              y="53"
              fill="#a1a1aa"
              fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
              fontWeight="500"
              fontSize="12"
              letterSpacing="0.8"
            >
              TÜRKİYE OTOYOLU · KOKPİT &amp; ONLİNE
            </text>
          </svg>
        </div>

        {/* Mobile quick preview toggles */}
        <div className="flex sm:hidden items-center gap-1.5 mb-2.5">
          <button
            type="button"
            onClick={() =>
              onPreviewAngleChange(previewAngle === 'front' ? 'rear' : 'front')
            }
            className="flex-1 py-1.5 px-2.5 rounded-lg border border-zinc-700 bg-zinc-900/90 text-xs font-medium text-zinc-200 cursor-pointer"
          >
            Kamera: {previewAngle === 'front' ? 'Ön (Farlar)' : 'Arka (Köprü)'}
          </button>
          <button
            type="button"
            onClick={onTogglePreviewHeadlights}
            className={`py-1.5 px-3 rounded-lg border text-xs font-medium cursor-pointer ${
              previewHeadlightsOn
                ? 'border-sky-400/70 bg-zinc-900/90 text-sky-300'
                : 'border-zinc-700 bg-zinc-900/90 text-zinc-300'
            }`}
          >
            {previewHeadlightsOn ? 'Far: Açık' : 'Far: Kapalı'}
          </button>
        </div>

        {/* Garage Section Tabs */}
        <div
          className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 rounded-lg p-1 mb-3"
          role="tablist"
          aria-label="Garaj bölümleri"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'car'}
            onClick={() => onTabChange('car')}
            className={`flex-1 py-2 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'car'
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            Araç &amp; Ortam
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mods'}
            onClick={() => {
              onTabChange('mods');
              onPreviewAngleChange('front');
            }}
            className={`flex-1 py-2 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'mods'
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            Far &amp; Modifiye
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'online'}
            onClick={() => onTabChange('online')}
            className={`flex-1 py-2 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'online'
                ? 'bg-emerald-500 text-zinc-950'
                : onlineRoom
                  ? 'text-emerald-400 hover:text-emerald-300'
                  : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>
              {onlineRoom ? `Online (${onlineRoom.players.length})` : 'Online Oda'}
            </span>
          </button>
        </div>

        {/* TAB 1: Vehicle Selection & Atmosphere */}
        {activeTab === 'car' && (
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-semibold tracking-wider text-zinc-400">
                ARAÇ SEÇİMİ
              </h2>
              {bestScore > 0 && (
                <span className="text-xs font-medium text-amber-400 tabular-nums">
                  Rekor: {bestScore.toLocaleString('tr-TR')} puan
                </span>
              )}
            </div>

            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Araç modelleri"
            >
              {VEHICLE_LIST.map((v) => {
                const selected = v.id === selectedVehicleId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelectVehicle(v.id)}
                    className={`text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-zinc-900/95 border-red-500 text-zinc-50'
                        : 'bg-zinc-900/75 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-display font-bold text-sm tracking-wide truncate">
                      {v.brand} {v.model}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {v.subtitle} · {v.horsePower} HP
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bg-zinc-900/85 border border-zinc-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-300">
                <span className="font-medium truncate">
                  {tunedSpec.horsePower} HP · Maks {tunedSpec.maxSpeedKmh} km/s
                </span>
                <span className="font-mono text-zinc-400 tabular-nums">
                  {baseSpec.plateText}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-400">Gövde Rengi</span>
                <div className="flex items-center gap-2">
                  {baseSpec.paints.map((p) => {
                    const isCurrent =
                      p.hex.toLowerCase() === selectedPaintHex.toLowerCase();
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        aria-label={`Renk: ${p.name}`}
                        title={p.name}
                        onClick={() => onSelectPaint(p.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          isCurrent
                            ? 'border-white scale-110'
                            : 'border-zinc-700 hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.hex }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Hava &amp; Saat</span>
                {!canEditAtmo && (
                  <span className="text-amber-400">Oda kurucusu seçer</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-900/85 border border-zinc-800 rounded-lg p-1">
                {ATMOSPHERES.map((a) => {
                  const active = atmosphere === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!canEditAtmo}
                      onClick={() => onSelectAtmosphere(a.id)}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-zinc-100 text-zinc-950'
                          : 'text-zinc-300 hover:text-white'
                      } ${!canEditAtmo ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Headlights & Car Modification Studio */}
        {activeTab === 'mods' && (
          <div className="bg-zinc-900/88 border border-zinc-800 rounded-lg p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-200">
                {baseSpec.brand} {baseSpec.model} · Modifiye
              </span>
              <button
                type="button"
                onClick={onResetMods}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Sıfırla</span>
              </button>
            </div>

            {/* Far Rengi / Tipi */}
            <div className="space-y-1">
              <div className="text-[11px] text-zinc-400">Far Ampulü &amp; Işık Rengi</div>
              <div className="grid grid-cols-2 gap-1.5">
                {HEADLIGHT_PRESETS.map((hl) => {
                  const active = mods.headlightColor === hl.id;
                  return (
                    <button
                      key={hl.id}
                      type="button"
                      onClick={() => {
                        onUpdateMods({ headlightColor: hl.id });
                        onPreviewAngleChange('front');
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left cursor-pointer ${
                        active
                          ? 'border-sky-400 bg-zinc-800 text-white'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                        style={{ backgroundColor: hl.swatchHex }}
                      />
                      <span className="truncate">{hl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Far Kasası & Ön Lip */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-[11px] text-zinc-400">Far İçi &amp; Angel LED</div>
                <div className="flex gap-1">
                  {HEADLIGHT_HOUSING_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onUpdateMods({ headlightHousing: opt.id });
                        onPreviewAngleChange('front');
                      }}
                      className={`flex-1 py-1.5 px-1.5 rounded border text-[11px] font-medium cursor-pointer ${
                        mods.headlightHousing === opt.id
                          ? 'border-sky-400 bg-zinc-800 text-white'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-zinc-400">Ön Tampon &amp; Sis</div>
                <div className="flex gap-1">
                  {FRONT_LIP_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onUpdateMods({ frontLip: opt.id });
                        onPreviewAngleChange('front');
                      }}
                      className={`flex-1 py-1.5 px-1.5 rounded border text-[11px] font-medium cursor-pointer ${
                        mods.frontLip === opt.id
                          ? 'border-sky-400 bg-zinc-800 text-white'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Jant Modeli */}
            <div className="space-y-1">
              <div className="text-[11px] text-zinc-400">Jant Modeli</div>
              <div className="grid grid-cols-4 gap-1">
                {RIM_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateMods({ rimStyle: opt.id })}
                    className={`py-1.5 px-1 rounded border text-[11px] font-medium cursor-pointer ${
                      mods.rimStyle === opt.id
                        ? 'border-amber-400 bg-zinc-800 text-amber-200'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Arka Rüzgarlık */}
            <div className="space-y-1">
              <div className="text-[11px] text-zinc-400">Arka Rüzgarlık (Spoiler)</div>
              <div className="grid grid-cols-3 gap-1">
                {SPOILER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onUpdateMods({ spoiler: opt.id });
                      onPreviewAngleChange('rear');
                    }}
                    className={`py-1.5 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                      mods.spoiler === opt.id
                        ? 'border-red-400 bg-zinc-800 text-white'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Süspansiyon & Cam Filmi */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-[11px] text-zinc-400">Süspansiyon</div>
                <div className="flex gap-1">
                  {SUSPENSION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateMods({ suspension: opt.id })}
                      className={`flex-1 py-1.5 px-1.5 rounded border text-[11px] font-medium cursor-pointer ${
                        mods.suspension === opt.id
                          ? 'border-emerald-400 bg-zinc-800 text-emerald-200'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-zinc-400">Cam Filmi</div>
                <div className="flex gap-1">
                  {WINDOW_TINT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateMods({ windowTint: opt.id })}
                      className={`flex-1 py-1.5 px-1.5 rounded border text-[11px] font-medium cursor-pointer ${
                        mods.windowTint === opt.id
                          ? 'border-emerald-400 bg-zinc-800 text-emerald-200'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Motor Yazılımı */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Performans Yazılımı</span>
                <span className="text-emerald-400 font-semibold tabular-nums">
                  {tunedSpec.horsePower} HP · {tunedSpec.maxSpeedKmh} km/s
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {TUNING_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateMods({ tuningStage: opt.id })}
                    className={`py-1.5 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                      mods.tuningStage === opt.id
                        ? 'border-red-500 bg-zinc-800 text-white'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
                    }`}
                  >
                    {opt.label} ({opt.note})
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Online Multiplayer Lobby */}
        {activeTab === 'online' && (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3.5 space-y-3 text-xs">
            <div>
              <label
                htmlFor="driver-name-input"
                className="block text-[11px] text-zinc-400 mb-1"
              >
                Sürücü Adın
              </label>
              <input
                id="driver-name-input"
                type="text"
                maxLength={18}
                value={playerName}
                onChange={(e) => onPlayerNameChange(e.target.value)}
                placeholder="Örn. Ahmet"
                disabled={Boolean(onlineRoom)}
                className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400 disabled:opacity-65"
              />
            </div>

            {!onlineRoom ? (
              <>
                <button
                  type="button"
                  onClick={onCreateRoom}
                  disabled={onlineStatus === 'connecting'}
                  className="w-full py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-sm cursor-pointer disabled:opacity-60"
                >
                  {onlineStatus === 'connecting'
                    ? 'Bağlanıyor...'
                    : 'Yeni Online Oda Kur'}
                </button>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    aria-label="Oda kodu"
                    maxLength={8}
                    value={joinCodeInput}
                    onChange={(e) =>
                      onJoinCodeInputChange(e.target.value.toUpperCase())
                    }
                    placeholder="ODA KODU (örn. IST42)"
                    className="flex-1 px-3 py-2 rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 font-mono tracking-wider uppercase placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    onClick={onJoinRoom}
                    disabled={onlineStatus === 'connecting'}
                    className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 font-semibold cursor-pointer"
                  >
                    Katıl
                  </button>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Oda kurup davet linkini veya oda kodunu arkadaşına gönder. Aynı
                  otoyolda yan yana sür, selektör ve korna ile haberleş!
                </p>
              </>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-zinc-950 border border-emerald-500/40">
                  <div>
                    <div className="text-[11px] text-zinc-400">Oda Kodu</div>
                    <div
                      data-testid="online-room-code"
                      className="font-display font-bold text-lg tracking-widest text-emerald-400"
                    >
                      {onlineRoom.roomCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium cursor-pointer"
                  >
                    {copiedInvite ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Kopyalandı</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Davet Linki</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <div className="text-[11px] text-zinc-400 mb-1.5">
                    Odadaki Sürücüler ({onlineRoom.players.length}/6)
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {onlineRoom.players.map((p) => {
                      const vSpec = VEHICLES[p.vehicleId];
                      const isSelf = p.id === onlinePlayerId;
                      const isRoomHost = p.id === onlineRoom.hostId;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded bg-zinc-950/80 border border-zinc-800"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: p.paintHex }}
                            />
                            <span className="font-medium text-zinc-100 truncate">
                              {p.name}
                              {isSelf ? ' (Sen)' : ''}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400 shrink-0 ml-2">
                            {vSpec.brand} {vSpec.model.split(' ')[0]}
                            {isRoomHost ? ' · Kurucu' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  {!isHost && !onlineRoom.started && (
                    <span className="text-[11px] text-amber-300">
                      Kurucunun konvoyu başlatması bekleniyor...
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onLeaveRoom}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Odadan Ayrıl</span>
                  </button>
                </div>
              </div>
            )}

            {onlineError && (
              <div className="px-2.5 py-1.5 rounded bg-red-950/80 border border-red-500/40 text-red-300 text-[11px]">
                {onlineError}
              </div>
            )}
          </div>
        )}

        {/* Primary Start Action */}
        <div className="mt-3">
          {onlineRoom ? (
            isHost ? (
              <button
                type="button"
                data-start="true"
                onClick={onStart}
                className="w-full py-3 px-6 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-display font-bold text-base tracking-wide transition-colors cursor-pointer"
              >
                Konvoyu Başlat ({onlineRoom.players.length} Oyuncu)
              </button>
            ) : onlineRoom.started ? (
              <button
                type="button"
                data-start="true"
                onClick={onStart}
                className="w-full py-3 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-base tracking-wide transition-colors cursor-pointer"
              >
                Yarışa Katıl (Kokpit)
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-3 px-6 rounded-lg bg-zinc-800 text-zinc-400 font-display font-bold text-sm tracking-wide cursor-not-allowed"
              >
                Kurucunun Başlatması Bekleniyor
              </button>
            )
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="w-full py-3 px-6 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-display font-bold text-base tracking-wide transition-colors cursor-pointer"
            >
              Sürüşe Başla (Kokpit Kamerası)
            </button>
          )}
        </div>
      </div>

      {/* Flat inline control hint at bottom safe margin */}
      <div className="relative z-10 px-6 sm:px-9 pb-3 text-xs text-zinc-300/90 pointer-events-none">
        <span className="sm:hidden">Dokunmatik direksiyon ve pedallarla sürüş</span>
        <span className="hidden sm:inline">
          W/S veya ↑/↓ Gaz-Fren · A/D Direksiyon · C Kamera · L Far (Kısa/Uzun) · F Selektör · Z/X Sinyal · H Korna
        </span>
      </div>
    </div>
  );
}
