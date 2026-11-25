import { ingredients } from './recipes.js';
import * as audio from './audio.js';
import { createOrders } from './orders.js';
import { createKitchen } from './kitchen.js';

const DAY_SECONDS = 100;
const COMBO_SECONDS = 12;
const DAY_ONE_SPAWN_INTERVAL = 20;
const DAY_ONE_PATIENCE_SECONDS = 80;
const rupiah = value => `Rp ${Math.round(value).toLocaleString('id-ID')}`;
const state = {
  mode: 'start', day: 1, coins: 0, score: 0,
  combo: 0, multiplier: 1, comboRemaining: 0,
  secondsRemaining: DAY_SECONDS,
  upgrades: { earnings: 0, patience: 0, speed: 0 },
  served: 0, lost: 0, dayEarnings: 0, target: 80000,
  spawnInterval: DAY_ONE_SPAWN_INTERVAL, patienceSeconds: DAY_ONE_PATIENCE_SECONDS,
};

const ui = Object.fromEntries([
  'game-shell', 'coins', 'score', 'combo-count', 'combo-fill', 'combo-meter',
  'day-number', 'day-timer', 'day-timer-fill', 'day-time-remaining', 'day-timer-status',
  'start-panel', 'start-button', 'pause-panel', 'pause-button', 'resume-button',
  'day-complete-panel', 'day-complete-title', 'day-earnings', 'day-served', 'day-lost',
  'day-stars', 'upgrade-cards', 'upgrade-earnings', 'upgrade-patience', 'upgrade-speed',
  'next-day-button', 'toast-area', 'toast-template', 'sound-button',
].map(id => [id, document.getElementById(id)]));
const comboHint = ui['combo-count'].closest('.combo-readout').querySelector('.combo-hint');
let selectedUpgrade = null;
let lastTime = performance.now();
let focusBeforePause = null;

function toast(message, kind = 'reward') {
  const element = ui['toast-template'].content.firstElementChild.cloneNode(true);
  element.dataset.kind = kind;
  element.querySelector('.toast-message').textContent = message;
  element.querySelector('use').setAttribute('href', kind === 'error' ? '#icon-ticket' : '#icon-coin');
  while (ui['toast-area'].children.length >= 4) ui['toast-area'].firstElementChild.remove();
  ui['toast-area'].append(element);
  setTimeout(() => element.remove(), 1800);
}

function resetCombo() {
  state.combo = 0;
  state.multiplier = 1;
  state.comboRemaining = 0;
}

function ticketExpired(ticket, reason) {
  state.lost++;
  resetCombo();
  if (reason === 'patience') {
    audio.expire();
    toast(`${ticket.dish.name} terlewat! Combo mulai lagi.`, 'error');
  }
}

function served(ticket) {
  state.combo++;
  state.comboRemaining = COMBO_SECONDS;
  state.multiplier = 1 + Math.min(4, Math.floor(state.combo / 3)) * 0.25;
  const earningsFactor = (1.25 ** state.upgrades.earnings) * state.multiplier;
  const patience = Math.max(0, Math.min(1, ticket.patience / ticket.maxPatience));
  const price = Math.round(ticket.dish.price * earningsFactor);
  const tip = Math.round(ticket.dish.price * 0.25 * patience * earningsFactor);
  const payout = price + tip;
  state.coins += payout;
  state.dayEarnings += payout;
  state.score += Math.round(100 * state.multiplier + patience * 50);
  state.served++;
  audio.serve();
  toast(`+${rupiah(payout)} · tip ${rupiah(tip)}`);
  if (state.combo % 3 === 0) {
    toast(`Mantap! ${state.combo} sajian · combo ×${state.multiplier.toLocaleString('id-ID')}`);
  }
  renderHeader();
}

const orders = createOrders(state, { onExpire: ticketExpired });
const kitchen = createKitchen(state, { orders, onServe: served, onToast: toast });

