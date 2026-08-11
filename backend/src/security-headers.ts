import helmet from "helmet";

const googleMapSources = [
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
  "https://*.google.com",
] as const;

const tileImageSources = [
  "https://*.tile.openstreetmap.org",
  "https://tile.openstreetmap.org",
  "https://*.basemaps.cartocdn.com",
  "https://a.basemaps.cartocdn.com",
  "https://b.basemaps.cartocdn.com",
  "https://c.basemaps.cartocdn.com",
  "https://d.basemaps.cartocdn.com",
  "https://*.tile.opentopomap.org",
  "https://tile.opentopomap.org",
  "https://server.arcgisonline.com",
] as const;

export function buildCspDirectives() {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", ...googleMapSources],
    styleSrc: [
      "'self'",
      "https://fonts.googleapis.com",
      "https://maps.googleapis.com",
      "https://maps.gstatic.com",
    ],
    imgSrc: [
      "'self'",
      "data:",
      "blob:",
      ...tileImageSources,
      "https://*.googleapis.com",
      "https://*.gstatic.com",
      "https://*.google.com",
      "https://*.ggpht.com",
      "https://*.googleusercontent.com",
    ],
    connectSrc: ["'self'", ...tileImageSources, "https://*.googleapis.com", ...googleMapSources],
    fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://maps.gstatic.com"],
    frameSrc: ["'self'", "https://www.google.com", "https://maps.google.com"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: null,
  };
}

export function securityHeadersMiddleware(isProduction: boolean) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: buildCspDirectives(),
    },
    frameguard: { action: "deny" },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: isProduction
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
  });
}
