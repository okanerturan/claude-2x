const PEAK_TZ = 'America/New_York';
const PEAK_START_HOUR = 8;
const PEAK_END_HOUR = 14;
const PROMO_START = new Date('2026-03-13T00:00:00-04:00');
const PROMO_END = new Date('2026-03-27T23:59:00-07:00'); // March 27 at 11:59 PM PT

// Dev mode time override
let _timeOverride: Date | null = null;
export function setTimeOverride(date: Date | null): void { _timeOverride = date; }
export function getNow(): Date { return _timeOverride ? new Date(_timeOverride.getTime()) : new Date(); }
export function getNowMs(): number { return _timeOverride ? _timeOverride.getTime() : Date.now(); }

export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getTimezoneList(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return [
      'America/New_York', 'America/Chicago', 'America/Denver',
      'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
      'Australia/Sydney', 'Pacific/Auckland',
    ];
  }
}

function getHourMinuteInTz(date: Date, tz: string): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    timeZone: tz,
  }).formatToParts(date);

  let hour = 0, minute = 0, second = 0;
  for (const p of parts) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'second') second = parseInt(p.value, 10);
  }
  // Intl hour12:false gives 24 for midnight in some locales
  if (hour === 24) hour = 0;
  return { hour, minute, second };
}

export function getCurrentTimeInTz(tz: string): { hour: number; minute: number; second: number } {
  return getHourMinuteInTz(getNow(), tz);
}

/** Check if it's currently a weekday in ET */
function isWeekdayInET(): boolean {
  const now = getNow();
  const dayStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: PEAK_TZ }).format(now);
  return dayStr !== 'Sat' && dayStr !== 'Sun';
}

export function isCurrentlyPeak(): boolean {
  if (!isWeekdayInET()) return false; // weekends are all off-peak
  const { hour } = getHourMinuteInTz(getNow(), PEAK_TZ);
  return hour >= PEAK_START_HOUR && hour < PEAK_END_HOUR;
}

export function isWeekend(): boolean {
  return !isWeekdayInET();
}

/** ET day-of-week as 1=Mon..7=Sun */
function getETDow(): number {
  const now = getNow();
  const dayStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: PEAK_TZ }).format(now);
  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return dayMap[dayStr] ?? 1;
}

/** Seconds until the next peak start (next weekday 8AM ET) */
function getSecondsUntilNextPeak(): number {
  const now = getNow();
  const { hour, minute, second } = getHourMinuteInTz(now, PEAK_TZ);
  const currentSeconds = hour * 3600 + minute * 60 + second;
  const peakStartSeconds = PEAK_START_HOUR * 3600;

  if (isWeekdayInET() && currentSeconds < peakStartSeconds) {
    return peakStartSeconds - currentSeconds;
  }

  const dow = getETDow();
  let daysUntil: number;
  if (dow >= 6) {
    daysUntil = 8 - dow; // Sat→2, Sun→1
  } else if (currentSeconds >= peakStartSeconds) {
    daysUntil = dow === 5 ? 3 : 1; // Fri→Mon, else tomorrow
  } else {
    daysUntil = 0;
  }

  return daysUntil * 86400 + peakStartSeconds - currentSeconds;
}

/** Seconds since the last peak end (last weekday 2PM ET) */
function getSecondsSinceLastPeakEnd(): number {
  const now = getNow();
  const { hour, minute, second } = getHourMinuteInTz(now, PEAK_TZ);
  const currentSeconds = hour * 3600 + minute * 60 + second;
  const peakEndSeconds = PEAK_END_HOUR * 3600;

  if (isWeekdayInET() && currentSeconds >= peakEndSeconds) {
    return currentSeconds - peakEndSeconds;
  }

  const dow = getETDow();
  let daysSince: number;
  if (dow === 1) {
    daysSince = 3; // Monday before peak: last was Friday
  } else if (dow >= 6) {
    daysSince = dow - 5; // Sat→1, Sun→2
  } else {
    daysSince = 1; // Tue-Fri before peak: yesterday
  }

  return daysSince * 86400 + (currentSeconds - peakEndSeconds);
}

/** Get the next peak start time formatted in the user's local timezone */
export function getNextPeakLocalTime(tz: string): string {
  const secsUntil = getSecondsUntilNextPeak();
  const nextPeakDate = new Date(getNowMs() + secsUntil * 1000);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  }).format(nextPeakDate);
}

/**
 * Should the peak arc be shown on the clock?
 * Looks at the next upcoming peak window position on the 24h clock
 * and checks whether that time actually falls on a weekday in ET.
 *
 * e.g. Istanbul Monday 12AM: peak zone is at 3PM-9PM today → Monday in ET → weekday → show peak
 * e.g. Istanbul Saturday 2PM: peak zone at 3PM today → Saturday in ET → weekend → hide peak
 * e.g. Istanbul Sunday 11PM: peak zone at 3PM already passed → next is Monday 3PM → weekday → show peak
 */
