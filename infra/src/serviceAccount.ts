import {Construct} from 'constructs';
import {ServiceAccount as gServiceAccount} from '@cdktf/provider-google/lib/service-account';
import {ProjectIamCustomRole} from '@cdktf/provider-google/lib/project-iam-custom-role';
import {ProjectIamMember} from '@cdktf/provider-google/lib/project-iam-member';
import {BaseConstruct} from './baseConstruct';

export class ServiceAccount extends BaseConstruct {
  constructor(scope: Construct, name: string, permissions: string[]) {
    super(scope, `ServiceAccount_${name}`);

    const account = new gServiceAccount(this, 'account', {
      accountId: name,
      displayName: name,
    });

    const role = new ProjectIamCustomRole(this, 'role', {
      roleId: name,
      title: name,
      permissions,
    });

    new ProjectIamMember(this, 'member', {
      project: this.projectId,
      role: role.name,
      member: `serviceAccount:${account.email}`,
    });
  }
}
