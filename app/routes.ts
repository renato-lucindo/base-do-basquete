import { index, type RouteConfig, route } from "@react-router/dev/routes";

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
  route(
    "admin/competitions/:competitionId/boxscores/import",
    "routes/admin.competitions.$competitionId.boxscores.import.tsx",
  ),
  route(
    "admin/competitions/:competitionId/data-profile",
    "routes/admin.competitions.$competitionId.data-profile.tsx",
  ),
  route("admin/competitions/:competitionId", "routes/admin.competitions.$competitionId.tsx"),
  route("api/public-search", "routes/api.public-search.tsx"),
  route("api/admin/players", "routes/api.admin-players.tsx"),
  route(":year/:competition/:category/masculino/:resource", "routes/public-context.tsx", {
    id: "public-context-male",
  }),
  route(":year/:competition/:category/feminino/:resource", "routes/public-context.tsx", {
    id: "public-context-female",
  }),
  route(":year/:competition/:category/masculino/:resource/:detail", "routes/public-detail.tsx", {
    id: "public-detail-male",
  }),
  route(":year/:competition/:category/feminino/:resource/:detail", "routes/public-detail.tsx", {
    id: "public-detail-female",
  }),
  route(":year/:competition/:category/:resource", "routes/public-legacy-context.tsx"),
  route(":year/:competition/:category/:resource/:detail", "routes/public-legacy-detail.tsx"),
] satisfies RouteConfig;
