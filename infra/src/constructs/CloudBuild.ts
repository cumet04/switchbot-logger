import {Construct} from 'constructs';
import {BaseConstruct} from '../baseConstruct';
import {
  CloudbuildTrigger,
  CloudbuildTriggerGithub,
} from '@cdktf/provider-google/lib/cloudbuild-trigger';
import {ArtifactRegistryRepository} from '@cdktf/provider-google/lib/artifact-registry-repository';
import {ServiceAccount} from './serviceAccount';

export class CloudBuild extends BaseConstruct {
  constructor(
    scope: Construct,
    name: string,
    options: {
      repo: ArtifactRegistryRepository;
      serviceName: string;
      buildPermissions?: string[];
      github: CloudbuildTriggerGithub;
      buildYamlPath: string;
    }
  ) {
    super(scope, `CloudBuild_${name}`);

    const buildAccount = new ServiceAccount(this, 'builder', [
      ...this.CloudBuildServiceAccountPermissions(),
      ...(options.buildPermissions ?? []),
    ]);

    new CloudbuildTrigger(this, 'trigger', {
      name,
      location: 'global',
      filename: options.buildYamlPath,
      github: options.github,
      substitutions: {
        _SERVICE_NAME: options.serviceName,
        _REGION: this.gcpLocation,
        _IMAGE_URL: `${options.repo.location}-docker.pkg.dev/${options.repo.project}/${options.repo.repositoryId}/main`,
      },
      serviceAccount: buildAccount.account.id,
    });
  }

  private CloudBuildServiceAccountPermissions() {
    return [
      'artifactregistry.repositories.downloadArtifacts',
      'artifactregistry.repositories.uploadArtifacts',
      'iam.serviceAccounts.actAs',
      'logging.logEntries.create',
      'run.operations.get',
      'run.services.get',
      'run.services.update',
      'secretmanager.versions.access',
    ];
  }
}
