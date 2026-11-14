import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("recent-links", "routes/recent-links/route.ts"),
  index("routes/home/route.tsx"),
  route("s/:code", "routes/redirect/route.tsx"),
] satisfies RouteConfig;
