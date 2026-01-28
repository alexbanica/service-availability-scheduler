import { apiGet, apiPost } from '../infrastructure/apiClient.js';
import { setAutoRefreshMinutes, setServices, setUser } from './servicesStore.js';

export async function loadUser() {
  const response = await apiGet('/api/me');
  if (!response.ok) {
    window.location.href = '/login';
    return null;
  }
  const user = await response.json();
  setUser(user);
  return user;
}

export async function loadServices() {
  const response = await apiGet('/api/services');
  if (!response.ok) {
    throw new Error('Failed to load services');
  }
  const data = await response.json();
  setServices(data.services, data.expiry_warning_minutes);
  if (typeof data.auto_refresh_minutes === 'number') {
    setAutoRefreshMinutes(data.auto_refresh_minutes);
  }
  return data;
}

export async function claimService(serviceKey) {
  const response = await apiPost('/api/claim', { service_key: serviceKey });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Unable to claim service');
  }
  return response.json();
}

export async function releaseService(serviceKey) {
  const response = await apiPost('/api/release', { service_key: serviceKey });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Unable to release service');
  }
  return response.json();
}

export async function extendService(serviceKey) {
  const response = await apiPost('/api/extend', { service_key: serviceKey });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Unable to extend service');
  }
  return response.json();
}

export async function logout() {
  await apiPost('/api/logout');
  window.location.href = '/login';
}
