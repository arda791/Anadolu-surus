import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { InputState } from '../game/types';

interface MobileDrivingControlsProps {
  onControlChange: (control: keyof InputState, active: boolean) => void;
  onHonk: () => void;
}

interface TouchButtonProps {
  controlKey: keyof InputState;
  label: string;
  className: string;
  onControlChange: (control: keyof InputState, active: boolean) => void;
  children: React.ReactNode;
}

function TouchHoldButton({
  controlKey,
  label,
  className,
  onControlChange,
  children,
}: TouchButtonProps) {
  const activePointers = useRef<Set<number>>(new Set());

  const handleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic pointer events without active pointerId
    }
    activePointers.current.add(e.pointerId);
    onControlChange(controlKey, true);
  };

  const handleRelease = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size === 0) {
      onControlChange(controlKey, false);
    }
  };

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      data-testid={`touch-${controlKey}`}
      onPointerDown={handleDown}
      onPointerUp={handleRelease}
      onPointerCancel={handleRelease}
      onLostPointerCapture={handleRelease}
      onContextMenu={(e) => e.preventDefault()}
      className={`touch-none select-none cursor-pointer transition-transform active:scale-95 ${className}`}
      style={{ backgroundColor: 'rgba(12, 14, 18, 0.86)' }}
    >
      {children}
    </button>
  );
}

export function MobileDrivingControls({
  onControlChange,
  onHonk,
}: MobileDrivingControlsProps) {
  return (
    <div className="flex items-end justify-between w-full gap-3 pointer-events-none">
      {/* Left Hand: Steering Buttons (Sol / Sağ) + Compact Horn */}
      <div className="flex items-end gap-2 pointer-events-auto">
        <TouchHoldButton
          controlKey="left"
          label="Sola dön"
          onControlChange={onControlChange}
          className="w-16 h-16 rounded-xl border border-white/20 text-zinc-100 flex items-center justify-center active:border-sky-400 active:text-sky-300"
        >
          <ChevronLeft className="w-8 h-8" />
        </TouchHoldButton>

        <TouchHoldButton
          controlKey="right"
          label="Sağa dön"
          onControlChange={onControlChange}
          className="w-16 h-16 rounded-xl border border-white/20 text-zinc-100 flex items-center justify-center active:border-sky-400 active:text-sky-300"
        >
          <ChevronRight className="w-8 h-8" />
        </TouchHoldButton>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Korna çal"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onHonk();
          }}
          className="touch-none select-none h-11 px-3 rounded-lg border border-white/15 text-xs font-semibold text-zinc-300 active:scale-95 cursor-pointer"
          style={{ backgroundColor: 'rgba(12, 14, 18, 0.84)' }}
        >
          Korna
        </button>
      </div>

      {/* Right Hand: Brake & Throttle Pedals (Fren / Gaz) */}
      <div className="flex items-end gap-2.5 pointer-events-auto">
        <TouchHoldButton
          controlKey="brake"
          label="Fren ve geri"
          onControlChange={onControlChange}
          className="w-15 h-16 rounded-xl border border-red-500/45 text-red-300 flex flex-col items-center justify-center gap-0.5 active:border-red-400"
        >
          <span className="font-display font-bold text-xs tracking-wide">FREN</span>
        </TouchHoldButton>

        <TouchHoldButton
          controlKey="throttle"
          label="Gaz pedalı"
          onControlChange={onControlChange}
          className="w-16 h-20 rounded-xl border border-emerald-500/50 text-emerald-300 flex flex-col items-center justify-center gap-0.5 active:border-emerald-400"
        >
          <span className="font-display font-bold text-sm tracking-wide">GAZ</span>
        </TouchHoldButton>
      </div>
    </div>
  );
}
