import {
  isCurrentlyPeak,
  isPromotionActive,
  getSecondsUntilNextChange,
  formatCountdown,
  getCurrentTimeInTz,
  getNowMs,
  getTimezoneList,
  detectTimezone,
  getPeriodProgress,
  getPeriodDayMarkers,
} from './time';

export function initUI(timezone: string, onTimezoneChange: (tz: string) => void): void {
  initTimezoneSelector(timezone, onTimezoneChange);
  updateUI(timezone);
}

function getGmtOffset(tz: string): string {
  const now = new Date();
  const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = now.toLocaleString('en-US', { timeZone: tz });
  const diffMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();
  const diffMin = Math.round(diffMs / 60000);
  const sign = diffMin >= 0 ? '+' : '\u2212';
  const absH = Math.floor(Math.abs(diffMin) / 60);
  const absM = Math.abs(diffMin) % 60;
  return absM ? `GMT${sign}${absH}:${String(absM).padStart(2, '0')}` : `GMT${sign}${absH}`;
}

function initTimezoneSelector(currentTz: string, onChange: (tz: string) => void): void {
  const select = document.getElementById('tz-select') as HTMLSelectElement;
  if (!select) return;

  const allZones = getTimezoneList();
  const detected = detectTimezone();

  const groups = new Map<string, string[]>();
  for (const tz of allZones) {
    const slash = tz.indexOf('/');
    const region = slash > -1 ? tz.substring(0, slash) : 'Other';
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region)!.push(tz);
  }

  if (detected) {
    const opt = document.createElement('option');
    opt.value = detected;
    const gmt = getGmtOffset(detected);
    opt.textContent = `${detected.replace(/_/g, ' ')} (${gmt})`;
    select.appendChild(opt);
  }

  const separator = document.createElement('option');
  separator.disabled = true;
  separator.textContent = '──────────────';
  select.appendChild(separator);

  for (const [region, zones] of groups) {
    if (region === 'Etc') continue;
    const optgroup = document.createElement('optgroup');
    optgroup.label = region;
    for (const tz of zones) {
      const opt = document.createElement('option');
      opt.value = tz;
      const city = tz.split('/').pop()!.replace(/_/g, ' ');
      const gmt = getGmtOffset(tz);
      opt.textContent = `${city} (${gmt})`;
      if (tz === currentTz && tz !== detected) opt.selected = true;
      optgroup.appendChild(opt);
    }
    select.appendChild(optgroup);
  }

  select.value = currentTz;
  select.addEventListener('change', () => onChange(select.value));
}


export function updateUI(timezone: string): void {
  const peak = isCurrentlyPeak();
  const promoStatus = isPromotionActive();

  // Status badge
  const badge = document.getElementById('status-badge');
  if (badge) {
    if (promoStatus !== 'active') {
      badge.textContent = 'INACTIVE';
      badge.className = 'status-badge inactive';
    } else if (peak) {
      badge.textContent = 'NORMAL RATE';
      badge.className = 'status-badge peak';
    } else {
      badge.textContent = '2\u00d7 USAGE';
      badge.className = 'status-badge offpeak';
    }
  }

  // Status description
  const desc = document.getElementById('status-desc');
  if (desc) {
    if (promoStatus === 'upcoming') {
      desc.textContent = 'Promotion starts March 13, 2026';
    } else if (promoStatus === 'ended') {
      desc.textContent = 'Promotion ended March 27, 2026';
    } else if (peak) {
      desc.textContent = 'Peak hours, normal rate applies.';
    } else {
      desc.textContent = 'Off-peak hours, double usage rate';
    }
  }

  // Countdown
  const countdown = document.getElementById('countdown');
  if (countdown) {
    if (promoStatus !== 'active') {
      countdown.textContent = '';
    } else {
      const secs = getSecondsUntilNextChange();
      const nextState = peak ? '2\u00d7 off-peak' : 'next peak';
      countdown.textContent = `${nextState} in ${formatCountdown(secs)}`;
      countdown.style.color = peak ? 'var(--offpeak-green)' : 'var(--text-secondary)';
    }
  }

  // Progress bar
  const progressFill = document.getElementById('progress-fill');
  const progressMarkers = document.getElementById('progress-markers');
  if (progressFill) {
    if (promoStatus !== 'active') {
      progressFill.style.width = '0%';
    } else {
      const progress = getPeriodProgress();
      progressFill.style.width = `${(progress * 100).toFixed(1)}%`;
      progressFill.className = `progress-fill ${peak ? 'peak' : 'offpeak'}`;
    }
  }

  // Day boundary markers on progress bar
  if (progressMarkers) {
    const markers = promoStatus === 'active' ? getPeriodDayMarkers(timezone) : [];
    // Only rebuild if marker count changed
    if (progressMarkers.childElementCount !== markers.length) {
      progressMarkers.innerHTML = '';
      for (const marker of markers) {
        const el = document.createElement('div');
        el.className = 'progress-marker';
        el.style.left = `${(marker.position * 100).toFixed(1)}%`;
        el.innerHTML = `<div class="progress-marker-tick"></div><span class="progress-marker-label">${marker.label}</span>`;
        progressMarkers.appendChild(el);
      }
    } else {
      // Update positions
      const children = progressMarkers.children;
      for (let i = 0; i < markers.length; i++) {
        (children[i] as HTMLElement).style.left = `${(markers[i]!.position * 100).toFixed(1)}%`;
      }
    }
  }


  // Current time
  const timeDisplay = document.getElementById('current-time');
  if (timeDisplay) {
    const { hour, minute, second } = getCurrentTimeInTz(timezone);
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    timeDisplay.textContent = `${h}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} ${ampm}`;
  }


  // Promo dates
  const banner = document.getElementById('promo-banner');
  if (banner) {
    if (promoStatus === 'active') {
      banner.textContent = 'March 13\u201327, 2026';
      banner.className = 'date-range active';
    } else if (promoStatus === 'upcoming') {
      banner.textContent = 'Starts March 13, 2026';
      banner.className = 'date-range upcoming';
    } else {
      banner.textContent = 'Ended March 27, 2026';
      banner.className = 'date-range ended';
    }
  }

  // Campaign timeline "now" marker
  updateCampaignNow();
}