export function isPeakVisibleOnClock(tz: string): boolean {
  const now = getNow();
  const peak = getLocalPeakWindow(tz);
  const { hour, minute, second } = getCurrentTimeInTz(tz);
  const currentFractional = hour + minute / 60 + second / 3600;

  // How many hours until the peak zone starts (or 0 if we're in it)?
  let hoursUntilPeakStart: number;

  if (peak.end > peak.start) {
    // Normal: no midnight crossing (e.g. 15:00–21:00)
    if (currentFractional < peak.start) {
      hoursUntilPeakStart = peak.start - currentFractional;
    } else if (currentFractional < peak.end) {
      hoursUntilPeakStart = 0; // currently inside peak zone
    } else {
      hoursUntilPeakStart = 24 - currentFractional + peak.start; // tomorrow
    }
  } else {
    // Crosses midnight (e.g. 23:00–05:00)
    if (currentFractional >= peak.start || currentFractional < peak.end) {
      hoursUntilPeakStart = 0; // currently inside peak zone
    } else {
      hoursUntilPeakStart = peak.start - currentFractional;
    }
  }

  // What date/time will it be at peak start?
  const peakStartDate = new Date(now.getTime() + hoursUntilPeakStart * 3600000);

  // Check if that moment is a weekday in ET
  const dayStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: PEAK_TZ }).format(peakStartDate);
  return dayStr !== 'Sat' && dayStr !== 'Sun';
}

export function isPromotionActive(): 'active' | 'upcoming' | 'ended' {
  const now = getNow();
  if (now < PROMO_START) return 'upcoming';
  if (now >= PROMO_END) return 'ended';
  return 'active';
}

/** Get the peak window hours in the user's local timezone as fractional hours (0-24) */
export function getLocalPeakWindow(tz: string): { start: number; end: number } {
  // Create dates for today at peak start and end in ET
  const now = getNow();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: PEAK_TZ }).format(now); // YYYY-MM-DD

  const refDate = new Date(`${todayStr}T12:00:00`);
  const etOffset = getTimezoneOffsetMinutes(refDate, PEAK_TZ);
  const localOffset = getTimezoneOffsetMinutes(refDate, tz);
  const diffMinutes = localOffset - etOffset;

  let startMinutes = PEAK_START_HOUR * 60 + diffMinutes;
  let endMinutes = PEAK_END_HOUR * 60 + diffMinutes;

  // Normalize to 0-1440
  startMinutes = ((startMinutes % 1440) + 1440) % 1440;
  endMinutes = ((endMinutes % 1440) + 1440) % 1440;

  return {
    start: startMinutes / 60,
    end: endMinutes / 60,
  };
}

/** Get timezone offset from UTC in minutes (positive = ahead of UTC) */
function getTimezoneOffsetMinutes(date: Date, tz: string): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: tz });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

/** Seconds until the next transition (peak→offpeak or offpeak→peak) */
export function getSecondsUntilNextChange(): number {
  if (isCurrentlyPeak()) {
    // Currently peak: ends at PEAK_END_HOUR ET today
    const { hour, minute, second } = getHourMinuteInTz(getNow(), PEAK_TZ);
    return PEAK_END_HOUR * 3600 - (hour * 3600 + minute * 60 + second);
  }
  // Currently off-peak: next change is next peak start
  return getSecondsUntilNextPeak();
}

/** Returns progress (0-1) through the current period (peak or off-peak) */
export function getPeriodProgress(): number {
  if (isCurrentlyPeak()) {
    const { hour, minute, second } = getHourMinuteInTz(getNow(), PEAK_TZ);
    const sinceStart = hour * 3600 + minute * 60 + second - PEAK_START_HOUR * 3600;
    const peakDuration = (PEAK_END_HOUR - PEAK_START_HOUR) * 3600;
    return sinceStart / peakDuration;
  }
  // Off-peak: progress from last peak end to next peak start
  const since = getSecondsSinceLastPeakEnd();
  const until = getSecondsUntilNextPeak();
  return since / (since + until);
}

/** Get midnight boundaries within the current period, as fractional positions (0-1) with day labels */
export function getPeriodDayMarkers(tz: string): { position: number; label: string }[] {
  const now = getNowMs();
  let periodStartMs: number;
  let periodEndMs: number;

  if (isCurrentlyPeak()) {
    const { hour, minute, second } = getHourMinuteInTz(getNow(), PEAK_TZ);
    const currentSecs = hour * 3600 + minute * 60 + second;
    const sinceStart = currentSecs - PEAK_START_HOUR * 3600;
    const untilEnd = PEAK_END_HOUR * 3600 - currentSecs;
    periodStartMs = now - sinceStart * 1000;
    periodEndMs = now + untilEnd * 1000;
  } else {
    const since = getSecondsSinceLastPeakEnd();
    const until = getSecondsUntilNextPeak();
    periodStartMs = now - since * 1000;
    periodEndMs = now + until * 1000;
  }

  const totalMs = periodEndMs - periodStartMs;
  if (totalMs <= 0) return [];

  // Find time-of-day at period start in user's tz
  const startParts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false, timeZone: tz,
  }).formatToParts(new Date(periodStartMs));

  let startH = 0, startM = 0, startS = 0;
  for (const p of startParts) {
    if (p.type === 'hour') startH = parseInt(p.value, 10);
    if (p.type === 'minute') startM = parseInt(p.value, 10);
    if (p.type === 'second') startS = parseInt(p.value, 10);
  }
  if (startH === 24) startH = 0;

  // Seconds from period start to first midnight in user's tz
  const secsToFirstMidnight = (24 - startH) * 3600 - startM * 60 - startS;

  const markers: { position: number; label: string }[] = [];
  let offsetMs = secsToFirstMidnight * 1000;

  while (periodStartMs + offsetMs < periodEndMs) {
    const pos = offsetMs / totalMs;
    if (pos > 0.03 && pos < 0.97) {
      const midnightDate = new Date(periodStartMs + offsetMs);
      const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(midnightDate);
      markers.push({ position: pos, label: dayLabel });
    }
    offsetMs += 86400 * 1000;
  }

  return markers;
}

export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

export function formatHourFractional(fractionalHour: number): string {
  const h = Math.floor(fractionalHour);
  const m = Math.round((fractionalHour - h) * 60);
  return formatTime(h, m);
}
