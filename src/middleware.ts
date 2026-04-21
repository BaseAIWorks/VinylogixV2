import { NextResponse, type NextRequest } from 'next/server';

// Blocks automated vulnerability scanners before they reach the app.
// Why: this app does not use WordPress / PHP / Symfony / Spring, yet ~80% of
// 404s come from bots scanning for those stacks. Returning 403 early avoids
// SSR work and lets the CDN cache the deny response per path.
//
// Safety: every pattern is either (a) start-anchored so it cannot collide
// with dynamic routes like /storefront/[slug] or /t/[token], or (b) matches
// file extensions this codebase never serves. The legitimate /admin/* app
// routes are NOT covered by these patterns — only phpMyAdmin-style names.
const SCANNER_PATTERNS: readonly RegExp[] = [
  // Server-side template extensions this stack never serves
  /\.(php|phtml|phar|php3|php4|php5|asp|aspx|jsp|jspa|cfm)(\?|\/|$)/,

  // Hidden config / credential files at any depth (also catches .env.local,
  // .env.production, .git/config, etc. via the literal-dot delimiter).
  /\/\.(env|git|aws|ssh|svn|hg|htaccess|htpasswd|ds_store)(\.|\/|$)/,

  // WordPress — start-anchored so user slugs containing "wp-" cannot collide
  /^\/(wp-admin|wp-login|wp-includes|wp-content|wp-json|wp-config|wordpress)(\/|$)/,
  /^\/wp\d*\//,
  /^\/(blog|site|news|test|shop|cms|web|new|old|main|portal)\/wp-/,
  /^\/\d{4}\/wp-/,
  /\/wlwmanifest\.xml$/,
  /\/xmlrpc\.php$/,

  // Symfony / Spring / Rails config probes
  /\/(parameters|application|configuration)\.ya?ml$/,
  /^\/(app\/)?config\/(parameters|database|security|config)\.(ya?ml|php|ini)$/,

  // Database admin tools — start-anchored
  /^\/(phpmyadmin|pma|myadmin|adminer|phpinfo|mysql|sqladmin)(\/|$)/,

  // Server status / info endpoints
  /^\/server-(status|info)(\/|$)/,

  // CGI
  /^\/cgi-bin\//,

  // IoT / router exploits (case-insensitive — scanners vary casing)
  /^\/(HNAP1|boaform|GponForm|goform|setup\.cgi)(\/|$)/i,

  // Backup / dump files at root
  /^\/[^/]+\.(sql|bak|backup|dump|old|orig)$/,

  // Common WordPress scan prefixes nested one level deep
  /^\/(wp|wordpress|blog|cms)\/(wp-admin|wp-includes|wp-content|wp-login)/,
];

function isScannerRequest(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  for (const pattern of SCANNER_PATTERNS) {
    if (pattern.test(lower)) return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  if (isScannerRequest(request.nextUrl.pathname)) {
    return new NextResponse(null, {
      status: 403,
      headers: {
        // Cache the deny response so repeat scanner hits on the same path
        // are served by the CDN without invoking the backend.
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals, image optimizer output, and known static files.
    // None of these paths can match scanner patterns, so skipping them is pure
    // perf with no loss of coverage.
    '/((?!_next/static|_next/image|_next/data|favicon\\.ico|manifest\\.json|icon-|logo|Background-|Hero-|app\\.png|Client-app|Invent-app|Statis-app|Devices_|Thatsit|Screenshot).*)',
  ],
};
