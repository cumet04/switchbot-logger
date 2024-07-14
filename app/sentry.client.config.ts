import * as Sentry from "@sentry/nextjs";
import { appenv } from "@/lib/envvars";

const environment = appenv();

Sentry.init({
  dsn: "https://53f5a903731e07e39ea32248e65c6a22@o4506720064962560.ingest.sentry.io/4506819121709056",
  environment,
  enabled: environment !== "local",

  tracesSampleRate: 1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
});
