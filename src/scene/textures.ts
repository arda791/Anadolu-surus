import * as THREE from 'three';

export function createAsphaltTextures(maxAniso: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 1024;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base dark weathered Turkish highway asphalt
  ctx.fillStyle = '#2c2f34';
  ctx.fillRect(0, 0, width, height);

  // Subtle aggregate noise & worn wheel tracks per lane
  const laneXFracs = [0.16, 0.386, 0.613, 0.84];
  for (const frac of laneXFracs) {
    const cx = frac * width;
    const trackGrad = ctx.createLinearGradient(cx - 58, 0, cx + 58, 0);
    trackGrad.addColorStop(0, 'rgba(18,20,23,0)');
    trackGrad.addColorStop(0.28, 'rgba(18,20,23,0.28)');
    trackGrad.addColorStop(0.5, 'rgba(32,35,40,0.08)');
    trackGrad.addColorStop(0.72, 'rgba(18,20,23,0.28)');
    trackGrad.addColorStop(1, 'rgba(18,20,23,0)');
    ctx.fillStyle = trackGrad;
    ctx.fillRect(cx - 60, 0, 120, height);
  }

  // Deterministic asphalt speckles
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 16000; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const v = 35 + Math.floor(rand() * 34);
    ctx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Outer solid shoulder lines (Emniyet Seridi)
  ctx.fillStyle = '#e8eaed';
  ctx.fillRect(42, 0, 11, height);
  ctx.fillRect(width - 53, 0, 11, height);

  // Red-white rumble edge markers along extreme border
  for (let y = 0; y < height; y += 64) {
    ctx.fillStyle = (y / 64) % 2 === 0 ? '#b91c1c' : '#e5e7eb';
    ctx.fillRect(10, y, 16, 64);
    ctx.fillRect(width - 26, y, 16, 64);
  }

  // Dashed white lane dividers between the 4 lanes
  const dividerXs = [width * 0.273, width * 0.5, width * 0.727];
  ctx.fillStyle = '#f1f3f5';
  for (const dx of dividerXs) {
    for (let y = 32; y < height; y += 256) {
      ctx.fillRect(dx - 5, y, 10, 120);
    }
  }

  // Center highway double-dashed or yellow caution stripe subtle accent
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAniso;

  // Grayscale bump map for asphalt grain
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const g = Math.floor(90 + rand() * 75);
    bCtx.fillStyle = `rgb(${g},${g},${g})`;
    bCtx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(8, 24);

  return { map, bumpMap };
}

