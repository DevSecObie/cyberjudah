/**
 * Security headers applied to every Worker response. The film is scrubbed from Blob URLs
 * (media-src blob:), the search runs the publication's Pagefind module in the browser
 * (script-src and connect-src for devsecobie.github.io), and class recordings embed from
 * youtube-nocookie.com.
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://devsecobie.github.io; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; media-src 'self' blob: https:; " +
      "connect-src 'self' https:; " +
      "frame-src 'self' https://www.youtube-nocookie.com https://auth.higgsfield.app https://auth.higgsfield-dev.app; " +
      "base-uri 'self'; form-action 'self'",
  );
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-XSS-Protection", "0");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
