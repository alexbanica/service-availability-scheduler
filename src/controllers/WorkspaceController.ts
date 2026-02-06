import type { Express, Request, Response } from 'express';
import { WorkspaceService } from '../services/WorkspaceService';
import { requireAuth } from './AuthMiddleware';

export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  register(app: Express): void {
    app.get(
      '/api/workspaces',
      requireAuth,
      async (req: Request, res: Response) => {
        const list = await this.workspaceService.listWorkspaces(
          req.session.userId as number,
        );
        res.json({
          workspaces: list.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            admin_user_id: workspace.adminUserId,
          })),
        });
      },
    );

    app.post(
      '/api/workspaces',
      requireAuth,
      async (req: Request, res: Response) => {
        const name = String(req.body.name || '');
        try {
          const workspace = await this.workspaceService.createWorkspace(
            req.session.userId as number,
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
        const workspaceId = Number(req.params.workspaceId);
        try {
          const result = await this.workspaceService.createService(
            workspaceId,
            req.session.userId as number,
            {
              environmentId: String(req.body.environment_id || ''),
              environmentName: String(req.body.environment_name || ''),
              serviceId: String(req.body.service_id || ''),
              label: req.body.label ? String(req.body.label) : null,
              defaultMinutes: Number(req.body.default_minutes || 0),
              owner: req.body.owner ? String(req.body.owner) : null,
            },
          );
          res.status(201).json({
            id: result.id,
            service_key: result.serviceKey,
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
          if (message === 'Service already exists') {
            res.status(409).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.delete(
      '/api/workspaces/:workspaceId/services/:serviceKey',
      requireAuth,
      async (req: Request, res: Response) => {
        const workspaceId = Number(req.params.workspaceId);
        const serviceKey = decodeURIComponent(String(req.params.serviceKey));
        try {
          await this.workspaceService.deleteService(
            workspaceId,
            req.session.userId as number,
            serviceKey,
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
        const workspaceId = Number(req.params.workspaceId);
        try {
          const catalog = await this.workspaceService.listServiceCatalog(
            workspaceId,
            req.session.userId as number,
          );
          res.json({
            services: catalog.map((svc) => ({
              service_id: svc.serviceId,
              label: svc.label,
              owner: svc.owner,
              default_minutes: svc.defaultMinutes,
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
        const workspaceId = Number(req.params.workspaceId);
        try {
          const environments = await this.workspaceService.listEnvironments(
            workspaceId,
            req.session.userId as number,
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

    app.get(
      '/api/workspaces/:workspaceId/owners',
      requireAuth,
      async (req: Request, res: Response) => {
        const workspaceId = Number(req.params.workspaceId);
        try {
          const owners = await this.workspaceService.listOwners(
            workspaceId,
            req.session.userId as number,
          );
          res.json({
            owners: owners.map((item) => item.owner),
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
      '/api/workspaces/:workspaceId/invitations',
      requireAuth,
      async (req: Request, res: Response) => {
        const workspaceId = Number(req.params.workspaceId);
        const inviteeEmail = String(req.body.email || '');
        try {
          const invitation = await this.workspaceService.inviteUser(
            workspaceId,
            req.session.userId as number,
            inviteeEmail,
          );
          res.status(201).json({
            id: invitation.id,
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
}
