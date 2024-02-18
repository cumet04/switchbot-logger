import {TerraformVariable} from 'cdktf';
import {Construct} from 'constructs/lib/construct';

export type AppContext = {
  env: EnvType;
  gcpProjectId: TerraformVariable;
  gcpLocation: string;
  gcpBillingAccount: string;
};

export class BaseConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }

  get env() {
    return this.appContext.env;
  }

  get projectId() {
    return this.appContext.gcpProjectId;
  }

  get gcpLocation() {
    return this.appContext.gcpLocation;
  }

  get gcpBillingAccount() {
    return this.appContext.gcpBillingAccount;
  }

  private get appContext(): AppContext {
    return this.node.getContext('appContext') as AppContext;
  }
}
