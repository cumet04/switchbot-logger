import {Construct} from 'constructs';
import {BaseConstruct} from './baseConstruct';
import {SecretManagerSecret} from '@cdktf/provider-google/lib/secret-manager-secret';

export class Secret extends BaseConstruct {
  secretId: string;
  constructor(scope: Construct, name: string) {
    super(scope, `Secret_${name}`);

    const secret = new SecretManagerSecret(this, 'this', {
      secretId: name,
      replication: {
        auto: {},
      },
    });
    this.secretId = secret.secretId;
  }
}
