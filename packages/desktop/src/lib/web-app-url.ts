// Base URL of the Oscar web app. Used for deep-link redirects and for calling
// shared AI API routes (/api/ai/*). Override with VITE_WEB_APP_URL at build time.
export const WEB_APP_URL: string =
  import.meta.env.VITE_WEB_APP_URL ?? "https://oscar.samyarth.org";
