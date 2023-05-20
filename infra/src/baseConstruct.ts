import {Construct} from 'constructs/lib/construct';

export class BaseConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }

  get env(): EnvType {
    const v = this.node.getContext('env') as string;
    if (v !== 'production' && v !== 'development')
      throw new Error('invalid env');
    return v;
  }

  get projectId() {
    return this.node.getContext('gcp_project_id') as string;
  }
}
