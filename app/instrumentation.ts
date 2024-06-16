import * as Sentry from "@sentry/nextjs";
import { appenv } from "./lib/envvars";

const dsn =
  "https://53f5a903731e07e39ea32248e65c6a22@o4506720064962560.ingest.sentry.io/4506819121709056";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const environment = appenv();
    Sentry.init({
      dsn,
      environment,
      enabled: environment !== "local",

      tracesSampler: (ctx) => {
        // MEMO: ctx.requestもctx.locationも何故か値が入らない
        const isRecordRequest =
          ctx.transactionContext.name === "POST /record/[slug]";
        if (isRecordRequest) {
          // recordは毎分1リクエストありquotaを圧迫するため、stgは記録せずprdも数を減らす。
          // rateを0.1にすれば、月4,300程度/quota 10,000 に収まる
          return environment === "staging" ? 0 : 0.1;
        }

        // その他のリクエストは全て記録
        return 1;
      },
    });
  }
  // MEMO: edge環境は想定していない
}
