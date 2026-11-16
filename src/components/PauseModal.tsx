interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onBackToTitle: () => void;
}

export function PauseModal({
  onResume,
  onRestart,
  onBackToTitle,
}: PauseModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 9, 11, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
        <div>
          <h2 id="pause-title" className="font-display font-bold text-2xl text-white">
            Sürüş Duraklatıldı
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Devam etmek veya araç değiştirmek için aşağıdan seçin.
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm tracking-wide transition-colors cursor-pointer"
          >
            Sürüşe Devam Et
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium text-sm transition-colors cursor-pointer"
          >
            Yeniden Başlat
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="w-full py-2.5 px-4 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-colors cursor-pointer"
          >
            Araç Seçimine Dön
          </button>
        </div>
      </div>
    </div>
  );
}
