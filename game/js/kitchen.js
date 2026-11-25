import { ingredients, stations, dishes, finalComponentNames } from './recipes.js';
import * as audio from './audio.js';
import * as fx from './fx.js';

export function createKitchen(state, { orders, onServe, onToast = () => {} }) {
  const crateContainer = document.getElementById('ingredient-crates');
  const ingredientTemplate = document.getElementById('ingredient-template');
  const itemTemplate = document.getElementById('station-item-template');
  const handTray = document.getElementById('hand-indicator');
  const handName = document.getElementById('held-item-name');
  const handVisual = document.getElementById('held-item-visual');
  const discardButton = document.getElementById('discard-held-item');
  const crates = new Map();
  const counters = new Map();
  let heldItem = null;
  let recipeSteps = [];
  let unlockedDishes = [];
  const plates = [1, 2].map(number => {
    const element = document.getElementById(`plate-${number}`);
    return {
      number, items: [], matchedDish: null, ticket: null, element,
      layers: document.getElementById(`plate-${number}-layers`),
      name: document.getElementById(`plate-${number}-name`),
      serveButton: document.getElementById(`serve-plate-${number}`),
      trashButton: document.getElementById(`trash-plate-${number}`),
      status: element.querySelector('.plate-state'),
    };
  });

  for (const [index, ingredient] of ingredients.entries()) {
    const crate = ingredientTemplate.content.firstElementChild.cloneNode(true);
    // ingredient-* IDs already identify SVG symbols in the shell; use data-ingredient
    // for crates so every existing ID remains unique.
    crate.dataset.ingredient = ingredient.id;
    crate.querySelector('use').setAttribute('href', `#ingredient-${ingredient.id}`);
    crate.querySelector('.ingredient-name').textContent = ingredient.name;
    crate.querySelector('.ingredient-key').textContent = index + 1;
    crate.setAttribute('aria-label', `Ambil ${ingredient.name} (${index + 1})`);
    crate.setAttribute('aria-pressed', 'false');
    crateContainer.append(crate);
    crates.set(ingredient.id, crate);
  }

  for (const [id, station] of Object.entries(stations)) {
    const element = document.getElementById(`station-${id}`);
    const progress = document.getElementById(`${id}-progress`);
    counters.set(id, {
      id, config: station, element, slots: Array(station.slots).fill(null),
      slotContainer: document.getElementById(`${id}-slots`),
      progress, fill: progress.querySelector('.station-progress-fill'),
      status: document.getElementById(`${id}-status`),
    });
  }

  function buildRecipes() {
    unlockedDishes = dishes.filter(dish => dish.unlockDay <= state.day);
    const unique = new Map();
    for (const dish of unlockedDishes) {
      for (const component of dish.components) unique.set(component.name, component);
    }
    recipeSteps = [...unique.values()];
  }

  function ingredientFor(component) {
    const raw = ingredients.find(ingredient => ingredient.id === component.from);
    if (raw) return raw;
    return ingredientFor(recipeSteps.find(step => step.name === component.from));
  }

  function finishedItem(component) {
    const ingredient = ingredientFor(component);
    return { kind: 'component', name: component.name, ingredient: ingredient.id, color: ingredient.color };
  }

  function itemPicture(item) {
    return `<svg viewBox="0 0 72 64" aria-hidden="true" focusable="false"><use href="#ingredient-${item.ingredient}"></use></svg>`;
  }

  function renderHand() {
    handName.textContent = heldItem ? heldItem.name : 'Kosong';
    handVisual.innerHTML = heldItem ? itemPicture(heldItem) : '';
    handTray.dataset.state = heldItem ? 'holding' : 'empty';
    discardButton.disabled = !heldItem;
    for (const [id, crate] of crates) {
      const selected = heldItem?.kind === 'raw' && heldItem.ingredient === id;
      crate.setAttribute('aria-pressed', String(selected));
    }
  }

  function renderStation(counter, rebuildSlots = false) {
    const occupied = counter.slots.filter(Boolean);
    const cooking = occupied.filter(slot => !slot.ready);
    const ready = occupied.filter(slot => slot.ready);
    counter.element.dataset.state = cooking.length ? 'cooking' : ready.length ? 'ready' : 'idle';
    const progress = occupied.length
      ? occupied.reduce((sum, slot) => sum + Math.min(1, slot.elapsed / slot.duration), 0) / occupied.length
      : 0;
    counter.fill.style.width = `${Math.round(progress * 100)}%`;
    counter.progress.setAttribute('aria-valuenow', Math.round(progress * 100));
    if (!occupied.length) {
      counter.status.textContent = `Siap · ${counter.config.slots} tempat`;
    } else {
      const status = [];
      if (ready.length) status.push(`${ready.length} matang, ambil!`);
      if (cooking.length) {
        const remaining = Math.ceil(Math.min(...cooking.map(slot => slot.duration - slot.elapsed)));
        status.push(`${cooking.length} proses · ${remaining} dtk`);
      }
      counter.status.textContent = status.join(' · ');
    }
    audio.setSizzle(counter.id, cooking.length > 0);
    if (!rebuildSlots) return;
    counter.slotContainer.replaceChildren();
    counter.slots.forEach((slot, index) => {
      if (!slot) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = 'station-slot';
      button.dataset.slot = index;
      button.style.cssText = 'max-width:100%;padding:3px;border:1px solid var(--line);border-radius:5px;background:var(--paper);color:var(--ink);';
      const item = itemTemplate.content.firstElementChild.cloneNode(true);
      item.querySelector('use').setAttribute('href', `#ingredient-${slot.item.ingredient}`);
      item.querySelector('.station-item-name').textContent = `${slot.ready ? '✓ ' : ''}${slot.item.name}`;
      button.setAttribute('aria-label', `${slot.item.name}: ${slot.ready ? 'matang, klik untuk ambil' : 'sedang dimasak'}`);
      button.append(item);
      counter.slotContainer.append(button);
    });
  }

  function componentSet(plate) {
    return new Set(plate.items.map(item => item.name));
  }

  function renderPlate(plate, rebuildLayers = false) {
    const wasComplete = Boolean(plate.matchedDish);
    const names = componentSet(plate);
    plate.matchedDish = unlockedDishes.find(dish => {
      const finalNames = finalComponentNames(dish);
      return finalNames.size === names.size && [...finalNames].every(name => names.has(name));
    }) || null;
    plate.ticket = orders.findMatchingTicket(names);
    plate.name.textContent = plate.matchedDish ? plate.matchedDish.name
      : plate.items.length ? 'Racikanmu' : 'Belum diracik';
    plate.element.classList.toggle('is-ready', Boolean(plate.ticket));
    plate.element.classList.toggle('is-complete', Boolean(plate.matchedDish));
    plate.status.textContent = plate.ticket ? 'SIAP SAJI'
      : plate.matchedDish ? 'TUNGGU TIKET' : plate.items.length ? 'DIRACIK' : 'KOSONG';
    plate.serveButton.disabled = !plate.ticket;
    plate.trashButton.disabled = !plate.items.length;
    plate.element.querySelector('[data-action="add-to-plate"]').setAttribute('aria-label',
      `Tambahkan bahan ke piring ${plate.number}. ${plate.items.map(item => item.name).join(', ') || 'Kosong'}`);
    if (!rebuildLayers) return;
    plate.layers.replaceChildren();
    plate.items.forEach((item, index) => {
      const layer = document.createElement('span');
      layer.className = 'plate-layer';
      layer.dataset.ingredient = item.ingredient;
      layer.style.setProperty('--layer-index', index);
      if (item.ingredient === 'tofu' || item.ingredient === 'tempeh') layer.style.background = item.color;
      layer.setAttribute('aria-label', item.name);
      plate.layers.append(layer);
    });
    if (!wasComplete && plate.matchedDish) {
      fx.plateReady(plate.element);
      audio.ready();
    }
  }

  function takeIngredient(id) {
    const ingredient = ingredients.find(item => item.id === id);
    if (!ingredient) return false;
    if (heldItem) {
      onToast('Tangan penuh! Letakkan atau buang bahan dulu.', 'error');
      return false;
    }
    heldItem = { kind: 'raw', name: ingredient.name, ingredient: id, color: ingredient.color };
    audio.pickup();
    renderHand();
    return true;
  }

  function useStation(id, slotIndex) {
    const counter = counters.get(id);
    if (!counter) return false;
    if (!heldItem) {
      const index = slotIndex === undefined
        ? counter.slots.findIndex(slot => slot?.ready) : slotIndex;
      const slot = counter.slots[index];
      if (!slot?.ready) {
        onToast(slot ? 'Belum matang, sebentar lagi!' : 'Ambil bahan dari peti dulu.');
        return false;
      }
      heldItem = slot.item;
      counter.slots[index] = null;
      audio.pickup();
    } else {
      if (slotIndex !== undefined && counter.slots[slotIndex]) {
        onToast('Letakkan bahan di tangan dulu, lalu ambil hasilnya.', 'error');
        return false;
      }
      const source = heldItem.kind === 'raw' ? heldItem.ingredient : heldItem.name;
      const component = recipeSteps.find(step => step.from === source && step.station === id);
      if (!component) {
        const routes = recipeSteps.filter(step => step.from === source);
        const destinations = [...new Set(routes.map(step => step.station ? stations[step.station].name : 'piring'))];
        onToast(destinations.length ? `${heldItem.name} → ${destinations.join(' / ')}`
          : `${heldItem.name} sudah siap masuk piring.`, 'error');
        return false;
      }
      const index = counter.slots.findIndex(slot => slot === null);
      if (index === -1) {
        onToast(`${counter.config.name} penuh! Ambil hasil yang matang.`, 'error');
        return false;
      }
      counter.slots[index] = {
        item: finishedItem(component), elapsed: 0,
        duration: counter.config.seconds / (1.3 ** state.upgrades.speed), ready: false,
      };
      heldItem = null;
      if (id === 'cut') audio.chop();
      else audio.place();
    }
    renderHand();
    renderStation(counter, true);
    return true;
  }

  function addToPlate(number) {
    const plate = plates.find(item => item.number === number);
    if (!plate) return false;
    if (!heldItem) {
      onToast('Ambil hasil masakan dulu. Nasi boleh langsung!');
      return false;
    }
    let item = heldItem;
    if (item.kind === 'raw') {
      const direct = recipeSteps.find(component => component.station === null && component.from === item.ingredient);
      if (!direct) {
        onToast(`${item.name} perlu diolah dulu. Ikuti langkah di tiket!`, 'error');
        return false;
      }
      item = finishedItem(direct);
    }
    if (plate.items.some(layer => layer.name === item.name)) {
      onToast('Bahan itu sudah ada di piring. Coba piring sebelah!', 'error');
      return false;
    }
    if (plate.items.length >= 4) {
      onToast('Piring penuh! Saji atau buang racikannya.', 'error');
      return false;
    }
    plate.items.push(item);
    heldItem = null;
    audio.place();
    renderHand();
    renderPlate(plate, true);
    return true;
  }

  function servePlate(number) {
    const plate = plates.find(item => item.number === number);
    if (!plate) return false;
    const ticket = orders.findMatchingTicket(componentSet(plate));
    if (!ticket || !orders.markServed(ticket)) {
      onToast('Belum ada tiket yang cocok dengan piring ini.', 'error');
      renderPlate(plate);
      return false;
    }
    const payout = onServe(ticket);
    fx.plateServed(plate.element, ticket.dish, payout);
    plate.items = [];
    renderPlate(plate, true);
    refreshPlates();
    return true;
  }

  function serveReadyPlate() {
    const plate = plates.find(item => orders.findMatchingTicket(componentSet(item)));
    if (plate) return servePlate(plate.number);
    onToast('Racik piring sesuai tiket dulu!');
    return false;
  }

  function trashPlate(number) {
    const plate = plates.find(item => item.number === number);
    if (!plate || !plate.items.length) return false;
    plate.items = [];
    audio.place();
    renderPlate(plate, true);
    onToast('Piring bersih. Ayo racik lagi!');
    return true;
  }

  function discardHeld() {
    if (!heldItem) return false;
    heldItem = null;
    audio.place();
    renderHand();
    return true;
  }

  function refreshPlates() {
    for (const plate of plates) renderPlate(plate);
  }

  function tick(seconds) {
    for (const counter of counters.values()) {
      let changed = false;
      for (const slot of counter.slots) {
        if (!slot || slot.ready) continue;
        slot.elapsed = Math.min(slot.duration, slot.elapsed + seconds);
        if (slot.elapsed >= slot.duration) {
          slot.ready = true;
          changed = true;
          audio.ding();
        }
      }
      renderStation(counter, changed);
      if (changed) fx.stationFinished(counter.element);
    }
    refreshPlates();
  }

  function reset() {
    heldItem = null;
    buildRecipes();
    for (const counter of counters.values()) {
      counter.slots.fill(null);
      renderStation(counter, true);
    }
    for (const plate of plates) {
      plate.items = [];
      renderPlate(plate, true);
    }
    renderHand();
  }

  reset();
  return {
    takeIngredient, useStation, addToPlate, servePlate, serveReadyPlate,
    trashPlate, discardHeld, tick, reset, refreshPlates,
  };
}
