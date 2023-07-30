import {TerraformVariable} from 'cdktf';
import {Construct} from 'constructs/lib/construct';

export type AppContext = {
  env: EnvType;
  gcpProjectId: TerraformVariable;
  gcpLocation: string;
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

  private get appContext(): AppContext {
    return this.node.getContext('appContext') as AppContext;
  }
}
