// Presentation only: effects never delay input or read layout geometry.
import { platePicture } from './recipes.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function pop(element, peak = 1.1, duration = 360) {
  if (reducedMotion.matches) return;
  element.animate([
    { transform: 'scale(1)' },
    { transform: `scale(${peak})`, offset: .35 },
    { transform: 'scale(.97)', offset: .7 },
    { transform: 'scale(1)' },
  ], { duration, easing: 'cubic-bezier(.2,.75,.3,1)' });
}

function transient(parent, className) {
  const element = document.createElement('span');
  element.className = className;
  element.setAttribute('aria-hidden', 'true');
  parent.append(element);
  // The deadline also cleans up effects when reduced motion removes animations.
  setTimeout(() => element.remove(), 780);
  return element;
}

export function plateReady(plate) {
  if (reducedMotion.matches) return;
  const burst = transient(plate.querySelector('.plate-visual'), 'plate-sparkles');
  for (let index = 0; index < 6; index++) {
    const spark = document.createElement('i');
    const angle = index * Math.PI / 3;
    spark.style.setProperty('--spark-x', `${Math.cos(angle) * 64}px`);
    spark.style.setProperty('--spark-y', `${Math.sin(angle) * 30}px`);
    burst.append(spark);
  }
  pop(plate.querySelector('.plate-visual'), 1.08, 320);
}

export function plateServed(plate, dish, payout) {
  const visual = plate.querySelector('.plate-visual');
  const echo = transient(visual, 'serve-echo');
  echo.innerHTML = platePicture(dish);
  const amount = transient(plate, 'plate-payout');
  amount.textContent = `+Rp ${Math.round(payout).toLocaleString('id-ID')}`;
  pop(visual, 1.16, 440);
}

export function comboIncrement(element) { pop(element, 1.12, 360); }

export function stationFinished(station) {
  const visual = station.querySelector('.station-visual');
  pop(visual, 1.09, 300);
  if (reducedMotion.matches) return;
  const puff = transient(visual, 'station-puff');
  for (let index = 0; index < 3; index++) puff.append(document.createElement('i'));
}

export function countEarnings(element, total, format) {
  element.setAttribute('aria-label', format(total));
  if (reducedMotion.matches) { element.textContent = format(total); return; }
  const began = performance.now();
  function frame(now) {
    const progress = Math.min(1, Math.max(0, (now - began) / 650));
    element.textContent = format(Math.round(total * (1 - (1 - progress) ** 3)));
    if (progress < 1) requestAnimationFrame(frame);
  }
  element.textContent = format(0);
  requestAnimationFrame(frame);
}
