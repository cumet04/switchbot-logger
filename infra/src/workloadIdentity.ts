import {Construct} from 'constructs';
import {BaseConstruct} from './baseConstruct';
import {ServiceAccount} from '@cdktf/provider-google/lib/service-account';
import {IamWorkloadIdentityPool} from '@cdktf/provider-google/lib/iam-workload-identity-pool';
import {IamWorkloadIdentityPoolProvider} from '@cdktf/provider-google/lib/iam-workload-identity-pool-provider';
import {ServiceAccountIamMember} from '@cdktf/provider-google/lib/service-account-iam-member';

// 与えたサービスアカウントに対してWorkload Identityを有効化するためのリソース群を定義する。
// MEMO: 現時点ではGitHub Actions用に決め打ちしている
export class WorkloadIdentityResources extends BaseConstruct {
  constructor(
    scope: Construct,
    name: string,
    config: {
      serviceAccount: ServiceAccount;
      repositoryName: string;
    }
  ) {
    super(scope, 'WorkloadIdentity');

    const pool = new IamWorkloadIdentityPool(this, `pool_${name}`, {
      workloadIdentityPoolId: `${name}-pool`,
      displayName: name,
    });

    new IamWorkloadIdentityPoolProvider(this, `provider_${name}`, {
      workloadIdentityPoolProviderId: `${name}-provider`,
      workloadIdentityPoolId: pool.workloadIdentityPoolId,
      attributeMapping: {
        'google.subject': 'assertion.sub',
        'attribute.repository': 'assertion.repository',
      },
      oidc: {
        issuerUri: 'https://token.actions.githubusercontent.com',
      },
    });

    new ServiceAccountIamMember(this, `member_${name}`, {
      serviceAccountId: config.serviceAccount.id,
      role: 'roles/iam.workloadIdentityUser',
      member: `principalSet://iam.googleapis.com/${pool.name}/attribute.repository/${config.repositoryName}`,
    });
  }
}
