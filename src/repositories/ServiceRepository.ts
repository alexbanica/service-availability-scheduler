import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { ServiceDefinition } from '../entities/ServiceDefinition';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type ServiceEnvironmentRow = RowDataPacket & {
  service_id: number;
  service_uuid: string;
  workspace_id: number;
  workspace_name: string;
  service_key: string;
  environment_id: string;
  environment_name: string;
  label: string;
  default_minutes: number;
  owner: string | null;
};

export class ServiceRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async listServiceEnvironmentsByUser(
    userId: number,
  ): Promise<ServiceDefinition[]> {
    const rows = await this.all<ServiceEnvironmentRow>(
      `SELECT s.id AS service_id, s.service_id AS service_uuid, s.label,
              s.default_minutes, s.owner, s.workspace_id,
              w.name AS workspace_name,
              e.environment_id, e.name AS environment_name,
              se.service_key
       FROM services s
       INNER JOIN service_environments se ON se.service_id = s.id
       INNER JOIN environments e ON e.id = se.environment_id
       INNER JOIN workspaces w ON w.id = s.workspace_id
       INNER JOIN workspace_users wu ON wu.workspace_id = s.workspace_id
       WHERE wu.user_id = ?
       ORDER BY s.label, e.name`,
      [userId],
    );
    return rows.map(
      (row) =>
        new ServiceDefinition(
          row.service_key,
          row.service_uuid,
          row.label,
          row.environment_id,
          row.environment_name,
          row.default_minutes,
          row.owner,
          row.workspace_id,
          row.workspace_name,
        ),
    );
  }

  async findEnvironmentByKeyForUser(
    serviceKey: string,
    userId: number,
  ): Promise<ServiceDefinition | null> {
    const row = await this.get<ServiceEnvironmentRow>(
      `SELECT s.id AS service_id, s.service_id AS service_uuid, s.label,
              s.default_minutes, s.owner, s.workspace_id,
              w.name AS workspace_name,
              e.environment_id, e.name AS environment_name,
              se.service_key
       FROM services s
       INNER JOIN service_environments se ON se.service_id = s.id
       INNER JOIN environments e ON e.id = se.environment_id
       INNER JOIN workspaces w ON w.id = s.workspace_id
       INNER JOIN workspace_users wu ON wu.workspace_id = s.workspace_id
       WHERE se.service_key = ? AND wu.user_id = ?
       LIMIT 1`,
      [serviceKey, userId],
    );
    if (!row) {
      return null;
    }
    return new ServiceDefinition(
      row.service_key,
      row.service_uuid,
      row.label,
      row.environment_id,
      row.environment_name,
      row.default_minutes,
      row.owner,
      row.workspace_id,
      row.workspace_name,
    );
  }

  async insertService(input: {
    workspaceId: number;
    serviceId: string;
    label: string;
    defaultMinutes: number;
    owner: string | null;
  }): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO services
       (workspace_id, service_id, label, default_minutes, owner)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.workspaceId,
        input.serviceId,
        input.label,
        input.defaultMinutes,
        input.owner,
      ],
    );
    return result.insertId;
  }

  async findServiceByUuid(
    workspaceId: number,
    serviceId: string,
  ): Promise<{ id: number; serviceId: string } | null> {
    const row = await this.get<RowDataPacket & { id: number; service_id: string }>(
      `SELECT id, service_id
       FROM services
       WHERE workspace_id = ? AND service_id = ?
       LIMIT 1`,
      [workspaceId, serviceId],
    );
    if (!row) {
      return null;
    }
    return { id: row.id, serviceId: row.service_id };
  }

  async findEnvironmentByName(
    workspaceId: number,
    name: string,
  ): Promise<{ id: number; environmentId: string } | null> {
    const row = await this.get<
      RowDataPacket & { id: number; environment_id: string }
    >(
      `SELECT id, environment_id
       FROM environments
       WHERE workspace_id = ? AND name = ?
       LIMIT 1`,
      [workspaceId, name],
    );
    if (!row) {
      return null;
    }
    return { id: row.id, environmentId: row.environment_id };
  }

  async insertEnvironment(input: {
    workspaceId: number;
    environmentId: string;
    name: string;
  }): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO environments
       (workspace_id, environment_id, name)
       VALUES (?, ?, ?)`,
      [input.workspaceId, input.environmentId, input.name],
    );
    return result.insertId;
  }

  async insertServiceEnvironment(input: {
    serviceDbId: number;
    environmentDbId: number;
    serviceKey: string;
  }): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO service_environments
       (service_id, environment_id, service_key)
       VALUES (?, ?, ?)`,
      [input.serviceDbId, input.environmentDbId, input.serviceKey],
    );
    return result.insertId;
  }

  async listEnvironmentsByWorkspace(
    workspaceId: number,
  ): Promise<Array<{ environmentId: string; environmentName: string }>> {
    const rows = await this.all<
      RowDataPacket & { environment_id: string; environment_name: string }
    >(
      `SELECT DISTINCT environment_id, name AS environment_name
       FROM environments
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
      environmentId: string;
      environmentName: string;
    }>
  > {
    const rows = await this.all<
      RowDataPacket & {
        service_id: string;
        label: string;
        owner: string | null;
        default_minutes: number;
        environment_id: string;
        environment_name: string;
      }
    >(
      `SELECT s.service_id, s.label, s.owner, s.default_minutes,
              e.environment_id, e.name AS environment_name
       FROM services s
       INNER JOIN service_environments se ON se.service_id = s.id
       INNER JOIN environments e ON e.id = se.environment_id
       WHERE s.workspace_id = ?
       ORDER BY s.label, e.name`,
      [workspaceId],
    );
    return rows.map((row) => ({
      serviceId: row.service_id,
      label: row.label,
      owner: row.owner,
      defaultMinutes: row.default_minutes,
      environmentId: row.environment_id,
      environmentName: row.environment_name,
    }));
  }

  async deleteServiceByWorkspaceAndId(
    workspaceId: number,
    serviceId: string,
  ): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE s, se
       FROM services s
       LEFT JOIN service_environments se ON se.service_id = s.id
       WHERE s.workspace_id = ? AND s.service_id = ?`,
      [workspaceId, serviceId],
    );
    return result.affectedRows;
  }
}
