import './style.css';
import { detectTimezone, isPeakVisibleOnClock, isCurrentlyPeak, setTimeOverride } from './time';
import { createClock, updateClock } from './clock';
import { initUI, updateUI, buildCampaignTimeline } from './ui';

const state = {
  timezone: detectTimezone(),
};

const clockContainer = document.getElementById('clock-container')!;
const statusPanel = document.querySelector('.status-panel');

function rebuildClock() {
  const showPeak = isPeakVisibleOnClock(state.timezone);
  createClock(clockContainer, state.timezone, !showPeak);
  updateStatusPanelClass();
}

function updateStatusPanelClass() {
  if (!statusPanel) return;
  const peak = isCurrentlyPeak();
  statusPanel.className = `status-panel ${peak ? 'state-peak' : 'state-offpeak'}`;
}

function fullUpdate() {
  rebuildClock();
  updateClock(state.timezone);
  updateUI(state.timezone);
  updateStatusPanelClass();
}

rebuildClock();
buildCampaignTimeline(state.timezone);
initUI(state.timezone, (newTz) => {
  state.timezone = newTz;
  fullUpdate();
});

let lastPeakState = isCurrentlyPeak();
let lastShowPeak = isPeakVisibleOnClock(state.timezone);

setInterval(() => {
  const nowPeak = isCurrentlyPeak();
  const nowShowPeak = isPeakVisibleOnClock(state.timezone);
  if (nowPeak !== lastPeakState || nowShowPeak !== lastShowPeak) {
    lastPeakState = nowPeak;
    lastShowPeak = nowShowPeak;
    rebuildClock();
  }
  updateClock(state.timezone);
  updateUI(state.timezone);
  updateStatusPanelClass();
}, 1000);

// ── Dev mode slider ──
const DEV_START = new Date('2026-03-01T00:00:00-05:00');
const DEV_HOURS = 30 * 24; // March 1–30

const devBar = document.createElement('div');
devBar.className = 'dev-bar';
devBar.innerHTML = `
  <div class="dev-bar-inner">
    <label class="dev-toggle">
      <input type="checkbox" id="dev-toggle-cb" />
      <span>Dev mode</span>
    </label>
    <div class="dev-slider-wrap" id="dev-slider-wrap" style="display:none">
      <input type="range" id="dev-slider" min="0" max="${DEV_HOURS}" value="0" step="1" />
      <div class="dev-slider-labels">
        <span>Mar 1</span><span>Mar 8</span><span>Mar 13</span><span>Mar 20</span><span>Mar 27</span><span>Mar 30</span>
      </div>
      <p id="dev-time-label" class="dev-time-label"></p>
    </div>
  </div>
`;
document.querySelector('.app')!.appendChild(devBar);

const devToggle = document.getElementById('dev-toggle-cb') as HTMLInputElement;
const devSliderWrap = document.getElementById('dev-slider-wrap')!;
const devSlider = document.getElementById('dev-slider') as HTMLInputElement;
const devLabel = document.getElementById('dev-time-label')!;

devToggle.addEventListener('change', () => {
  if (devToggle.checked) {
    devSliderWrap.style.display = '';
    applyDevTime();
  } else {
    devSliderWrap.style.display = 'none';
    setTimeOverride(null);
    lastPeakState = isCurrentlyPeak();
    lastShowPeak = isPeakVisibleOnClock(state.timezone);
    fullUpdate();
  }
});

function applyDevTime() {
  const hours = parseInt(devSlider.value, 10);
  const simDate = new Date(DEV_START.getTime() + hours * 3600000);
  setTimeOverride(simDate);

  const etStr = simDate.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York',
  });
  const localStr = simDate.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZone: state.timezone,
  });
  devLabel.textContent = `ET: ${etStr}  ·  Local: ${localStr}`;

  lastPeakState = isCurrentlyPeak();
  lastShowPeak = isPeakVisibleOnClock(state.timezone);
  fullUpdate();
}

devSlider.addEventListener('input', applyDevTime);
