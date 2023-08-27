import {Construct} from 'constructs';
import {ServiceAccount as gServiceAccount} from '@cdktf/provider-google/lib/service-account';
import {ProjectIamCustomRole} from '@cdktf/provider-google/lib/project-iam-custom-role';
import {ProjectIamMember} from '@cdktf/provider-google/lib/project-iam-member';
import {BaseConstruct} from './baseConstruct';

export class ServiceAccount extends BaseConstruct {
  account: gServiceAccount;

  constructor(scope: Construct, name: string, permissions: string[]) {
    super(scope, `ServiceAccount_${name}`);

    // MEMO: ServiceAccountのaccountIdはハイフンが許容、CustomeRoleのroleIdはアンスコが許容のため
    // nameに区切りを使いたい場合はなんらか工夫が要る

    this.account = new gServiceAccount(this, 'account', {
      accountId: name, // ^[a-z](?:[-a-z0-9]{4,28}[a-z0-9])$ => 5~30文字の小文字とハイフン。先頭と末尾はハイフン非許容
      displayName: name,
    });

    const role = new ProjectIamCustomRole(this, 'role', {
      roleId: name, // ^[a-zA-Z0-9_\\.]{3,64}$ => 3~64文字の英数字とアンダースコアとドット
      title: name,
      permissions,
    });

    new ProjectIamMember(this, 'member', {
      project: this.projectId.value,
      role: role.name,
      member: `serviceAccount:${this.account.email}`,
    });
  }
}