// ── Campaign timeline ──

const CAMPAIGN_START = new Date('2026-03-13T00:00:00-04:00');
const CAMPAIGN_END = new Date('2026-03-28T03:59:00-04:00'); // Mar 27 11:59 PM PT = Mar 28 3:59 AM ET
const CAMPAIGN_MS = CAMPAIGN_END.getTime() - CAMPAIGN_START.getTime();

let campaignBuilt = false;

export function buildCampaignTimeline(timezone: string): void {
  if (campaignBuilt) return;
  campaignBuilt = true;

  const track = document.getElementById('campaign-track');
  const markers = document.getElementById('campaign-markers');
  if (!track || !markers) return;

  // Build gradient: for each hour of the campaign, determine peak or off-peak
  const totalHours = Math.ceil(CAMPAIGN_MS / 3600000);
  const stops: string[] = [];
  const PEAK_TZ = 'America/New_York';

  for (let h = 0; h < totalHours; h++) {
    const t = new Date(CAMPAIGN_START.getTime() + h * 3600000);
    const pct = (h / totalHours) * 100;
    const nextPct = ((h + 1) / totalHours) * 100;

    // Check if this hour is peak (weekday 8-14 ET)
    const dayStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: PEAK_TZ }).format(t);
    const isWeekday = dayStr !== 'Sat' && dayStr !== 'Sun';
    const etHour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: PEAK_TZ }).format(t), 10);
    const isPeak = isWeekday && etHour >= 8 && etHour < 14;

    const color = isPeak ? 'rgba(200, 100, 80, 0.25)' : 'rgba(74, 154, 106, 0.2)';
    stops.push(`${color} ${pct}%`);
    stops.push(`${color} ${nextPct}%`);
  }

  track.style.background = `linear-gradient(to right, ${stops.join(', ')})`;

  // Day markers at midnight boundaries in user's timezone
  for (let day = 0; day <= 15; day++) {
    const midnight = new Date(CAMPAIGN_START.getTime() + day * 86400000);

    // Find the midnight in user's tz that falls near this campaign day
    // Get the local date at this point
    const localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(midnight);
    const localDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(midnight);
    const dayNum = parseInt(localDateStr.split('-')[2]!, 10);

    const pct = (day / 15) * 100;
    if (pct < 0 || pct > 100) continue;

    const etDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: PEAK_TZ }).format(midnight);
    const isWeekend = etDay === 'Sat' || etDay === 'Sun';

    const marker = document.createElement('div');
    marker.className = 'campaign-marker';
    marker.style.left = `${pct}%`;

    const label = day < 15 ? `${localDay} ${dayNum}` : '';
    marker.innerHTML = `<div class="campaign-marker-tick"></div><span class="campaign-marker-label${isWeekend ? ' weekend' : ''}">${label}</span>`;
    markers.appendChild(marker);
  }
}

function updateCampaignNow(): void {
  const nowMarker = document.getElementById('campaign-now');
  if (!nowMarker) return;

  const now = getNowMs();
  const pct = ((now - CAMPAIGN_START.getTime()) / CAMPAIGN_MS) * 100;

  if (pct < 0 || pct > 100) {
    nowMarker.style.display = 'none';
  } else {
    nowMarker.style.display = '';
    nowMarker.style.left = `${pct}%`;
  }
}
