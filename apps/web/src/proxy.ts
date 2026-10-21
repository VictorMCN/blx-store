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

function getTrustedOrigin(): string {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    throw new Error(
      "APP_URL must be configured for API origin protection.",
    );
  }

  return new URL(appUrl).origin;
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

  const trustedOrigin = getTrustedOrigin();

  const invalidOrigin =
    origin !== trustedOrigin;

  const invalidFetchSite =
    fetchSite === "cross-site" ||
    fetchSite === "same-site";

  if (invalidOrigin || invalidFetchSite) {
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
