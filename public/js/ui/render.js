import { getState } from '../domain/servicesStore.js';

const servicesEl = document.getElementById('services');
const inUseEl = document.getElementById('in-use');
const welcomeEl = document.getElementById('welcome');
const toastEl = document.getElementById('toast');

export function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 4000);
}

export function renderWelcome() {
  const { user } = getState();
  if (user) {
    welcomeEl.textContent = `Hello ${user.nickname}`;
  }
}

export function renderInUse() {
  const { services } = getState();
  inUseEl.innerHTML = '';

  const inUse = services
    .filter((svc) => svc.active)
    .sort((a, b) => (a.expires_at || '').localeCompare(b.expires_at || ''));

  if (!inUse.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No services are currently claimed.';
    inUseEl.appendChild(empty);
    return;
  }

  inUse.forEach((svc) => {
    const card = document.createElement('div');
    card.className = 'in-use-item';
    const expires = svc.expires_at
      ? new Date(svc.expires_at).toLocaleTimeString()
      : 'unknown';
    card.innerHTML = `
      <div>
        <strong>${svc.label}</strong>
        <span class="muted">(${svc.environment})</span>
      </div>
      <div class="muted">Taken by ${svc.claimed_by} · Ends at ${expires}</div>
    `;
    inUseEl.appendChild(card);
  });
}

export function renderServices(createActions) {
  const { services } = getState();
  servicesEl.innerHTML = '';
  renderInUse();

  const grouped = new Map();
  services.forEach((svc) => {
    if (!grouped.has(svc.environment)) {
      grouped.set(svc.environment, []);
    }
    grouped.get(svc.environment).push(svc);
  });

  grouped.forEach((servicesByEnv, env) => {
    const envCard = document.createElement('section');
    envCard.className = 'env-card';

    const header = document.createElement('div');
    header.className = 'env-header';
    header.innerHTML = `<h2>${env}</h2>`;

    const list = document.createElement('div');
    list.className = 'service-list';

    servicesByEnv.forEach((svc) => {
      const item = document.createElement('div');
      item.className = 'service-item';

      const statusClass = svc.active ? 'claimed' : 'available';
      item.classList.add(statusClass);

      const owner = svc.active ? `Taken by ${svc.claimed_by}` : 'Available';
      const expires = svc.active
        ? `Ends at ${new Date(svc.expires_at).toLocaleTimeString()}`
        : `Default ${svc.default_minutes} minutes`;

      item.innerHTML = `
        <div class="service-info">
          <h3>${svc.label}</h3>
          <p>${owner}</p>
          <p class="muted">${expires}</p>
        </div>
        <div class="service-actions"></div>
      `;

      const actions = createActions(svc);
      item.querySelector('.service-actions').appendChild(actions);
      list.appendChild(item);
    });

    envCard.appendChild(header);
    envCard.appendChild(list);
    servicesEl.appendChild(envCard);
  });
}
