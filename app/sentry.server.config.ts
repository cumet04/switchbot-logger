import * as Sentry from "@sentry/nextjs";

const environment = process.env.NEXT_PUBLIC_APP_ENV ?? "local";
Sentry.init({
  dsn: "https://53f5a903731e07e39ea32248e65c6a22@o4506720064962560.ingest.sentry.io/4506819121709056",
  environment,

  tracesSampler: (ctx) => {
    const isRecordRequest =
      ctx.request?.url?.startsWith("/record") && ctx.request.method === "POST";
    if (isRecordRequest) {
      // recordは毎分1リクエストありquotaを圧迫するため、devは記録せずprdも数を減らす。
      // rateを0.1にすれば、月4,300程度/quota 10,000 に収まる
      return environment === "development" ? 0 : 0.1;
    }

    // その他のリクエストは全て記録
    return 1;
  },
});
