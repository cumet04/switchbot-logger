import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://53f5a903731e07e39ea32248e65c6a22@o4506720064962560.ingest.sentry.io/4506819121709056",
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "local",

  tracesSampleRate: 1,
});
