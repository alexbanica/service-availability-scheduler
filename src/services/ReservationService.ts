import { DateTimeHelper } from '../helpers/DateTimeHelper';
import { ServiceListDto } from '../dtos/ServiceListDto';
import { ServiceStatusDto } from '../dtos/ServiceStatusDto';
import { ServiceDefinition } from '../entities/ServiceDefinition';
import { ReservationRepository } from '../repositories/ReservationRepository';
import { UserService } from './UserService';

export class ReservationService {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly userService: UserService,
    private readonly services: ServiceDefinition[],
    private readonly expiryWarningMinutes: number,
    private readonly autoRefreshMinutes: number,
  ) {}

  getServiceList(now: Date): Promise<ServiceListDto> {
    return this.buildServiceList(DateTimeHelper.toMysqlDateTime(now));
  }

  private async buildServiceList(nowIso: string): Promise<ServiceListDto> {
    const reservations =
      await this.reservationRepository.findActiveByServiceKey(nowIso);
    const reservationMap = new Map(
      reservations.map((reservation) => [reservation.serviceKey, reservation]),
    );
    const userIds = Array.from(
      new Set(reservations.map((reservation) => reservation.userId)),
    );
    const nicknameMap = await this.userService.getNicknamesByIds(userIds);

    const results = this.services.map((svc) => {
      const active = reservationMap.get(svc.key);
      const claimedBy =
        active?.claimedByLabel || (active ? nicknameMap.get(active.userId) : null);
      return new ServiceStatusDto(
        svc.key,
        svc.environmentId,
        svc.environment,
        svc.id,
        svc.label,
        svc.defaultMinutes,
        svc.owner,
        Boolean(active),
        claimedBy || null,
        active ? active.userId : null,
        active ? DateTimeHelper.mysqlDateTimeToIso(active.claimedAt) : null,
        active ? DateTimeHelper.mysqlDateTimeToIso(active.expiresAt) : null,
        Boolean(active?.claimedByTeam),
      );
    });

    return new ServiceListDto(
      this.expiryWarningMinutes,
      this.autoRefreshMinutes,
      results,
    );
  }

  async claim(
    serviceKey: string,
    userId: number,
    now: Date,
    claimedByLabel?: string | null,
    claimedByTeam?: boolean,
  ): Promise<string> {
    const service = this.findService(serviceKey);
    const nowIso = DateTimeHelper.toMysqlDateTime(now);

    const existing = await this.reservationRepository.findActiveByService(
      serviceKey,
      nowIso,
    );
    if (existing) {
      throw new Error('Service already claimed');
    }

    const trimmedLabel = (claimedByLabel || '').trim();
    if (claimedByTeam && !trimmedLabel) {
      throw new Error('Team name is required');
    }
    if (trimmedLabel.length > 255) {
      throw new Error('Team name is too long');
    }
    const effectiveLabel = claimedByTeam ? trimmedLabel : null;

    const expires = DateTimeHelper.toMysqlDateTime(
      new Date(now.getTime() + service.defaultMinutes * 60000),
    );

    await this.reservationRepository.insertReservation(
      service.key,
      service.environment,
      service.label,
      userId,
      effectiveLabel,
      Boolean(claimedByTeam),
      nowIso,
      expires,
    );

    return expires;
  }

  async release(serviceKey: string, userId: number, now: Date): Promise<void> {
    const nowIso = DateTimeHelper.toMysqlDateTime(now);
    const reservation = await this.reservationRepository.findActiveByService(
      serviceKey,
      nowIso,
    );
    if (!reservation) {
      throw new Error('Active reservation not found');
    }
    if (!reservation.claimedByTeam && reservation.userId !== userId) {
      throw new Error('Only the owner can release');
    }
    if (reservation.id === null) {
      throw new Error('Active reservation not found');
    }

    await this.reservationRepository.releaseReservation(reservation, nowIso);
  }

  async extend(serviceKey: string, userId: number, now: Date): Promise<string> {
    const service = this.findService(serviceKey);
    const nowIso = DateTimeHelper.toMysqlDateTime(now);
    const reservation = await this.reservationRepository.findActiveByService(
      serviceKey,
      nowIso,
    );
    if (!reservation) {
      throw new Error('Active reservation not found');
    }
    if (reservation.userId !== userId) {
      throw new Error('Only the owner can extend');
    }
    if (reservation.id === null) {
      throw new Error('Active reservation not found');
    }

    const base = DateTimeHelper.mysqlDateTimeToDate(reservation.expiresAt);
    if (!base) {
      throw new Error('Invalid expiry date');
    }

    const extended = DateTimeHelper.toMysqlDateTime(
      new Date(base.getTime() + service.defaultMinutes * 60000),
    );
    await this.reservationRepository.extendReservation(reservation, extended);
    return extended;
  }

  async listExpiring(
    userId: number,
    now: Date,
  ): Promise<
    Array<{
      service_key: string;
      environment_name: string;
      service_name: string;
      minutes_left: number;
    }>
  > {
    const warningIso = DateTimeHelper.toMysqlDateTime(
      new Date(now.getTime() + this.expiryWarningMinutes * 60000),
    );
    const nowIso = DateTimeHelper.toMysqlDateTime(now);

    const expiring = await this.reservationRepository.findExpiringByUser(
      userId,
      nowIso,
      warningIso,
    );

    return expiring
      .map((reservation) => {
        const expiresAt = DateTimeHelper.mysqlDateTimeToDate(
          reservation.expiresAt,
        );
        if (!expiresAt) {
          return null;
        }
        const minutesLeft = Math.max(
          0,
          Math.ceil((expiresAt.getTime() - now.getTime()) / 60000),
        );
        return {
          service_key: reservation.serviceKey,
          environment_name: reservation.environmentName,
          service_name: reservation.serviceName,
          minutes_left: minutesLeft,
        };
      })
      .filter(
        (
          row,
        ): row is {
          service_key: string;
          environment_name: string;
          service_name: string;
          minutes_left: number;
        } => Boolean(row),
      );
  }

  async cleanupExpired(now: Date): Promise<number> {
    const nowIso = DateTimeHelper.toMysqlDateTime(now);
    return this.reservationRepository.releaseExpired(nowIso);
  }

  private findService(serviceKey: string): ServiceDefinition {
    const service = this.services.find((svc) => svc.key === serviceKey);
    if (!service) {
      throw new Error('Service not found');
    }
    return service;
  }
}
