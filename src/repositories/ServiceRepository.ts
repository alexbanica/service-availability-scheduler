import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { ServiceDefinition } from '../entities/ServiceDefinition';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type ServiceRow = RowDataPacket & {
  id: number;
  workspace_id: number;
  workspace_name: string;
  service_key: string;
  environment_id: string;
  environment_name: string;
  service_id: string;
  label: string;
  default_minutes: number;
  owner: string | null;
};

export class ServiceRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async listByUser(userId: number): Promise<ServiceDefinition[]> {
    const rows = await this.all<ServiceRow>(
      `SELECT s.service_key, s.environment_id, s.environment_name, s.service_id,
              s.label, s.default_minutes, s.owner, s.workspace_id, s.id,
              w.name AS workspace_name
       FROM services s
       INNER JOIN workspaces w ON w.id = s.workspace_id
       INNER JOIN workspace_users wu ON wu.workspace_id = s.workspace_id
       WHERE wu.user_id = ?
       ORDER BY s.environment_name, s.service_id`,
      [userId],
    );
    return rows.map(
      (row) =>
        new ServiceDefinition(
          row.service_key,
          row.environment_id,
          row.environment_name,
          row.service_id,
          row.label,
          row.default_minutes,
          row.owner,
          row.workspace_id,
          row.workspace_name,
        ),
    );
  }

  async findByKeyForUser(
    serviceKey: string,
    userId: number,
  ): Promise<ServiceDefinition | null> {
    const row = await this.get<ServiceRow>(
      `SELECT s.service_key, s.environment_id, s.environment_name, s.service_id,
              s.label, s.default_minutes, s.owner, s.workspace_id, s.id,
              w.name AS workspace_name
       FROM services s
       INNER JOIN workspaces w ON w.id = s.workspace_id
       INNER JOIN workspace_users wu ON wu.workspace_id = s.workspace_id
       WHERE s.service_key = ? AND wu.user_id = ?
       LIMIT 1`,
      [serviceKey, userId],
    );
    if (!row) {
      return null;
    }
    return new ServiceDefinition(
      row.service_key,
      row.environment_id,
      row.environment_name,
      row.service_id,
      row.label,
      row.default_minutes,
      row.owner,
      row.workspace_id,
      row.workspace_name,
    );
  }

  async insertService(input: {
    workspaceId: number;
    serviceKey: string;
    environmentId: string;
    environmentName: string;
    serviceId: string;
    label: string;
    defaultMinutes: number;
    owner: string | null;
  }): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO services
       (workspace_id, service_key, environment_id, environment_name, service_id, label, default_minutes, owner)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.workspaceId,
        input.serviceKey,
        input.environmentId,
        input.environmentName,
        input.serviceId,
        input.label,
        input.defaultMinutes,
        input.owner,
      ],
    );
    return result.insertId;
  }

  async listEnvironmentsByWorkspace(
    workspaceId: number,
  ): Promise<Array<{ environmentId: string; environmentName: string }>> {
    const rows = await this.all<
      RowDataPacket & { environment_id: string; environment_name: string }
    >(
      `SELECT DISTINCT environment_id, environment_name
       FROM services
       WHERE workspace_id = ?
       ORDER BY environment_name`,
      [workspaceId],
    );
    return rows.map((row) => ({
      environmentId: row.environment_id,
      environmentName: row.environment_name,
    }));
  }

  async listOwnersByWorkspace(workspaceId: number): Promise<string[]> {
    const rows = await this.all<RowDataPacket & { owner: string }>(
      `SELECT DISTINCT owner
       FROM services
       WHERE workspace_id = ? AND owner IS NOT NULL AND owner <> ''
       ORDER BY owner`,
      [workspaceId],
    );
    return rows.map((row) => row.owner);
  }

  async listServiceCatalogByWorkspace(
    workspaceId: number,
  ): Promise<
    Array<{
      serviceId: string;
      label: string;
      owner: string | null;
      defaultMinutes: number;
    }>
  > {
    const rows = await this.all<
      RowDataPacket & {
        service_id: string;
        label: string;
        owner: string | null;
        default_minutes: number;
      }
    >(
      `SELECT DISTINCT service_id, label, owner, default_minutes
       FROM services
       WHERE workspace_id = ?
       ORDER BY label`,
      [workspaceId],
    );
    return rows.map((row) => ({
      serviceId: row.service_id,
      label: row.label,
      owner: row.owner,
      defaultMinutes: row.default_minutes,
    }));
  }

  async deleteByWorkspaceAndKey(
    workspaceId: number,
    serviceKey: string,
  ): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM services WHERE workspace_id = ? AND service_key = ?`,
      [workspaceId, serviceKey],
    );
    return result.affectedRows;
  }
}