function renderHeader() {
  ui.coins.textContent = rupiah(state.coins);
  ui.score.textContent = state.score.toLocaleString('id-ID');
  ui['day-number'].textContent = state.day;
  const seconds = Math.ceil(Math.max(0, state.secondsRemaining));
  ui['day-time-remaining'].textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const percent = Math.round(state.secondsRemaining / DAY_SECONDS * 100);
  ui['day-timer-fill'].style.width = `${percent}%`;
  ui['day-timer'].setAttribute('aria-valuenow', percent);
  ui['day-timer'].setAttribute('aria-valuetext', `${seconds} detik tersisa`);
  ui['day-timer'].dataset.state = seconds <= 15 ? 'critical' : seconds <= 35 ? 'warning' : 'normal';
  ui['day-timer-status'].textContent = state.mode === 'start' ? `Siap buka · target ${rupiah(state.target)}`
    : state.mode === 'complete' ? `Warung tutup · ${rupiah(state.dayEarnings)}`
    : `${state.mode === 'paused' ? 'Jeda' : seconds <= 15 ? 'Saji terakhir!' : 'Target'} · ${rupiah(state.dayEarnings)} / ${rupiah(state.target)}`;
  ui['combo-count'].textContent = `×${state.multiplier.toLocaleString('id-ID')}`;
  const comboPercent = Math.round(state.comboRemaining / COMBO_SECONDS * 100);
  ui['combo-fill'].style.width = `${comboPercent}%`;
  ui['combo-meter'].setAttribute('aria-valuenow', comboPercent);
  ui['combo-count'].closest('.combo-readout').classList.toggle('is-active', state.combo > 0);
  comboHint.textContent = state.combo ? `${state.combo} sajian · ${Math.ceil(state.comboRemaining)} dtk` : 'Saji berturut-turut!';
  ui['pause-button'].disabled = state.mode !== 'playing';
}

function showPanel(panel, focusTarget) {
  if (panel) ui['toast-area'].replaceChildren();
  for (const id of ['start-panel', 'pause-panel', 'day-complete-panel']) ui[id].hidden = id !== panel;
  ui['game-shell'].inert = Boolean(panel);
  if (focusTarget) focusTarget.focus({ preventScroll: true });
}

function updateUpgradeCards() {
  const descriptions = {
    earnings: 'Harga dan tip naik 25%.',
    patience: 'Kesabaran berkurang 25% lebih lambat.',
    speed: 'Dapur memasak 30% lebih cepat.',
  };
  for (const name of ['earnings', 'patience', 'speed']) {
    const card = ui[`upgrade-${name}`];
    const selected = selectedUpgrade === name;
    card.setAttribute('aria-pressed', String(selected));
    card.classList.toggle('is-selected', selected);
    card.querySelector('.upgrade-description').textContent = `${descriptions[name]} Tingkat berikutnya: ${state.upgrades[name] + 1}.`;
    card.querySelector('.upgrade-selection').textContent = selected ? 'Dipilih' : 'Pilih';
  }
  ui['next-day-button'].disabled = !selectedUpgrade;
}

function startDay() {
  state.mode = 'playing';
  state.secondsRemaining = DAY_SECONDS;
  state.dayEarnings = 0;
  state.served = 0;
  state.lost = 0;
  state.target = 80000 + (state.day - 1) * 30000;
  // Allow roughly 20 seconds of station work plus handling before the daily ramp.
  state.spawnInterval = Math.max(3, DAY_ONE_SPAWN_INTERVAL - (state.day - 1) * 1.5);
  state.patienceSeconds = Math.max(20, DAY_ONE_PATIENCE_SECONDS - (state.day - 1) * 4);
  resetCombo();
  selectedUpgrade = null;
  ui['toast-area'].replaceChildren();
  // Reset the old counter before re-enabling its cooking loops.
  orders.reset();
  kitchen.reset();
  audio.pauseSizzles(false);
  ui['game-shell'].classList.remove('is-paused');
  showPanel(null);
  lastTime = performance.now();
  renderHeader();
  toast(`Hari ${state.day} · target ${rupiah(state.target)}. Ayo masak!`);
}

function finishDay() {
  state.mode = 'complete';
  state.secondsRemaining = 0;
  orders.finishDay();
  kitchen.refreshPlates();
  audio.pauseSizzles(true);
  audio.dayComplete();
  const stars = state.dayEarnings >= state.target * 1.5 ? 3 : state.dayEarnings >= state.target ? 2 : 1;
  ui['day-earnings'].textContent = rupiah(state.dayEarnings);
  ui['day-served'].textContent = state.served;
  ui['day-lost'].textContent = state.lost;
  ui['day-stars'].dataset.rating = stars;
  ui['day-stars'].setAttribute('aria-label', `${stars} dari 3 bintang`);
  ui['day-complete-title'].textContent = stars === 3 ? 'Warungmu jadi rebutan!' : stars === 2 ? 'Target tercapai. Mantap!' : 'Besok kita makin jago!';
  ui['day-complete-panel'].querySelector('.panel-stamp').textContent = `HARI ${state.day} · TARGET ${rupiah(state.target)}`;
  ui['day-complete-panel'].querySelector('.upgrade-instruction').textContent =
    `2 bintang: capai target. 3 bintang: capai ${rupiah(state.target * 1.5)}. Pilih satu peningkatan gratis untuk besok.`;
  updateUpgradeCards();
  showPanel('day-complete-panel', ui['upgrade-speed']);
  renderHeader();
}

