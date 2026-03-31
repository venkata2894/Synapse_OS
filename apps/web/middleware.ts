import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/",
  "/projects(.*)",
  "/tasks(.*)",
  "/agents(.*)",
  "/evaluations(.*)",
  "/tools(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  const testerBypassAuth =
    process.env.SENTIENTOPS_TESTER_AUTH_MODE === "local_bypass" ||
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  if (!testerBypassAuth && isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"]
};
