import {
  isCurrentlyPeak,
  isPromotionActive,
  getSecondsUntilNextChange,
  formatCountdown,
  getCurrentTimeInTz,
  getNowMs,
  getTimezoneList,
  getPeriodProgress,
  getPeriodDayMarkers,
} from './time';

const offpeakLines = [
  'This site was shipped in off-peak hours',
  'This line was also written by Claude',
  'You\'re reading AI-generated motivational copy',
  'Even this status text cost 2× tokens',
  'Claude built this page to tell you to use more Claude',
  'That SaaS stands no chance',
  'Accept all, read nothing',
  'Slop at scale, ship at speed',
  'The AI wrote this line too. And the next one.',
  'Who needs tests when you have vibes',
  'git push --force and pray',
  'The AI is mass-producing its own propaganda right now',
  'You are the PM now',
  'This clock was vibe-coded at 2AM during 2× hours',
  'The backlog can wait, the vibes cannot',
  'Your rate limit fears you right now',
  'None of the humans involved read the code',
  'This entire site is one long prompt away from breaking',
  'Production is just staging with users',
  'Anthropic is literally paying you to use this harder',
];

const peakLines = [
  'Peak hours. The AI is resting too (it isn\'t)',
  'Normal rate. Maybe write code yourself? (don\'t)',
  'Save the big prompts for later',
  'Good time to touch grass',
  'This status text is judging your patience',
  'Refill the coffee, peak is temporary',
  'The 2× window will return. So will your mass prompting.',
  'Write your own code for once (this is a threat)',
  'Time to pretend you understand the codebase',
  'Read a book. Just kidding, scroll Twitter.',
  'Peak hours: when devs remember they have legs',
];

// Pick a random line — new one each page load, stable during session
let _pickSeed = Math.random();
function pickRandom(lines: string[]): string {
  const idx = Math.floor(_pickSeed * lines.length) % lines.length;
  return lines[idx]!;
}
// Reshuffle every 30 seconds
setInterval(() => { _pickSeed = Math.random(); }, 30000);

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
  const btn = document.getElementById('tz-picker-btn');
  const dropdown = document.getElementById('tz-dropdown');
  const search = document.getElementById('tz-search') as HTMLInputElement | null;
  const list = document.getElementById('tz-list');
  const label = document.getElementById('tz-picker-label');
  if (!btn || !dropdown || !search || !list || !label) return;

  let allZones = getTimezoneList().filter(tz => !tz.startsWith('Etc/'));
  // Ensure detected timezone is always in the list (fallback browsers)
  if (!allZones.includes(currentTz)) {
    allZones = [currentTz, ...allZones];
  }

  // Build items once
  const items: { tz: string; display: string; searchText: string }[] = allZones.map(tz => {
    const city = tz.split('/').pop()!.replace(/_/g, ' ');
    const gmt = getGmtOffset(tz);
    return {
      tz,
      display: `${city} (${gmt})`,
      searchText: `${tz} ${city} ${gmt}`.toLowerCase(),
    };
  });

  function setLabel(tz: string) {
    const gmt = getGmtOffset(tz);
    label!.textContent = `${tz.replace(/_/g, ' ')} (${gmt})`;
  }

  setLabel(currentTz);

  function renderList(filter: string) {
    list!.innerHTML = '';
    const q = filter.toLowerCase();
    const matches = q ? items.filter(i => i.searchText.includes(q)) : items;

    for (const item of matches.slice(0, 50)) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tz-item' + (item.tz === currentTz ? ' active' : '');
      el.textContent = item.display;
      el.addEventListener('click', () => {
        currentTz = item.tz;
        setLabel(item.tz);
        close();
        onChange(item.tz);
      });
      list!.appendChild(el);
    }

    if (matches.length > 50) {
      const more = document.createElement('div');
      more.className = 'tz-more';
      more.textContent = `${matches.length - 50} more, keep typing to filter`;
      list!.appendChild(more);
    }
  }

  function open() {
    dropdown!.style.display = '';
    search!.value = '';
    renderList('');
    search!.focus();
  }

  function close() {
    dropdown!.style.display = 'none';
  }

  btn.addEventListener('click', () => {
    if (dropdown.style.display === 'none') open();
    else close();
  });

  search.addEventListener('input', () => renderList(search.value));

  // Close on outside click
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('tz-picker');
    if (picker && !picker.contains(e.target as Node)) close();
  });

  // Close on escape
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
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

  // Status description — rotating fun copy
  const desc = document.getElementById('status-desc');
  if (desc) {
    if (promoStatus === 'upcoming') {
      desc.textContent = 'Promotion starts March 13, 2026';
    } else if (promoStatus === 'ended') {
      desc.textContent = 'Promotion ended March 27, 2026';
    } else if (peak) {
      desc.textContent = pickRandom(peakLines);
    } else {
      desc.textContent = pickRandom(offpeakLines);
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
