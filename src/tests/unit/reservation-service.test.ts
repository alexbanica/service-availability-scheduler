import test from 'node:test';
import assert from 'node:assert/strict';
import { ReservationService } from '../../services/ReservationService';
import { ServiceDefinition } from '../../entities/ServiceDefinition';

class FakeReservationRepository {
  constructor(
    private readonly reservations: Array<{ serviceKey: string }> = [],
  ) {}

  async findActiveByServiceKeys(): Promise<
    Array<{
      serviceKey: string;
      userId: string;
      claimedByLabel: string | null;
      claimedByTeam: boolean;
      claimedAt: string;
      expiresAt: string;
      environmentName: string;
      serviceName: string;
    }>
  > {
    return this.reservations.map((reservation) => ({
      serviceKey: reservation.serviceKey,
      userId: 'user-2',
      claimedByLabel: null,
      claimedByTeam: false,
      claimedAt: '2024-01-01 00:00:00',
      expiresAt: '2024-01-01 00:30:00',
      environmentName: 'Env',
      serviceName: 'Svc',
    }));
  }

  async findActiveByService(): Promise<null> {
    return null;
  }

  async insertReservation(): Promise<void> {
    return undefined;
  }
}

class FakeUserService {
  async getNicknamesByIds(): Promise<Map<string, string>> {
    return new Map([['user-2', 'Sam']]);
  }
}

class FakeServiceRepository {
  constructor(
    private readonly services: ServiceDefinition[],
    private readonly allowClaim: boolean,
  ) {}

  async listServiceEnvironmentsByUser(): Promise<ServiceDefinition[]> {
    return this.services;
  }

  async findEnvironmentByKeyForUser(): Promise<ServiceDefinition | null> {
    return this.allowClaim ? this.services[0] : null;
  }
}

test('getServiceList only returns member services', async () => {
  const services = [
    new ServiceDefinition(
      'svc:env',
      'svc',
      'Svc',
      'env',
      'Env',
      30,
      null,
      null,
      'workspace-1',
      'Core',
    ),
  ];
  const reservationService = new ReservationService(
    new FakeReservationRepository() as never,
    new FakeUserService() as never,
    new FakeServiceRepository(services, true) as never,
    5,
    2,
  );

  const list = await reservationService.getServiceList('user-1', new Date());
  assert.equal(list.services.length, 1);
  assert.equal(list.services[0].environments.length, 1);
  assert.equal(list.services[0].environments[0].serviceKey, 'svc:env');
});

test('claim rejects when service not in user workspace', async () => {
  const services = [
    new ServiceDefinition(
      'svc:env',
      'svc',
      'Svc',
      'env',
      'Env',
      30,
      null,
      null,
      'workspace-1',
      'Core',
    ),
  ];
  const reservationService = new ReservationService(
    new FakeReservationRepository() as never,
    new FakeUserService() as never,
    new FakeServiceRepository(services, false) as never,
    5,
    2,
  );

  await assert.rejects(
    () => reservationService.claim('svc:env', 'user-3', new Date()),
    /Service not found/,
  );
});
