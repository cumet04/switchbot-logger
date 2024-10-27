import {Construct} from 'constructs';
import {BaseConstruct} from '../baseConstruct';
import {
  CloudbuildTrigger,
  CloudbuildTriggerRepositoryEventConfig,
} from '@cdktf/provider-google/lib/cloudbuild-trigger';
import {ArtifactRegistryRepository} from '@cdktf/provider-google/lib/artifact-registry-repository';
import {ServiceAccount} from './serviceAccount';
import {Cloudbuildv2Repository} from '@cdktf/provider-google/lib/cloudbuildv2-repository';
import {Cloudbuildv2Connection} from '@cdktf/provider-google/lib/cloudbuildv2-connection';

export class CloudBuild extends BaseConstruct {
  constructor(
    scope: Construct,
    name: string,
    options: {
      location: string;
      repo: ArtifactRegistryRepository;
      serviceName: string;
      buildPermissions?: string[];
      githubRepo: string;
      event: Omit<CloudbuildTriggerRepositoryEventConfig, 'repository'>;
      buildYamlPath: string;
    },
  ) {
    super(scope, `CloudBuild_${name}`);

    const buildAccount = new ServiceAccount(this, 'builder', [
      ...this.CloudBuildServiceAccountPermissions(),
      ...(options.buildPermissions ?? []),
    ]);

    const conn = new Cloudbuildv2Connection(this, 'connection', {
      location: options.location,
      name: 'github',
      // connectionの実体はgithubアカウントへのappインストールがあったりそれ固有のIDが属性になったりするため
      // terraform管理はリソースの存在だけにとどめ、github app関連の部分は管理しない。
      // 初期投入はconnectionだけ手動で作成し、importする。
      // なお、これに関連してSecretManagerのsecret（github-oauthtokenみたいなの）が一つ自動生成される。
      lifecycle: {
        ignoreChanges: ['github_config'],
      },
    });

    const repo = new Cloudbuildv2Repository(this, 'repo', {
      name: options.serviceName,
      location: options.location,
      parentConnection: conn.id,
      remoteUri: options.githubRepo,
    });

    new CloudbuildTrigger(this, 'trigger', {
      name,
      location: options.location,
      filename: options.buildYamlPath,
      repositoryEventConfig: {
        repository: repo.id,
        ...options.event,
      },
      substitutions: {
        _SERVICE_NAME: options.serviceName,
        _REGION: options.location, // MEMO: これはCloudRunのリージョンと合わせる
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
