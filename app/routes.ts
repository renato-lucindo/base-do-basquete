import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("admin", "routes/admin._index.tsx"),
  route("admin/login", "routes/admin.login.tsx"),
  route("admin/logout", "routes/admin.logout.tsx"),
  route("admin/mfa", "routes/admin.mfa.tsx"),
  route("admin/mfa/enroll", "routes/admin.mfa.enroll.tsx"),
  route(
    "admin/competitions/:competitionId/scoresheets/new",
    "routes/admin.competitions.$competitionId.scoresheets.new.tsx",
  ),
  route("admin/competitions/:competitionId", "routes/admin.competitions.$competitionId.tsx"),
  route(":year/:competition/:category/:resource", "routes/public-context.tsx"),
  route(":year/:competition/:category/:resource/:detail", "routes/public-detail.tsx"),
] satisfies RouteConfig;
