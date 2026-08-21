import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("admin", "routes/admin._index.tsx"),
  route("admin/login", "routes/admin.login.tsx"),
  route("admin/logout", "routes/admin.logout.tsx"),
  route("admin/mfa", "routes/admin.mfa.tsx"),
  route("admin/mfa/enroll", "routes/admin.mfa.enroll.tsx"),
] satisfies RouteConfig;
