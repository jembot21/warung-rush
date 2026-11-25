import { dishes, stations, finalComponentNames, platePicture } from './recipes.js';
import * as audio from './audio.js';

const rupiah = value => `Rp ${Math.round(value).toLocaleString('id-ID')}`;

export function createOrders(state, { onExpire = () => {}, random = Math.random } = {}) {
  const board = document.getElementById('order-board');
  const slots = document.getElementById('order-slots');
  const count = document.getElementById('order-count');
  const empty = document.getElementById('orders-empty');
  const ticketTemplate = document.getElementById('order-ticket-template');
  const stepTemplate = document.getElementById('step-chip-template');
  let tickets = [];
  let bag = [];
  let nextSpawn = 0;
  let serial = 0;
  let elapsed = 0;

  function updateCount() {
    count.textContent = tickets.length;
    empty.hidden = tickets.length > 0;
    board.dataset.activeOrders = tickets.length;
  }

  function availableDishes() {
    return dishes.filter(dish => dish.unlockDay <= state.day);
  }

  function drawDish() {
    if (!bag.length) {
      bag = availableDishes().slice();
      for (let index = bag.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [bag[index], bag[other]] = [bag[other], bag[index]];
      }
    }
    return bag.pop();
  }

  function updatePatience(ticket) {
    const fraction = Math.max(0, ticket.patience / ticket.maxPatience);
    const percent = Math.round(fraction * 100);
    const critical = fraction <= 0.2;
    ticket.element.dataset.state = critical ? 'expiring' : fraction <= 0.45 ? 'warning' : 'waiting';
    ticket.element.classList.toggle('is-expiring', critical);
    ticket.element.style.animationIterationCount = critical ? 'infinite' : '';
    ticket.fill.style.width = `${percent}%`;
    ticket.fill.style.backgroundColor = `hsl(${Math.round(fraction * 110)}, 52%, 38%)`;
    ticket.track.setAttribute('aria-valuenow', percent);
    ticket.track.setAttribute('aria-valuetext', `${percent}% kesabaran tersisa`);
    const realSeconds = Math.ceil(ticket.patience / (0.75 ** state.upgrades.patience));
    ticket.label.textContent = `${critical ? 'Cepat!' : 'Menunggu'} · ${realSeconds} dtk`;
  }

  function spawn(dish = drawDish()) {
    if (tickets.length >= 4 || !dish) return null;
    const element = ticketTemplate.content.firstElementChild.cloneNode(true);
    const id = ++serial;
    element.dataset.order = id;
    element.setAttribute('aria-label', `Pesanan ${id}: ${dish.name}. ${dish.description}`);
    element.title = dish.description;
    element.querySelector('.order-number').textContent = `#${String(id).padStart(2, '0')}`;
    element.querySelector('.order-reward').textContent = rupiah(dish.price * (1.25 ** state.upgrades.earnings));
    element.querySelector('.dish-name').textContent = dish.name;
    const picture = element.querySelector('.dish-picture');
    picture.innerHTML = platePicture(dish).replace(/^<svg[^>]*>|<\/svg>$/g, '');
    picture.setAttribute('viewBox', '0 0 120 80');
    const steps = element.querySelector('.order-steps');
    for (const component of dish.components) {
      const chip = stepTemplate.content.firstElementChild.cloneNode(true);
      chip.dataset.step = component.name;
      const station = component.station ? stations[component.station] : null;
      chip.querySelector('.step-label').textContent = `${station ? station.label : 'Piring'}: ${component.name}`;
      chip.setAttribute('aria-label', `${component.name}: ${station ? station.name : 'langsung ke piring'}`);
      steps.append(chip);
    }
    // More involved dishes earn a little extra prep time, without removing pressure.
    const effort = dish.components.filter(component => component.station).length * 2;
    const maxPatience = (state.patienceSeconds + effort) * (0.9 + random() * 0.2);
    const ticket = {
      id, dish, bornAt: elapsed, patience: maxPatience, maxPatience,
      finalNames: finalComponentNames(dish), element,
      fill: element.querySelector('.patience-fill'),
      track: element.querySelector('.patience-track'),
      label: element.querySelector('.patience-label'),
    };
    tickets.push(ticket);
    slots.append(element);
    audio.orderArrival();
    updatePatience(ticket);
    updateCount();
    return ticket;
  }

  function remove(ticket) {
    const index = tickets.indexOf(ticket);
    if (index === -1) return false;
    tickets.splice(index, 1);
    ticket.element.remove();
    updateCount();
    return true;
  }

  function findMatchingTicket(names) {
    // Tickets stay in arrival order, so this always serves the longest-waiting match.
    return tickets.find(ticket => ticket.patience > 0 && ticket.finalNames.size === names.size
      && [...ticket.finalNames].every(name => names.has(name))) || null;
  }

  function markServed(ticket) {
    if (!ticket || ticket.patience <= 0) return false;
    return remove(ticket);
  }

  function tick(seconds) {
    if (seconds <= 0) return;
    elapsed += seconds;
    for (const ticket of tickets.slice()) {
      ticket.patience = Math.max(0, ticket.patience - seconds * (0.75 ** state.upgrades.patience));
      updatePatience(ticket);
      if (ticket.patience === 0) {
        remove(ticket);
        onExpire(ticket, 'patience');
      }
    }
    nextSpawn = Math.max(0, nextSpawn - seconds);
    // Don't admit a new customer just as the doors close.
    if (nextSpawn === 0 && tickets.length < 4 && state.secondsRemaining > 10) {
      spawn();
      nextSpawn = state.spawnInterval * (0.85 + random() * 0.3);
    }
  }

  function clear() {
    for (const ticket of tickets) ticket.element.remove();
    tickets = [];
    bag = [];
    updateCount();
  }

  function reset() {
    clear();
    serial = 0;
    elapsed = 0;
    // The first cheap dish teaches direct rice, chopping and the wok on day one.
    const firstDish = availableDishes().find(dish => dish.unlockDay === state.day) || availableDishes()[0];
    spawn(firstDish);
    // Give the opening recipe a full interval before the next customer arrives.
    nextSpawn = state.spawnInterval;
  }

  function finishDay() {
    for (const ticket of tickets.slice()) {
      remove(ticket);
      onExpire(ticket, 'closing');
    }
  }

  updateCount();
  return {
    get openTickets() { return tickets.slice(); },
    findMatchingTicket, markServed, tick, reset, clear, finishDay,
  };
}
