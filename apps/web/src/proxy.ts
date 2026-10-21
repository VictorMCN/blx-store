import {
  NextResponse,
  type NextRequest,
} from "next/server";

const SAFE_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
]);

const STRIPE_WEBHOOK_PATH =
  "/api/payments/stripe/webhook";

function getTrustedOrigins(): Set<string> {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    throw new Error(
      "APP_URL must be configured for API origin protection.",
    );
  }

  const origins = new Set([
    new URL(appUrl).origin,
  ]);

  // Codespaces / local development proxy compatibility.
  // These origins are NEVER trusted in production.
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("https://localhost:3000");
  }

  return origins;
}

export function proxy(request: NextRequest) {
  if (
    SAFE_METHODS.has(request.method) ||
    request.nextUrl.pathname === STRIPE_WEBHOOK_PATH
  ) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  const fetchSite =
    request.headers.get("sec-fetch-site");

  const trustedOrigins = getTrustedOrigins();

  const invalidOrigin =
    origin === null ||
    !trustedOrigins.has(origin);

  const invalidFetchSite =
    fetchSite === "cross-site" ||
    fetchSite === "same-site";

  if (invalidOrigin || invalidFetchSite) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[BLX ORIGIN BLOCKED]", {
        origin,
        fetchSite,
        allowedOrigins: [...trustedOrigins],
      });
    }

    return NextResponse.json(
      {
        statusCode: 403,
        message: "Cross-origin request denied.",
        error: "Forbidden",
      },
      {
        status: 403,
        headers: {
          Vary: "Origin, Sec-Fetch-Site",
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
