export function isAllowedRecordingUrl(targetUrl: string, allowedOrigins: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }

  return allowedOrigins.some((originPattern) => {
    const normalizedPattern = originPattern.endsWith("/*") ? originPattern.slice(0, -2) : originPattern;

    try {
      const allowed = new URL(normalizedPattern);
      return parsed.origin === allowed.origin && parsed.pathname.startsWith(pathPrefix(allowed.pathname));
    } catch {
      return false;
    }
  });
}

function pathPrefix(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export function originFor(targetUrl: string): string {
  return new URL(targetUrl).origin;
}
