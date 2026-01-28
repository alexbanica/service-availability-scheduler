const state = {
  user: null,
  services: [],
  expiryWarningMinutes: 5,
  autoRefreshMinutes: 2
};

export function getState() {
  return { ...state };
}

export function setUser(user) {
  state.user = user;
}

export function setServices(services, expiryWarningMinutes) {
  state.services = services;
  state.expiryWarningMinutes = expiryWarningMinutes;
}

export function setAutoRefreshMinutes(minutes) {
  state.autoRefreshMinutes = minutes;
}
