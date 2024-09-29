import * as Sentry from "@sentry/nextjs";
import { appenv } from "./lib/envvars";

const dsn =
  "https://53f5a903731e07e39ea32248e65c6a22@o4506720064962560.ingest.sentry.io/4506819121709056";

let initialized = false;

// MEMO: instrumentationはランタイムだけでなくビルドタイムでも動くようだ

export function register() {
  // registerがN回呼ばれる仕様？バグ？があるらしいので検知処理を入れておく
  // refs https://github.com/vercel/next.js/issues/51450
  console.log("instrumentation is fired");
  if (initialized) return;
  initialized = true;

  // MEMO: runtimeはnodejsのみを想定しており仕様上はデフォルトでnodejsで起動するはずだが
  // edgeで起動してしまう (正確にはprocess.env.NEXT_RUNTIMEがedgeを返す) バグがあるので
  // 環境分岐はせずどちらの場合でも実行するようにしている
  // instrumentationが安定したら（そんなことあるのか？）分岐を入れてもいいかもしれない
  // refs https://github.com/vercel/next.js/issues/61728

  const environment = appenv();
  Sentry.init({
    dsn,
    environment,
    enabled: environment !== "local",

    tracesSampler: (ctx) => {
      // MEMO: ctx.requestもctx.locationも何故か値が入らない
      switch (ctx.name) {
        case "POST /record":
          // recordは毎分1リクエストありquotaを圧迫するため、stgは記録せずprdも数を減らす。
          // rateを0.1にすれば、月4,300程度/quota 10,000 に収まる
          return environment === "staging" ? 0 : 0.1;
        case "GET /viewer":
          // viewerも本番は自動更新で10分毎にリクエストがあるため適当に削る。
          // stagingはつけっぱなしにしないし、検証できた方が良いので削らない
          return environment === "staging" ? 1 : 0.3;
        default:
          // その他のリクエストは全て記録
          return 1;
      }
    },
  });
}
