// edge環境で動かす想定は無いが、どうもCloudBuild環境がedge扱いになるのか
// @sentry/nextjsがwarningを吐くため、見た目上のinitは行っておく。
// ただし実際に実行されるのは想定外なので、エラーさせる。
// なおNext.jsにedgeを無効化する機能は無いらしい。
// > [@sentry/nextjs] You are using Next.js features that run on the Edge Runtime.
// > Please add a "sentry.edge.config.js" or a "sentry.edge.config.ts" file
// > to your project root in which you initialize the Sentry SDK with "Sentry.init()".

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://53f5a903731e07e39ea32248e65c6a22@o4506720064962560.ingest.sentry.io/4506819121709056",

  debug: true,
  tracesSampler: () => {
    throw new Error("Not implemented");
  },
});
