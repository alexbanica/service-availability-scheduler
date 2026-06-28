import type { Express, Request, Response } from 'express';
import { WorkspaceService } from '../services/WorkspaceService';
import { requireAuth } from './AuthMiddleware';

const getAuthenticatedUserId = (req: Request, res: Response): string | null => {
  const userId = (req as { authenticatedUser?: { userId?: string } })
    .authenticatedUser?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return userId;
};

export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  register(app: Express): void {
    app.get(
      '/api/workspaces',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const list = await this.workspaceService.listWorkspaces(userId);
        res.json({
          workspaces: list.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            admin_user_id: workspace.adminUserId,
            user_count: workspace.userCount,
            service_count: workspace.serviceCount,
            owner_count: workspace.ownerCount,
            environment_count: workspace.environmentCount,
          })),
        });
      },
    );

    app.post(
      '/api/workspaces',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const name = String(req.body.name || '');
        try {
          const workspace = await this.workspaceService.createWorkspace(
            userId,
            name,
          );
          res.status(201).json({
            id: workspace.id,
            name: workspace.name,
            admin_user_id: workspace.adminUserId,
          });
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Workspace name required') {
            res.status(400).json({ error: message });
            return;
          }
          if (
            message === 'Not authorized to create workspaces' ||
            message === 'Workspace limit reached'
          ) {
            res.status(403).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.post(
      '/api/workspaces/:workspaceId/services',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        const environmentIds = Array.isArray(req.body.environment_ids)
          ? req.body.environment_ids.map((id: unknown) => String(id || '').trim())
          : [];
        const environmentNames = Array.isArray(req.body.environment_names)
          ? req.body.environment_names.map((name: unknown) => String(name || '').trim())
          : [];
        try {
          const result = await this.workspaceService.createService(
            workspaceId,
            userId,
            {
              environmentIds,
              environmentNames,
              serviceId: req.body.service_id
                ? String(req.body.service_id)
                : null,
              label: req.body.label ? String(req.body.label) : null,
              defaultMinutes: Number(req.body.default_minutes || 0),
              ownerId: req.body.owner_id ? String(req.body.owner_id) : null,
            },
          );
          res.status(201).json({
            service_id: result.serviceId,
            created_environments: result.createdEnvironments,
          });
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Workspace not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Not authorized for workspace') {
            res.status(403).json({ error: message });
            return;
          }
          if (message === 'Service not found') {
            res.status(404).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.patch(
      '/api/workspaces/:workspaceId/services/:serviceId',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        const serviceId = decodeURIComponent(String(req.params.serviceId));
        const environmentIds = Array.isArray(req.body.environment_ids)
          ? req.body.environment_ids.map((id: unknown) => String(id || '').trim())
          : [];
        const environmentNames = Array.isArray(req.body.environment_names)
          ? req.body.environment_names.map((name: unknown) => String(name || '').trim())
          : [];
        try {
          const result = await this.workspaceService.updateService(
            workspaceId,
            userId,
            {
              serviceId,
              environmentIds,
              environmentNames,
              label: req.body.label ? String(req.body.label) : '',
              defaultMinutes: Number(req.body.default_minutes || 0),
              ownerId: req.body.owner_id ? String(req.body.owner_id) : null,
            },
          );
          res.json({
            service_id: result.serviceId,
          });
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Workspace not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Not authorized for workspace') {
            res.status(403).json({ error: message });
            return;
          }
          if (message === 'Service not found') {
            res.status(404).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.delete(
      '/api/workspaces/:workspaceId/services/:serviceId',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        const serviceId = decodeURIComponent(String(req.params.serviceId));
        try {
          await this.workspaceService.deleteService(
            workspaceId,
            userId,
            serviceId,
          );
          res.status(204).send();
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Workspace not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Not authorized for workspace') {
            res.status(403).json({ error: message });
            return;
          }
          if (message === 'Service not found') {
            res.status(404).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.get(
      '/api/workspaces/:workspaceId/services',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        try {
          const catalog = await this.workspaceService.listServiceCatalog(
            workspaceId,
            userId,
          );
          res.json({
            services: catalog.map((svc) => ({
              service_id: svc.serviceId,
              label: svc.label,
              owner: svc.owner,
              owner_id: svc.ownerId,
              default_minutes: svc.defaultMinutes,
              environments: svc.environments.map((env) => ({
                environment_id: env.environmentId,
                environment_name: env.environmentName,
              })),
            })),
          });
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Workspace not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Not authorized for workspace') {
            res.status(403).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.get(
      '/api/workspaces/:workspaceId/environments',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        try {
          const environments = await this.workspaceService.listEnvironments(
            workspaceId,
            userId,
          );
          res.json({
            environments: environments.map((env) => ({
              environment_id: env.environmentId,
              environment_name: env.environmentName,
            })),
          });
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Workspace not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Not authorized for workspace') {
            res.status(403).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.post(
      '/api/workspaces/:workspaceId/environments',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        try {
          const environment = await this.workspaceService.createEnvironment(
            workspaceId,
            userId,
            { name: String(req.body.name || '') },
          );
          res.status(201).json({
            environment_id: environment.environmentId,
          });
        } catch (err) {
          this.writeWorkspaceError(res, (err as Error).message);
        }
      },
    );

    app.get(
      '/api/workspaces/:workspaceId/owners',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        try {
          const owners = await this.workspaceService.listOwners(
            workspaceId,
            userId,
          );
          res.json({
            owners: owners.map((item) => ({
              owner_id: item.ownerId,
              name: item.name,
            })),
          });
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Workspace not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Not authorized for workspace') {
            res.status(403).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.post(
      '/api/workspaces/:workspaceId/owners',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        try {
          const owner = await this.workspaceService.createOwner(
            workspaceId,
            userId,
            { name: String(req.body.name || '') },
          );
          res.status(201).json({
            owner_id: owner.ownerId,
          });
        } catch (err) {
          this.writeWorkspaceError(res, (err as Error).message);
        }
      },
    );

    app.get(
      '/api/workspaces/:workspaceId/detail/users',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        try {
          const items = await this.workspaceService.listWorkspacePopupRows(
            workspaceId,
            userId,
            'users',
          );
          res.json({ items });
        } catch (err) {
          this.writeWorkspaceError(res, (err as Error).message);
        }
      },
    );

    app.get(
      '/api/workspaces/:workspaceId/detail/services',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        try {
          const items = await this.workspaceService.listWorkspacePopupRows(
            workspaceId,
            userId,
            'services',
          );
          res.json({ items });
        } catch (err) {
          this.writeWorkspaceError(res, (err as Error).message);
        }
      },
    );

    app.get(
      '/api/workspaces/:workspaceId/detail/owners',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        try {
          const items = await this.workspaceService.listWorkspacePopupRows(
            workspaceId,
            userId,
            'owners',
          );
          res.json({ items });
        } catch (err) {
          this.writeWorkspaceError(res, (err as Error).message);
        }
      },
    );

    app.get(
      '/api/workspaces/:workspaceId/detail/environments',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        try {
          const items = await this.workspaceService.listWorkspacePopupRows(
            workspaceId,
            userId,
            'environments',
          );
          res.json({ items });
        } catch (err) {
          this.writeWorkspaceError(res, (err as Error).message);
        }
      },
    );

    app.post(
      '/api/workspaces/:workspaceId/invitations',
      requireAuth,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
          return;
        }
        const workspaceId = String(req.params.workspaceId || '');
        const inviteeEmail = String(req.body.email || '');
        try {
          const invitation = await this.workspaceService.inviteUser(
            workspaceId,
            userId,
            inviteeEmail,
          );
          res.status(201).json({
            invitation_id: invitation.invitationId,
            workspace_id: invitation.workspaceId,
            invited_user_id: invitation.invitedUserId,
            invited_by_user_id: invitation.invitedByUserId,
            status: invitation.status,
          });
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Workspace not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Invitee not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Not authorized for workspace') {
            res.status(403).json({ error: message });
            return;
          }
          if (
            message === 'Invitation already pending' ||
            message === 'User already in workspace'
          ) {
            res.status(409).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );
  }

  private writeWorkspaceError(res: Response, message: string): void {
    if (message === 'Workspace not found') {
      res.status(404).json({ error: message });
      return;
    }
    if (message === 'Not authorized for workspace') {
      res.status(403).json({ error: message });
      return;
    }
    if (
      message === 'Owner already exists' ||
      message === 'Environment already exists'
    ) {
      res.status(409).json({ error: message });
      return;
    }
    res.status(400).json({ error: message });
  }
}
