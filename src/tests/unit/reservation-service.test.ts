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
      userId: number;
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
      userId: 2,
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
  async getNicknamesByIds(): Promise<Map<number, string>> {
    return new Map([[2, 'Sam']]);
  }
}

class FakeServiceRepository {
  constructor(
    private readonly services: ServiceDefinition[],
    private readonly allowClaim: boolean,
  ) {}

  async listByUser(): Promise<ServiceDefinition[]> {
    return this.services;
  }

  async findByKeyForUser(): Promise<ServiceDefinition | null> {
    return this.allowClaim ? this.services[0] : null;
  }
}

test('getServiceList only returns member services', async () => {
  const services = [
    new ServiceDefinition(
      'env:svc',
      'env',
      'Env',
      'svc',
      'Svc',
      30,
      null,
      1,
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

  const list = await reservationService.getServiceList(10, new Date());
  assert.equal(list.services.length, 1);
  assert.equal(list.services[0].key, 'env:svc');
});

test('claim rejects when service not in user workspace', async () => {
  const services = [
    new ServiceDefinition(
      'env:svc',
      'env',
      'Env',
      'svc',
      'Svc',
      30,
      null,
      1,
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
    () => reservationService.claim('env:svc', 3, new Date()),
    /Service not found/,
  );
});
