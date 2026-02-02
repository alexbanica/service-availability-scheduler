import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { Reservation } from '../entities/Reservation';
import { AbstractMysqlRepository } from './AbstractMysqlRepository';

type ReservationRow = RowDataPacket & {
  id: number;
  service_key: string;
  environment_name: string;
  service_name: string;
  user_id: number;
  claimed_by_label: string | null;
  claimed_by_team: number;
  claimed_at: string | Date;
  expires_at: string | Date;
  released_at: string | null;
};

export class ReservationRepository extends AbstractMysqlRepository {
  constructor(db: Pool) {
    super(db);
  }

  async findActiveByService(
    serviceKey: string,
    now: string,
  ): Promise<Reservation | null> {
    const row = await this.get<ReservationRow>(
      `SELECT id, user_id, expires_at, service_key, environment_name, service_name,
              claimed_by_label, claimed_by_team, claimed_at, released_at
       FROM reservations
       WHERE service_key = ? AND released_at IS NULL AND expires_at > ?`,
      [serviceKey, now],
    );
    return row ? this.mapRow(row) : null;
  }

  async findActiveByServiceKey(now: string): Promise<Reservation[]> {
    const rows = await this.all<ReservationRow>(
      `SELECT r.service_key, r.environment_name, r.service_name, r.user_id,
              r.claimed_by_label, r.claimed_by_team,
              r.claimed_at, r.expires_at, r.released_at, r.id
       FROM reservations r
       WHERE r.released_at IS NULL AND r.expires_at > ?`,
      [now],
    );
    return rows.map((row) => this.mapRow(row));
  }

  async insertReservation(
    serviceKey: string,
    environmentName: string,
    serviceName: string,
    userId: number,
    claimedByLabel: string | null,
    claimedByTeam: boolean,
    claimedAt: string,
    expiresAt: string,
  ): Promise<Reservation> {
    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO reservations
       (service_key, environment_name, service_name, user_id, claimed_by_label, claimed_by_team, claimed_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serviceKey,
        environmentName,
        serviceName,
        userId,
        claimedByLabel,
        claimedByTeam ? 1 : 0,
        claimedAt,
        expiresAt,
      ],
    );
    return new Reservation(
      result.insertId || null,
      serviceKey,
      environmentName,
      serviceName,
      userId,
      claimedByLabel,
      claimedByTeam,
      claimedAt,
      expiresAt,
      null,
    );
  }

  async releaseReservation(
    reservation: Reservation,
    releasedAt: string,
  ): Promise<Reservation> {
    await this.run('UPDATE reservations SET released_at = ? WHERE id = ?', [
      releasedAt,
      reservation.id,
    ]);
    return new Reservation(
      reservation.id,
      reservation.serviceKey,
      reservation.environmentName,
      reservation.serviceName,
      reservation.userId,
      reservation.claimedByLabel,
      reservation.claimedByTeam,
      reservation.claimedAt,
      reservation.expiresAt,
      releasedAt,
    );
  }

  async extendReservation(
    reservation: Reservation,
    expiresAt: string,
  ): Promise<Reservation> {
    await this.run('UPDATE reservations SET expires_at = ? WHERE id = ?', [
      expiresAt,
      reservation.id,
    ]);
    return new Reservation(
      reservation.id,
      reservation.serviceKey,
      reservation.environmentName,
      reservation.serviceName,
      reservation.userId,
      reservation.claimedByLabel,
      reservation.claimedByTeam,
      reservation.claimedAt,
      expiresAt,
      reservation.releasedAt,
    );
  }

  async findExpiringByUser(
    userId: number,
    now: string,
    warningCutoff: string,
  ): Promise<Reservation[]> {
    const rows = await this.all<ReservationRow>(
      `SELECT r.id, r.user_id, r.service_key, r.environment_name, r.service_name,
              r.claimed_by_label, r.claimed_by_team, r.claimed_at, r.expires_at, r.released_at
       FROM reservations r
       WHERE r.user_id = ?
         AND r.released_at IS NULL
         AND r.expires_at > ?
         AND r.expires_at <= ?`,
      [userId, now, warningCutoff],
    );
    return rows.map((row) => this.mapRow(row));
  }

  async findExpiring(
    now: string,
    warningCutoff: string,
  ): Promise<Reservation[]> {
    const rows = await this.all<ReservationRow>(
      `SELECT r.id, r.user_id, r.service_key, r.environment_name, r.service_name,
              r.claimed_at, r.expires_at, r.released_at
       FROM reservations r
       WHERE r.released_at IS NULL
         AND r.expires_at > ?
         AND r.expires_at <= ?`,
      [now, warningCutoff],
    );
    return rows.map((row) => this.mapRow(row));
  }

  async releaseExpired(now: string): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE reservations
       SET released_at = ?
       WHERE released_at IS NULL AND expires_at <= ?`,
      [now, now],
    );
    return result.affectedRows || 0;
  }

  private mapRow(row: ReservationRow): Reservation {
    return new Reservation(
      row.id,
      row.service_key,
      row.environment_name,
      row.service_name,
      row.user_id,
      row.claimed_by_label,
      Boolean(row.claimed_by_team),
      row.claimed_at,
      row.expires_at,
      row.released_at,
    );
  }
}
