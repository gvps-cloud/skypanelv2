import express, { type Express, type RequestHandler } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

interface AuthedUser {
  id: string;
  organizationId: string;
  role: string;
  [key: string]: unknown;
}

type AuthOverrides = Partial<AuthedUser>;

export function buildAuthedRequest(
  userOverrides?: AuthOverrides
): {
  createApp: (router: express.Router, ...handlers: RequestHandler[]) => Express;
  authUser: AuthedUser;
} {
  const authUser: AuthedUser = {
    id: "00000000-0000-0000-0000-000000000001",
    organizationId: "org-uuid-001",
    role: "user",
    ...userOverrides,
  };

  function createApp(
    router: express.Router,
    ...extraHandlers: RequestHandler[]
  ): Express {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      Object.assign(req, {
        user: authUser,
        isAuthenticated: () => true,
      } as any);
      next();
    });
    for (const h of extraHandlers) {
      app.use(h as RequestHandler);
    }
    app.use("/", router);
    return app;
  }

  return { createApp, authUser };
}

export function asAdmin(userOverrides?: AuthOverrides) {
  return buildAuthedRequest({ role: "admin", ...userOverrides });
}

export function asOrgMember(userOverrides?: AuthOverrides) {
  return buildAuthedRequest({ role: "user", ...userOverrides });
}
