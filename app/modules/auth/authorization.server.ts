import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "react-router";

import type { Database } from "../../types/database.generated";
import { createAuthenticatedSupabaseClient } from "./supabase.server";
import { usesPreviewPasswordAuth } from "./preview-password.server";
import {
  clearSessionCookie,
  createSessionCookie,
  readSessionCookie,
  sealSession,
  sessionFromSupabase,
  unsealSession,
  type AdminSessionPayload,
} from "./session.server";

export interface AuthenticatedRequest {
  client: SupabaseClient<Database>;
  cookie: string | null;
  payload: AdminSessionPayload;
  session: Session;
  user: User;
}

function loginRedirect(): never {
  throw redirect("/admin/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

async function restoreAuthenticatedRequest(
  request: Request,
  env: Env,
): Promise<AuthenticatedRequest> {
  const cookieValue = readSessionCookie(request);
  if (!cookieValue) loginRedirect();

  const payload = await unsealSession(cookieValue, env.SESSION_SECRET);
  if (!payload) loginRedirect();

  const client = createAuthenticatedSupabaseClient(env);
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
  });
  if (sessionError || !sessionData.session) loginRedirect();

  const { data: userData, error: userError } = await client.auth.getUser(
    sessionData.session.access_token,
  );
  if (userError || !userData.user) loginRedirect();

  const updatedPayload = sessionFromSupabase(sessionData.session, payload.csrfToken);
  const tokensChanged =
    updatedPayload.accessToken !== payload.accessToken ||
    updatedPayload.refreshToken !== payload.refreshToken;

  return {
    client,
    cookie: tokensChanged
      ? createSessionCookie(await sealSession(updatedPayload, env.SESSION_SECRET))
      : null,
    payload: updatedPayload,
    session: sessionData.session,
    user: userData.user,
  };
}

async function callAuthorizationProbe(
  client: SupabaseClient<Database>,
  functionName: "is_current_admin" | "is_current_admin_aal2",
): Promise<boolean> {
  const { data, error } = await client.rpc(functionName);
  if (error) throw new Error("Administrator authorization check failed");
  return data === true;
}

export async function requireAdminIdentity(
  request: Request,
  env: Env,
): Promise<AuthenticatedRequest> {
  const auth = await restoreAuthenticatedRequest(request, env);
  if (!(await callAuthorizationProbe(auth.client, "is_current_admin"))) {
    await auth.client.auth.signOut({ scope: "global" });
    loginRedirect();
  }
  return auth;
}

export async function requireAdminAal2(request: Request, env: Env): Promise<AuthenticatedRequest> {
  // Keep the historical entry point for existing routes. The preview exception
  // requires both an isolated Worker configuration and a matching database policy.
  const passwordOnlyPreview = usesPreviewPasswordAuth(env);
  const auth = await requireAdminIdentity(request, env);
  if (passwordOnlyPreview) {
    if (!(await callAuthorizationProbe(auth.client, "is_current_admin_aal2"))) {
      loginRedirect();
    }
    return auth;
  }
  const { data, error } = await auth.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) loginRedirect();

  if (data.currentLevel !== "aal2") {
    const { data: factors, error: factorsError } = await auth.client.auth.mfa.listFactors();
    if (factorsError) loginRedirect();
    const hasVerifiedTotp = factors.totp.some((factor) => factor.status === "verified");
    throw redirect(hasVerifiedTotp ? "/admin/mfa" : "/admin/mfa/enroll", {
      headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
    });
  }

  if (!(await callAuthorizationProbe(auth.client, "is_current_admin_aal2"))) loginRedirect();
  return auth;
}
