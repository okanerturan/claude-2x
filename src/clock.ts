import { getCurrentTimeInTz, getLocalPeakWindow, isCurrentlyPeak } from './time';

const SIZE = 400;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = 172;
const INNER_R = 100;
const TICK_OUTER = 168;
const TICK_INNER_MAJOR = 148;
const TICK_INNER_MINOR = 155;
const LABEL_R = 133;

const SVG_NS = 'http://www.w3.org/2000/svg';

function hourToAngle(hour: number): number {
  return (hour / 24) * 2 * Math.PI - Math.PI / 2;
}

function polarToXY(angle: number, radius: number): { x: number; y: number } {
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
  };
}

function createArcPath(startHour: number, endHour: number, outerR: number, innerR: number): string {
  let span = endHour - startHour;
  if (span <= 0) span += 24;

  const startAngle = hourToAngle(startHour);
  const endAngle = hourToAngle(startHour + span);

  const outerStart = polarToXY(startAngle, outerR);
  const outerEnd = polarToXY(endAngle, outerR);
  const innerStart = polarToXY(endAngle, innerR);
  const innerEnd = polarToXY(startAngle, innerR);

  const largeArc = span > 12 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

export function createClock(container: HTMLElement, timezone: string, weekend = false): void {
  container.innerHTML = '';

  const svg = svgEl('svg', {
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    width: '100%',
    height: '100%',
  });
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '24-hour clock showing peak and off-peak rate periods');

  // Defs for gradients
  const defs = svgEl('defs');

  // Offpeak gradient
  const offpeakGrad = svgEl('radialGradient');
  offpeakGrad.setAttribute('id', 'offpeak-grad');
  offpeakGrad.setAttribute('cx', '50%');
  offpeakGrad.setAttribute('cy', '50%');
  offpeakGrad.setAttribute('r', '50%');
  const stop1 = svgEl('stop');
  stop1.setAttribute('offset', '40%');
  stop1.setAttribute('stop-color', '#a8c8b0');
  stop1.setAttribute('stop-opacity', '0.35');
  const stop2 = svgEl('stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', '#a8c8b0');
  stop2.setAttribute('stop-opacity', '0.18');
  offpeakGrad.appendChild(stop1);
  offpeakGrad.appendChild(stop2);
  defs.appendChild(offpeakGrad);

  // Hand glow filter
  const glow = svgEl('filter');
  glow.setAttribute('id', 'hand-glow');
  glow.setAttribute('filterUnits', 'userSpaceOnUse');
  glow.setAttribute('x', '0');
  glow.setAttribute('y', '0');
  glow.setAttribute('width', String(SIZE));
  glow.setAttribute('height', String(SIZE));
  const feBlur = svgEl('feGaussianBlur');
  feBlur.setAttribute('stdDeviation', '3');
  feBlur.setAttribute('result', 'blur');
  const feMerge = svgEl('feMerge');
  const feMergeNode1 = svgEl('feMergeNode');
  feMergeNode1.setAttribute('in', 'blur');
  const feMergeNode2 = svgEl('feMergeNode');
  feMergeNode2.setAttribute('in', 'SourceGraphic');
  feMerge.appendChild(feMergeNode1);
  feMerge.appendChild(feMergeNode2);
  glow.appendChild(feBlur);
  glow.appendChild(feMerge);
  defs.appendChild(glow);

  svg.appendChild(defs);

  // Outer background circle
  const bgOuter = svgEl('circle', {
    cx: CX, cy: CY, r: OUTER_R + 4,
    fill: 'none',
    stroke: 'var(--border-light)',
    'stroke-width': 1,
  });
  svg.appendChild(bgOuter);

  // Main ring background
  const bgRing = svgEl('circle', {
    cx: CX, cy: CY, r: OUTER_R,
    fill: 'var(--bg-white)',
    stroke: 'var(--border)',
    'stroke-width': 1,
  });
  svg.appendChild(bgRing);

  // Inner circle
  const innerCircle = svgEl('circle', {
    cx: CX, cy: CY, r: INNER_R,
    fill: 'var(--bg-cream)',
    stroke: 'var(--border)',
    'stroke-width': 1,
  });
  svg.appendChild(innerCircle);

  // Peak/off-peak arcs
  const peak = getLocalPeakWindow(timezone);

  if (weekend) {
    // Weekend: entire ring is green (off-peak all day)
    const fullPath = svgEl('circle', {
      cx: CX, cy: CY, r: OUTER_R,
      fill: 'url(#offpeak-grad)',
    });
    svg.appendChild(fullPath);
    // Re-draw inner circle on top
    const innerOverlay = svgEl('circle', {
      cx: CX, cy: CY, r: INNER_R,
      fill: 'var(--bg-cream)',
      stroke: 'var(--border)',
      'stroke-width': 1,
    });
    svg.appendChild(innerOverlay);
  } else {
    // Off-peak arc (2x)
    const offpeakPath = svgEl('path', {
      d: createArcPath(peak.end, peak.start, OUTER_R, INNER_R),
      fill: 'url(#offpeak-grad)',
      class: 'arc-offpeak',
    });
    svg.appendChild(offpeakPath);

    // Peak arc (1x) — reddish tint for restricted zone
    const peakPath = svgEl('path', {
      d: createArcPath(peak.start, peak.end, OUTER_R, INNER_R),
      fill: 'rgba(200, 100, 80, 0.12)',
      class: 'arc-peak',
    });
    svg.appendChild(peakPath);
  }

  // Boundary lines between peak/off-peak (weekdays only)
  if (weekend) { /* no boundaries on weekends */ }
  for (const boundaryHour of (weekend ? [] : [peak.start, peak.end])) {
    const angle = hourToAngle(boundaryHour);
    const outerPt = polarToXY(angle, OUTER_R + 4);
    const innerPt = polarToXY(angle, INNER_R - 3);
    const boundary = svgEl('line', {
      x1: innerPt.x, y1: innerPt.y,
      x2: outerPt.x, y2: outerPt.y,
      stroke: 'var(--text-primary)',
      'stroke-width': 1.5,
      'stroke-dasharray': '3 4',
      opacity: '0.6',
    });
    svg.appendChild(boundary);
  }

  // Hour ticks and labels
  for (let h = 0; h < 24; h++) {
    const angle = hourToAngle(h);
    const isMajor = h % 6 === 0;
    const isMinorMajor = h % 3 === 0 && !isMajor;
    const outerPt = polarToXY(angle, TICK_OUTER);
    const innerR = isMajor ? TICK_INNER_MAJOR : isMinorMajor ? TICK_INNER_MAJOR + 3 : TICK_INNER_MINOR;
    const innerPt = polarToXY(angle, innerR);

    const tick = svgEl('line', {
      x1: innerPt.x, y1: innerPt.y,
      x2: outerPt.x, y2: outerPt.y,
      stroke: isMajor ? 'var(--text-primary)' : isMinorMajor ? 'var(--text-secondary)' : 'var(--border)',
      'stroke-width': isMajor ? 2 : 1,
      'stroke-linecap': 'round',
    });
    svg.appendChild(tick);

    if (h % 3 === 0) {
      const labelPt = polarToXY(angle, LABEL_R);
      const label = svgEl('text', {
        x: labelPt.x, y: labelPt.y,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': isMajor ? '14' : '11',
        'font-weight': isMajor ? '600' : '500',
        fill: isMajor ? 'var(--text-primary)' : 'var(--text-secondary)',
        class: 'clock-label',
      });
      label.textContent = String(h).padStart(2, '0');
      svg.appendChild(label);
    }
  }

  // (rate labels removed for cleaner look)

  // Clock hand — color matches current state
  const handColor = (weekend || !isCurrentlyPeak()) ? 'var(--offpeak-green)' : 'var(--accent-orange)';
  const hand = svgEl('line', {
    x1: CX, y1: CY,
    x2: CX, y2: CY - OUTER_R + 10,
    stroke: handColor,
    'stroke-width': 2.5,
    'stroke-linecap': 'round',
    filter: 'url(#hand-glow)',
    id: 'clock-hand',
  });
  svg.appendChild(hand);

  // Center dot
  const dotOuter = svgEl('circle', {
    cx: CX, cy: CY, r: 7,
    fill: 'var(--bg-white)',
    stroke: handColor,
    'stroke-width': 2.5,
  });
  svg.appendChild(dotOuter);

  const dotInner = svgEl('circle', {
    cx: CX, cy: CY, r: 3,
    fill: handColor,
  });
  svg.appendChild(dotInner);

  // Outer time dot with glow ring
  const glowColor = handColor === 'var(--offpeak-green)' ? 'rgba(74, 154, 106, 0.1)' : 'rgba(217, 119, 87, 0.08)';
  const timeDotRing = svgEl('circle', {
    cx: CX, cy: CY - OUTER_R - 10,
    r: 10,
    fill: glowColor,
    stroke: 'none',
    id: 'time-dot-ring',
  });
  svg.appendChild(timeDotRing);

  const timeDot = svgEl('circle', {
    cx: CX, cy: CY - OUTER_R - 10,
    r: 5,
    fill: handColor,
    id: 'time-dot',
  });
  svg.appendChild(timeDot);

  container.appendChild(svg);
  updateClock(timezone);
}

export function updateClock(timezone: string): void {
  const { hour, minute, second } = getCurrentTimeInTz(timezone);
  const fractionalHour = hour + minute / 60 + second / 3600;
  const angle = hourToAngle(fractionalHour);

  const hand = document.getElementById('clock-hand');
  if (hand) {
    const endPt = polarToXY(angle, OUTER_R - 10);
    hand.setAttribute('x2', String(endPt.x));
    hand.setAttribute('y2', String(endPt.y));
  }

  const timeDot = document.getElementById('time-dot');
  if (timeDot) {
    const dotPt = polarToXY(angle, OUTER_R + 10);
    timeDot.setAttribute('cx', String(dotPt.x));
    timeDot.setAttribute('cy', String(dotPt.y));
  }

  const timeDotRing = document.getElementById('time-dot-ring');
  if (timeDotRing) {
    const ringPt = polarToXY(angle, OUTER_R + 10);
    timeDotRing.setAttribute('cx', String(ringPt.x));
    timeDotRing.setAttribute('cy', String(ringPt.y));
  }
}
