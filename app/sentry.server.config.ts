import * as Sentry from "@sentry/nextjs";
import { appenv } from "./lib/envvars";

// MEMO: ここに書いても問題なくランタイムの環境変数が評価されるようだ
const environment = appenv();

Sentry.init({
  dsn: "https://53f5a903731e07e39ea32248e65c6a22@o4506720064962560.ingest.sentry.io/4506819121709056",
  environment,

  tracesSampler: (ctx) => {
    // MEMO: ctx.requestもctx.locationも何故か値が入らない
    const isRecordRequest =
      ctx.transactionContext.name === "POST /record/[slug]";
    if (isRecordRequest) {
      // recordは毎分1リクエストありquotaを圧迫するため、devは記録せずprdも数を減らす。
      // rateを0.1にすれば、月4,300程度/quota 10,000 に収まる
      return environment === "development" ? 0 : 0.1;
    }

    // その他のリクエストは全て記録
    return 1;
  },
});
