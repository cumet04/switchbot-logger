// Jestでnode本体のfetchをそのまま使う
// refs https://qiita.com/takano-h/items/506fa48493873bf7af41

import JSDOMEnvironment from "jest-environment-jsdom";

// https://github.com/facebook/jest/blob/v29.4.3/website/versioned_docs/version-29.4/Configuration.md#testenvironment-string
export default class FixJSDOMEnvironment extends JSDOMEnvironment {
  constructor(...args: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...args);

    // FIXME https://github.com/jsdom/jsdom/issues/1724
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this.global.fetch) {
      this.global.fetch = fetch;
      this.global.Headers = Headers;
      this.global.Request = Request;
      this.global.Response = Response;
    }
  }
}
