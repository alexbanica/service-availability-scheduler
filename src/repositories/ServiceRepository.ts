import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { ServiceDefinition } from '../entities/ServiceDefinition';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type ServiceEnvironmentRow = RowDataPacket & {
  service_key: string;
  service_id: string;
  label: string;
  default_minutes: number;
  owner_id: string | null;
  owner_name: string | null;
  workspace_id: string;
  workspace_name: string;
  environment_id: string;
  environment_name: string;
};

type OwnerSummaryRow = RowDataPacket & {
  owner_id: string;
  name: string;
};

type ServiceScopeRow = RowDataPacket & {
  service_id: string;
  workspace_id: string;
  label: string;
  default_minutes: number;
  owner_id: string | null;
};

export class ServiceRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  withConnection(connection: MysqlConnection): ServiceRepository {
    return new ServiceRepository(connection);
  }

  async listServiceEnvironmentsByUser(
    userId: string,
  ): Promise<ServiceDefinition[]> {
    const rows = await this.all<ServiceEnvironmentRow>(
      `SELECT s.service_id AS service_id,
              s.label,
              s.default_minutes,
              s.owner_id,
              o.name AS owner_name,
              s.workspace_id,
              w.name AS workspace_name,
              e.environment_id,
              e.name AS environment_name,
              se.service_key
       FROM services s
       INNER JOIN service_environments se ON se.service_id = s.service_id
       INNER JOIN environments e ON e.environment_id = se.environment_id
       INNER JOIN workspaces w ON w.workspace_id = s.workspace_id
       INNER JOIN workspace_users wu ON wu.workspace_id = s.workspace_id
       LEFT JOIN owners o ON o.owner_id = s.owner_id
       WHERE wu.user_id = ?
       ORDER BY s.label, e.name`,
      [userId],
    );
    return rows.map(
      (row) =>
        new ServiceDefinition(
          row.service_key,
          row.service_id,
          row.label,
          row.environment_id,
          row.environment_name,
          row.default_minutes,
          row.owner_id,
          row.owner_name,
          row.workspace_id,
          row.workspace_name,
        ),
    );
  }

  async findEnvironmentByKeyForUser(
    serviceKey: string,
    userId: string,
  ): Promise<ServiceDefinition | null> {
    const row = await this.get<ServiceEnvironmentRow>(
      `SELECT s.service_id AS service_id,
              s.label,
              s.default_minutes,
              s.owner_id,
              o.name AS owner_name,
              s.workspace_id,
              w.name AS workspace_name,
              e.environment_id,
              e.name AS environment_name,
              se.service_key
       FROM services s
       INNER JOIN service_environments se ON se.service_id = s.service_id
       INNER JOIN environments e ON e.environment_id = se.environment_id
       INNER JOIN workspaces w ON w.workspace_id = s.workspace_id
       INNER JOIN workspace_users wu ON wu.workspace_id = s.workspace_id
       LEFT JOIN owners o ON o.owner_id = s.owner_id
       WHERE se.service_key = ? AND wu.user_id = ?
       LIMIT 1`,
      [serviceKey, userId],
    );
    if (!row) {
      return null;
    }
    return new ServiceDefinition(
      row.service_key,
      row.service_id,
      row.label,
      row.environment_id,
      row.environment_name,
      row.default_minutes,
      row.owner_id,
      row.owner_name,
      row.workspace_id,
      row.workspace_name,
    );
  }

  async insertService(input: {
    workspaceId: string;
    serviceId: string;
    label: string;
    defaultMinutes: number;
    ownerId: string | null;
  }): Promise<string> {
    await this.run(
      `INSERT INTO services
       (workspace_id, service_id, label, default_minutes, owner_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.workspaceId,
        input.serviceId,
        input.label,
        input.defaultMinutes,
        input.ownerId,
      ],
    );
    return input.serviceId;
  }

  async findServiceByWorkspaceAndId(
    workspaceId: string,
    serviceId: string,
  ): Promise<{
    serviceId: string;
    workspaceId: string;
    label: string;
    defaultMinutes: number;
    ownerId: string | null;
  } | null> {
    const row = await this.get<ServiceScopeRow>(
      `SELECT service_id, workspace_id, label, default_minutes, owner_id
       FROM services
       WHERE workspace_id = ? AND service_id = ?
       LIMIT 1`,
      [workspaceId, serviceId],
    );
    if (!row) {
      return null;
    }
    return {
      serviceId: row.service_id,
      workspaceId: row.workspace_id,
      label: row.label,
      defaultMinutes: row.default_minutes,
      ownerId: row.owner_id,
    };
  }

  async isWorkspaceOwnerOwnedByWorkspace(
    workspaceId: string,
    ownerId: string,
  ): Promise<boolean> {
    const row = await this.get<RowDataPacket>(
      `SELECT owner_id
       FROM owners
       WHERE owner_id = ? AND workspace_id = ?
       LIMIT 1`,
      [ownerId, workspaceId],
    );
    return Boolean(row);
  }

  async findOwnerByWorkspaceAndName(
    workspaceId: string,
    name: string,
  ): Promise<{ ownerId: string } | null> {
    const row = await this.get<RowDataPacket & { owner_id: string }>(
      `SELECT owner_id
       FROM owners
       WHERE workspace_id = ? AND LOWER(name) = LOWER(?)
       LIMIT 1`,
      [workspaceId, name],
    );
    return row ? { ownerId: row.owner_id } : null;
  }

  async insertOwner(input: {
    workspaceId: string;
    ownerId: string;
    name: string;
  }): Promise<string> {
    await this.run(
      `INSERT INTO owners (owner_id, workspace_id, name)
       VALUES (?, ?, ?)`,
      [input.ownerId, input.workspaceId, input.name],
    );
    return input.ownerId;
  }

  async updateServiceMetadata(
    workspaceId: string,
    serviceId: string,
    label: string,
    defaultMinutes: number,
    ownerId: string | null,
  ): Promise<void> {
    await this.run(
      `UPDATE services
       SET label = ?, owner_id = ?, default_minutes = ?
       WHERE service_id = ? AND workspace_id = ?`,
      [label, ownerId, defaultMinutes, serviceId, workspaceId],
    );
  }

  async findEnvironmentByName(
    workspaceId: string,
    name: string,
  ): Promise<{ environmentId: string } | null> {
    const row = await this.get<RowDataPacket & { environment_id: string }>(
      `SELECT environment_id
       FROM environments
       WHERE workspace_id = ? AND LOWER(name) = LOWER(?)
       LIMIT 1`,
      [workspaceId, name],
    );
    return row ? { environmentId: row.environment_id } : null;
  }

  async findEnvironmentByWorkspaceAndNames(
    workspaceId: string,
    names: string[],
  ): Promise<Array<{ environmentId: string; environmentName: string }>> {
    if (!names.length) {
      return [];
    }
    const placeholders = names.map(() => '?').join(',');
    const rows = await this.all<
      RowDataPacket & { environment_id: string; name: string }
    >(
      `SELECT environment_id, name
       FROM environments
       WHERE workspace_id = ? AND LOWER(name) IN (${placeholders})`,
      [workspaceId, ...names.map((name) => name.toLowerCase())],
    );
    return rows.map((row) => ({
      environmentId: row.environment_id,
      environmentName: row.name,
    }));
  }

  async getEnvironmentById(
    workspaceId: string,
    environmentId: string,
  ): Promise<boolean> {
    const row = await this.get<RowDataPacket>(
      `SELECT environment_id
       FROM environments
       WHERE workspace_id = ? AND environment_id = ?
       LIMIT 1`,
      [workspaceId, environmentId],
    );
    return Boolean(row);
  }

  async insertEnvironment(input: {
    workspaceId: string;
    environmentId: string;
    name: string;
  }): Promise<string> {
    await this.run(
      `INSERT INTO environments (environment_id, workspace_id, name)
       VALUES (?, ?, ?)`,
      [input.environmentId, input.workspaceId, input.name],
    );
    return input.environmentId;
  }

  async insertServiceEnvironment(input: {
    serviceId: string;
    environmentId: string;
    serviceKey: string;
  }): Promise<void> {
    await this.run(
      `INSERT INTO service_environments
       (service_id, environment_id, service_key)
       VALUES (?, ?, ?)`,
      [input.serviceId, input.environmentId, input.serviceKey],
    );
  }

  async deleteServiceEnvironmentAssociationsNotIn(
    serviceId: string,
    environmentIds: string[],
  ): Promise<void> {
    if (!environmentIds.length) {
      await this.run('DELETE FROM service_environments WHERE service_id = ?', [
        serviceId,
      ]);
      return;
    }

    const placeholders = environmentIds.map(() => '?').join(',');
    await this.run(
      `DELETE FROM service_environments
       WHERE service_id = ?
       AND environment_id NOT IN (${placeholders})`,
      [serviceId, ...environmentIds],
    );
  }

  async listEnvironmentsByWorkspace(
    workspaceId: string,
  ): Promise<Array<{ environmentId: string; environmentName: string }>> {
    const rows = await this.all<
      RowDataPacket & { environment_id: string; environment_name: string }
    >(
      `SELECT environment_id, name AS environment_name
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

  async listOwnersByWorkspace(
    workspaceId: string,
  ): Promise<Array<{ ownerId: string; name: string }>> {
    const rows = await this.all<OwnerSummaryRow>(
      `SELECT owner_id, name
       FROM owners
       WHERE workspace_id = ?
       ORDER BY name`,
      [workspaceId],
    );
    return rows.map((row) => ({ ownerId: row.owner_id, name: row.name }));
  }

  async listServiceCatalogByWorkspace(workspaceId: string): Promise<
    Array<{
      serviceId: string;
      label: string;
      ownerId: string | null;
      ownerName: string | null;
      defaultMinutes: number;
      environmentId: string;
      environmentName: string;
    }>
  > {
    const rows = await this.all<
      RowDataPacket & {
        service_id: string;
        label: string;
        owner_id: string | null;
        owner_name: string | null;
        default_minutes: number;
        environment_id: string;
        environment_name: string;
      }
    >(
      `SELECT s.service_id, s.label, s.owner_id, o.name AS owner_name,
              s.default_minutes, e.environment_id, e.name AS environment_name
       FROM services s
       INNER JOIN service_environments se ON se.service_id = s.service_id
       INNER JOIN environments e ON e.environment_id = se.environment_id
       LEFT JOIN owners o ON o.owner_id = s.owner_id
       WHERE s.workspace_id = ?
       ORDER BY s.label, e.name`,
      [workspaceId],
    );
    return rows.map((row) => ({
      serviceId: row.service_id,
      label: row.label,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      defaultMinutes: row.default_minutes,
      environmentId: row.environment_id,
      environmentName: row.environment_name,
    }));
  }

  async listServiceSummariesByWorkspace(
    workspaceId: string,
  ): Promise<Array<{ serviceId: string; label: string }>> {
    const rows = await this.all<
      RowDataPacket & { service_id: string; label: string }
    >(
      `SELECT service_id, label
       FROM services
       WHERE workspace_id = ?
       ORDER BY label`,
      [workspaceId],
    );
    return rows.map((row) => ({
      serviceId: row.service_id,
      label: row.label,
    }));
  }

  async deleteServiceByWorkspaceAndId(
    workspaceId: string,
    serviceId: string,
  ): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE s, se
       FROM services s
       LEFT JOIN service_environments se ON se.service_id = s.service_id
       WHERE s.workspace_id = ? AND s.service_id = ?`,
      [workspaceId, serviceId],
    );
    return result.affectedRows;
  }
}
