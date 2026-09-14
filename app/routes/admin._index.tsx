import { redirect } from "react-router";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import type { Route } from "./+types/admin._index";
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const savedPlayer = new URL(request.url).searchParams.get("savedPlayer");
  const target =
    savedPlayer && /^[1-9][0-9]*$/.test(savedPlayer)
      ? `/admin/players?savedPlayer=${savedPlayer}`
      : "/admin/competitions";
  throw redirect(target, { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined });
}
