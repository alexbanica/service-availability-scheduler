import {
  claimService,
  extendService,
  loadServices,
  loadUser,
  logout,
  releaseService
} from './domain/reservationService.js';
import { getState } from './domain/servicesStore.js';
import { initAutoRefresh, initExpiryEvents } from './ui/events.js';
import { renderServices, renderWelcome, showToast } from './ui/render.js';

const refreshBtn = document.getElementById('refresh');
const logoutBtn = document.getElementById('logout');

function createActions(svc) {
  const actions = document.createElement('div');
  const { user } = getState();

  if (!svc.active) {
    const claimBtn = document.createElement('button');
    claimBtn.textContent = 'Claim';
    claimBtn.addEventListener('click', () => handleClaim(svc.key));
    actions.appendChild(claimBtn);
  } else if (user && svc.claimed_by_id === user.id) {
    const extendBtn = document.createElement('button');
    extendBtn.textContent = 'Extend';
    extendBtn.addEventListener('click', () => handleExtend(svc.key));
    const releaseBtn = document.createElement('button');
    releaseBtn.textContent = 'Release';
    releaseBtn.classList.add('secondary');
    releaseBtn.addEventListener('click', () => handleRelease(svc.key));
    actions.appendChild(extendBtn);
    actions.appendChild(releaseBtn);
  }

  return actions;
}

async function loadServicesAndRender() {
  await loadServices();
  renderServices(createActions);
}

async function handleClaim(serviceKey) {
  try {
    await claimService(serviceKey);
    await loadServicesAndRender();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleRelease(serviceKey) {
  try {
    await releaseService(serviceKey);
    await loadServicesAndRender();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleExtend(serviceKey) {
  try {
    await extendService(serviceKey);
    showToast('Service extended.');
    await loadServicesAndRender();
  } catch (err) {
    showToast(err.message);
  }
}

refreshBtn.addEventListener('click', loadServicesAndRender);
logoutBtn.addEventListener('click', logout);

(async function init() {
  await loadUser();
  renderWelcome();
  await loadServicesAndRender();
  initExpiryEvents();
  initAutoRefresh(loadServicesAndRender);
})();
