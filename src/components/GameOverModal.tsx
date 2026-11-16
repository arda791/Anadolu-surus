import { HudSnapshot } from '../game/types';

interface GameOverModalProps {
  stats: HudSnapshot;
  vehicleTitle: string;
  onRetry: () => void;
  onBackToTitle: () => void;
}

export function GameOverModal({
  stats,
  vehicleTitle,
  onRetry,
  onBackToTitle,
}: GameOverModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 9, 11, 0.84)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
        <div>
          <p className="text-xs font-semibold text-red-400 tracking-wider">
            {vehicleTitle}
          </p>
          <h2 id="gameover-title" className="font-display font-bold text-2xl text-white mt-1">
            Araç Hasar Aldı · Sürüş Tamamlandı
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 tabular-nums">
          <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3">
            <div className="text-xs text-zinc-400">Kat Edilen Mesafe</div>
            <div className="font-display font-bold text-xl text-white mt-0.5">
              {stats.distanceKm.toFixed(2)} km
            </div>
          </div>
          <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3">
            <div className="text-xs text-zinc-400">En Yüksek Hız</div>
            <div className="font-display font-bold text-xl text-sky-400 mt-0.5">
              {stats.maxSpeedKmh} km/s
            </div>
          </div>
          <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3">
            <div className="text-xs text-zinc-400">Yakın Geçiş</div>
            <div className="font-display font-bold text-xl text-amber-400 mt-0.5">
              {stats.nearMissCount}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3">
            <div className="text-xs text-zinc-400">Toplam Puan / Rekor</div>
            <div className="font-display font-bold text-xl text-emerald-400 mt-0.5">
              {stats.score.toLocaleString('tr-TR')}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onRetry}
            className="flex-1 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm tracking-wide transition-colors cursor-pointer"
          >
            Tekrar Sür
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="py-3 px-4 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-200 font-medium text-sm transition-colors cursor-pointer"
          >
            Araç Değiştir
          </button>
        </div>
      </div>
    </div>
  );
}
