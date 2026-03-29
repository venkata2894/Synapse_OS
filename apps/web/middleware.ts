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
  const devBypassAuth = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  if (!devBypassAuth && isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"]
};