function advance(now) {
  const elapsed = Math.max(0, (now - lastTime) / 1000);
  lastTime = now;
  if (state.mode !== 'playing') return;
  const seconds = Math.min(elapsed, state.secondsRemaining);
  state.secondsRemaining = Math.max(0, state.secondsRemaining - seconds);
  state.comboRemaining = Math.max(0, state.comboRemaining - seconds);
  if (state.comboRemaining === 0) resetCombo();
  orders.tick(seconds);
  kitchen.tick(seconds);
  if (state.secondsRemaining === 0) finishDay();
  else renderHeader();
}

function pause() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  focusBeforePause = document.activeElement;
  audio.pauseSizzles(true);
  ui['game-shell'].classList.add('is-paused');
  showPanel('pause-panel', ui['resume-button']);
  audio.click();
  renderHeader();
}

function resume() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  lastTime = performance.now();
  audio.pauseSizzles(false);
  ui['game-shell'].classList.remove('is-paused');
  showPanel(null);
  renderHeader();
  if (focusBeforePause?.isConnected) focusBeforePause.focus({ preventScroll: true });
  audio.click();
}

// The hand, counter and plate actions all share the same click path.
document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target || target.disabled) return;
  // Advancing may finish a slot and replace its button. Keep the clicked route.
  const action = target.dataset.action;
  const stationId = target.closest('[data-station]')?.dataset.station;
  const slotIndex = target.dataset.slot === undefined ? undefined : Number(target.dataset.slot);
  const plate = target.closest('[data-plate]');
  const plateNumber = plate ? Number(plate.dataset.plate) + 1 : null;
  audio.unlockAudio();
  advance(performance.now());
  if (target.id === 'sound-button') {
    const muted = audio.toggleMute();
    target.setAttribute('aria-pressed', String(muted));
    target.setAttribute('aria-label', muted ? 'Nyalakan suara' : 'Matikan suara');
    target.title = muted ? 'Suara mati' : 'Suara menyala';
    audio.click();
    return;
  }
  if (target.id === 'start-button' && state.mode === 'start') {
    audio.click();
    startDay();
    return;
  }
  if (target.id === 'pause-button') { pause(); return; }
  if (target.id === 'resume-button') { resume(); return; }
  if (state.mode === 'complete') {
    if (target.closest('#upgrade-cards')) {
      selectedUpgrade = target.dataset.upgrade;
      updateUpgradeCards();
      audio.click();
    } else if (target.id === 'next-day-button' && selectedUpgrade) {
      state.upgrades[selectedUpgrade]++;
      state.day++;
      audio.click();
      startDay();
    }
    return;
  }
  if (state.mode !== 'playing') return;
  if (target.dataset.ingredient) {
    kitchen.takeIngredient(target.dataset.ingredient);
    return;
  }
  if (action === 'use-station' && stationId) kitchen.useStation(stationId);
  else if (action === 'station-slot' && stationId) kitchen.useStation(stationId, slotIndex);
  else if (action === 'add-to-plate') kitchen.addToPlate(plateNumber);
  else if (action === 'serve') kitchen.servePlate(plateNumber);
  else if (action === 'discard-plate') kitchen.trashPlate(plateNumber);
  else if (action === 'discard-held-item') kitchen.discardHeld();
});

const stationKeys = { q: 'cut', w: 'wok', e: 'grill', r: 'pot' };
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  audio.unlockAudio();
  advance(performance.now());
  if (event.key === 'Escape') {
    event.preventDefault();
    if (state.mode === 'playing') pause();
    else if (state.mode === 'paused') resume();
    return;
  }
  if (state.mode !== 'playing') return;
  const key = event.key.toLowerCase();
  if (/^[1-8]$/.test(key)) {
    event.preventDefault();
    kitchen.takeIngredient(ingredients[Number(key) - 1].id);
  } else if (stationKeys[key]) {
    event.preventDefault();
    kitchen.useStation(stationKeys[key]);
  } else if (key === 'a' || key === 's') {
    event.preventDefault();
    kitchen.addToPlate(key === 'a' ? 1 : 2);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    kitchen.serveReadyPlate();
  }
});

document.addEventListener('pointerdown', () => audio.unlockAudio(), { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') {
    advance(performance.now());
    pause();
  }
});

function frame(now) {
  advance(now);
  requestAnimationFrame(frame);
}

renderHeader();
showPanel('start-panel', ui['start-button']);
requestAnimationFrame(frame);