export function createPlateTexture(
  plateText: string,
  maxAniso: number,
  isPolice = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isPolice ? '#103b7a' : '#f8fafc';
  ctx.fillRect(0, 0, 256, 64);

  // Border
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);

  // Left blue TR strip
  ctx.fillStyle = '#0f47af';
  ctx.fillRect(4, 4, 34, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TR', 21, 40);

  // Plate text
  ctx.fillStyle = isPolice ? '#ffffff' : '#111827';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(plateText, 146, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createHighwaySignTexture(
  header: string,
  lines: string[],
  variant: 'otoyol' | 'sehir' | 'hgs' | 'tesis',
  maxAniso: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 224;
  const ctx = canvas.getContext('2d')!;

  const bg =
    variant === 'otoyol'
      ? '#0d6b3b'
      : variant === 'sehir'
        ? '#0d4e96'
        : variant === 'hgs'
          ? '#12305b'
          : '#b91c1c';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 224);

  // White reflective inner border
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 204);

  if (variant === 'hgs') {
    // Orange HGS badge strip
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(22, 22, 130, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HGS', 87, 62);

    ctx.textAlign = 'left';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(header, 168, 60);
  } else {
    ctx.fillStyle = variant === 'tesis' ? '#fef08a' : '#d1fae5';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(header, 256, 52);
  }

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  lines.forEach((line, idx) => {
    ctx.font = idx === 0 ? 'bold 36px sans-serif' : '600 28px sans-serif';
    ctx.fillText(line, 256, 112 + idx * 44);
  });

  // Downward highway lane arrows
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('▼        ▼        ▼', 256, 202);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createTurkishFlagTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e30a17';
  ctx.fillRect(0, 0, 384, 256);

  // Outer white crescent circle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(138, 128, 64, 0, Math.PI * 2);
  ctx.fill();

  // Inner red cutout
  ctx.fillStyle = '#e30a17';
  ctx.beginPath();
  ctx.arc(154, 128, 51, 0, Math.PI * 2);
  ctx.fill();

  // 5-pointed star
  ctx.fillStyle = '#ffffff';
  ctx.save();
  ctx.translate(218, 128);
  ctx.rotate(-Math.PI / 10);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    const ox = Math.cos(outerAngle) * 26;
    const oy = Math.sin(outerAngle) * 26;
    const ix = Math.cos(innerAngle) * 10.5;
    const iy = Math.sin(innerAngle) * 10.5;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.72)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function createHeadlightThrowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 512);

  // Twin overlapping asymmetrical low/high beam light cones projected onto asphalt
  // Note: Canvas top (y=0) maps to far forward (-Z), bottom (y=512) maps to front bumper
  for (const cx of [86, 170]) {
    const beamGrad = ctx.createLinearGradient(cx, 500, cx, 12);
    beamGrad.addColorStop(0, 'rgba(255,255,255,0.88)');
    beamGrad.addColorStop(0.28, 'rgba(255,255,255,0.52)');
    beamGrad.addColorStop(0.7, 'rgba(255,255,255,0.16)');
    beamGrad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 12, 505);
    ctx.lineTo(cx + 12, 505);
    ctx.lineTo(cx + 68, 10);
    ctx.lineTo(cx - 68, 10);
    ctx.closePath();
    ctx.fill();
  }

  // Soft radial edge feathering horizontally
  ctx.globalCompositeOperation = 'destination-in';
  const maskGrad = ctx.createRadialGradient(128, 340, 26, 128, 256, 230);
  maskGrad.addColorStop(0, 'rgba(255,255,255,1)');
  maskGrad.addColorStop(0.65, 'rgba(255,255,255,0.7)');
  maskGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = maskGrad;
  ctx.fillRect(0, 0, 256, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CockpitDisplayController {
  public readonly clusterTexture: THREE.CanvasTexture;
  public readonly infotainmentTexture: THREE.CanvasTexture;
  private clusterCanvas: HTMLCanvasElement;
  private clusterCtx: CanvasRenderingContext2D;
  private infoCanvas: HTMLCanvasElement;
  private infoCtx: CanvasRenderingContext2D;
  private style: 'modern_ev' | 'modern_sedan' | 'classic_analog';
  private lastDrawTime = -1;

  constructor(
    style: 'modern_ev' | 'modern_sedan' | 'classic_analog',
    brandLabel: string,
    maxAniso: number,
  ) {
    this.style = style;

    this.clusterCanvas = document.createElement('canvas');
    this.clusterCanvas.width = 512;
    this.clusterCanvas.height = 224;
    this.clusterCtx = this.clusterCanvas.getContext('2d')!;

    this.clusterTexture = new THREE.CanvasTexture(this.clusterCanvas);
    this.clusterTexture.colorSpace = THREE.SRGBColorSpace;
    this.clusterTexture.anisotropy = maxAniso;

    this.infoCanvas = document.createElement('canvas');
    this.infoCanvas.width = 384;
    this.infoCanvas.height = 224;
    this.infoCtx = this.infoCanvas.getContext('2d')!;

    this.infotainmentTexture = new THREE.CanvasTexture(this.infoCanvas);
    this.infotainmentTexture.colorSpace = THREE.SRGBColorSpace;
    this.infotainmentTexture.anisotropy = maxAniso;

    this.drawInfotainment(brandLabel, 0);
    this.updateCluster(0, 900, 1, false, false, false, false, 0);
  }

  public updateCluster(
    speedKmh: number,
    rpm: number,
    gear: number,
    leftSignal: boolean,
    rightSignal: boolean,
    headlights: boolean,
    highBeam: boolean,
    elapsedSec: number,
  ): void {
    // Throttle texture upload to ~24Hz for smooth CPU performance
    if (elapsedSec > 0 && elapsedSec - this.lastDrawTime < 0.04) {
      return;
    }
    this.lastDrawTime = elapsedSec;

    const ctx = this.clusterCtx;
    const w = 512;
    const h = 224;
    const blinkOn = Math.floor(elapsedSec * 2.4) % 2 === 0;

    if (this.style === 'classic_analog') {
      // Tofas Sahin 90s analog dual-dial cluster
      ctx.fillStyle = '#141312';
      ctx.fillRect(0, 0, w, h);

      // Left Speedometer Dial (0 - 200 km/h)
      this.drawAnalogDial(
        ctx,
        142,
        118,
        82,
        speedKmh / 200,
        ['0', '40', '80', '120', '160', '200'],
        '#f59e0b',
        '#fb923c',
        'KM/H',
      );

      // Right Tachometer Dial (0 - 7 x1000)
      this.drawAnalogDial(
        ctx,
        370,
        118,
        82,
        rpm / 7000,
        ['0', '1', '2', '3', '4', '5', '6', '7'],
        '#f59e0b',
        '#ef4444',
        'DEVİR x1000',
      );

      // Center indicator strip
      ctx.fillStyle = '#201e1c';
      ctx.fillRect(232, 64, 48, 108);
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(gear < 0 ? 'R' : String(gear), 256, 124);
    } else if (this.style === 'modern_ev') {
      // Togg T10X panoramic digital OLED cluster
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#07131e');
      grad.addColorStop(1, '#0b1c2c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Speed arc & digital readout
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(256, 130, 84, Math.PI * 0.78, Math.PI * 2.22);
      ctx.stroke();

      const speedFrac = Math.min(1, speedKmh / 220);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(
        256,
        130,
        84,
        Math.PI * 0.78,
        Math.PI * (0.78 + speedFrac * 1.44),
      );
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 58px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(speedKmh)), 256, 142);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('KM/S · D', 256, 168);

      // Left EV Power / Regen bar & Right Range
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(42, 160 - speedFrac * 96, 16, speedFrac * 96);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(42, 64, 16, 96);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('84% · 412 km', 476, 118);
      ctx.fillStyle = '#34d399';
      ctx.font = '600 13px sans-serif';
      ctx.fillText('T10X MENZİL', 476, 140);
    } else {
      // Fiat Egea / Renault Megane modern dual-dial + center TFT
      ctx.fillStyle = '#0c1017';
      ctx.fillRect(0, 0, w, h);

      this.drawAnalogDial(
        ctx,
        118,
        118,
        78,
        rpm / 7000,
        ['0', '1', '2', '3', '4', '5', '6', '7'],
        '#e2e8f0',
        '#ef4444',
        'x1000',
      );
      this.drawAnalogDial(
        ctx,
        394,
        118,
        78,
        speedKmh / 240,
        ['0', '40', '80', '120', '160', '200', '240'],
        '#e2e8f0',
        '#38bdf8',
        'km/h',
      );

      // Center TFT card
      ctx.fillStyle = '#151d29';
      ctx.fillRect(204, 48, 104, 134);
      ctx.strokeStyle = '#293548';
      ctx.lineWidth = 2;
      ctx.strokeRect(204, 48, 104, 134);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 38px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(speedKmh)), 256, 108);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`VİTES ${gear < 0 ? 'R' : gear}`, 256, 146);
    }

    // Turn signals & headlight indicators at top edge of cluster
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = leftSignal && blinkOn ? '#22c55e' : '#1f2937';
    ctx.fillText('◄', 190, 32);

    ctx.fillStyle = rightSignal && blinkOn ? '#22c55e' : '#1f2937';
    ctx.fillText('►', 322, 32);

    ctx.fillStyle = highBeam ? '#38bdf8' : headlights ? '#22c55e' : '#1f2937';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(highBeam ? 'UZUN FAR' : 'FAR', 256, 30);

    this.clusterTexture.needsUpdate = true;
  }

  private drawAnalogDial(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    frac: number,
    labels: string[],
    tickColor: string,
    needleColor: string,
    unit: string,
  ): void {
    const startA = Math.PI * 0.75;
    const endA = Math.PI * 2.25;

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startA, endA);
    ctx.stroke();

    ctx.fillStyle = tickColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const count = labels.length - 1;
    for (let i = 0; i <= count; i++) {
      const a = startA + (i / count) * (endA - startA);
      const tx = cx + Math.cos(a) * (r - 17);
      const ty = cy + Math.sin(a) * (r - 17);
      ctx.fillText(labels[i], tx, ty);
    }

    ctx.fillStyle = '#9ca3af';
    ctx.font = '600 11px sans-serif';
    ctx.fillText(unit, cx, cy + 32);

    // Needle
    const clamped = Math.max(0, Math.min(1, frac));
    const na = startA + clamped * (endA - startA);
    ctx.strokeStyle = needleColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * (r - 12), cy + Math.sin(na) * (r - 12));
    ctx.stroke();

    ctx.fillStyle = '#d1d5db';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  public drawInfotainment(brandLabel: string, km: number): void {
    const ctx = this.infoCtx;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 384, 224);

    if (this.style === 'classic_analog') {
      // Retro cassette & digital green clock face
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, 384, 224);
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, 364, 204);

      ctx.fillStyle = '#052e16';
      ctx.fillRect(42, 46, 300, 62);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TRT FM  91.4', 192, 86);

      ctx.fillStyle = '#a8a29e';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('TOFAŞ KASETÇALAR', 192, 162);
    } else {
      // Modern Navigation Map + Turkish Highway strip
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(14, 14, 210, 196);

      // Stylized Bosphorus & O-4 route line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(64, 190);
      ctx.quadraticCurveTo(130, 120, 118, 30);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(112, 114, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('O-4 ANKARA', 26, 44);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 13px sans-serif';
      ctx.fillText(`${km.toFixed(1)} km`, 26, 66);

      // Media card on right
      ctx.fillStyle = '#172554';
      ctx.fillRect(236, 14, 134, 196);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(brandLabel, 248, 46);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 13px sans-serif';
      ctx.fillText('TRT FM 91.4', 248, 86);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('İstanbul Trafik', 248, 112);
    }

    this.infotainmentTexture.needsUpdate = true;
  }

  public dispose(): void {
    this.clusterTexture.dispose();
    this.infotainmentTexture.dispose();
  }
}
