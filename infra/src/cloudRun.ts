import {Construct} from 'constructs';
import {BaseConstruct} from './baseConstruct';
import {
  CloudRunV2Service,
  CloudRunV2ServiceTemplateContainersEnv,
} from '@cdktf/provider-google/lib/cloud-run-v2-service';
import {
  CloudbuildTrigger,
  CloudbuildTriggerGithub,
} from '@cdktf/provider-google/lib/cloudbuild-trigger';
import {ArtifactRegistryRepository} from '@cdktf/provider-google/lib/artifact-registry-repository';
import {CloudRunServiceIamBinding} from '@cdktf/provider-google/lib/cloud-run-service-iam-binding';
import {Secret} from './secretManager';
import {ServiceAccount} from './serviceAccount';

export class CloudRun extends BaseConstruct {
  constructor(
    scope: Construct,
    name: string,
    options: {
      serviceAccount: ServiceAccount;
      envvars?: Record<string, string>;
      secrets?: Record<string, Secret>;
      github: CloudbuildTriggerGithub;
      buildYamlPath: string;
    }
  ) {
    super(scope, `CloudRun_${name}`);

    const repo = new ArtifactRegistryRepository(this, 'repository', {
      repositoryId: name,
      format: 'DOCKER',
      location: this.gcpLocation,
    });

    const buildAccount = new ServiceAccount(
      this,
      'builder',
      this.CloudBuildServiceAccountPermissions()
    );

    new CloudbuildTrigger(this, 'trigger', {
      name: `cloudrun-${name}`,
      location: 'global',
      filename: options.buildYamlPath,
      github: options.github,
      substitutions: {
        _SERVICE_NAME: name,
        _REGION: this.gcpLocation,
        _IMAGE_URL: `${repo.location}-docker.pkg.dev/${repo.project}/${repo.repositoryId}/main`,
      },
      serviceAccount: buildAccount.account.id,
    });

    const normalENvs = Object.entries(options.envvars ?? {}).map(
      ([key, value]): CloudRunV2ServiceTemplateContainersEnv => ({
        name: key,
        value,
      })
    );
    const secretEnvs = Object.entries(options.secrets ?? {}).map(
      ([key, secret]): CloudRunV2ServiceTemplateContainersEnv => ({
        name: key,
        valueSource: {
          secretKeyRef: {secret: secret.secretId, version: 'latest'},
        },
      })
    );

    const service = new CloudRunV2Service(this, 'service', {
      name,
      location: this.gcpLocation,
      template: {
        executionEnvironment: 'EXECUTION_ENVIRONMENT_GEN2',
        serviceAccount: options.serviceAccount.account.email,
        containers: [
          {
            // imageはterraformでは管理しない
            // 初期構築時は、先にtriggerとrepositoryを作ってビルドを行い、できたimageを指定する
            image: '',
            env: normalENvs.concat(secretEnvs),
            ports: [{containerPort: 8080}],
          },
        ],
        scaling: {
          minInstanceCount: 0,
          maxInstanceCount: 1,
        },
      },
      ingress: 'INGRESS_TRAFFIC_ALL',
      lifecycle: {
        ignoreChanges: [
          // client, client_version, labels, imageはCloudBuildが管理する
          'client',
          'client_version',
          'labels',
          'template[0].containers[0].image',
          'template[0].containers[0].name', // 手動で再デプロイした場合など、nameが適当に変わってしまうので無視する
          // revisionに関するもろもろの挙動の仕様上、CloudRun v2は真っ当な手段でterraform管理できないようだ。
          // refs https://github.com/hashicorp/terraform-provider-google/issues/14569
          // そのためserviceに関する変更を入れたい場合は環境変数を入れてapply可能にするハックを入れている。
        ].concat(process.env.APPLY_CLOUDRUN ? [] : ['template[0].revision']),
      },
    });

    new CloudRunServiceIamBinding(this, 'unauth-bind', {
      location: service.location,
      service: service.name,
      role: 'roles/run.invoker',
      members: ['allUsers'],
    });
  }

  private CloudBuildServiceAccountPermissions() {
    // TODO: 一旦デフォルトのやつについてるのをほぼ全部コピペしている。
    // しばらく使っているとIAMの推奨のやつで不要なのが削られると思われるので、それを見て調整する
    const list = [
      // Cloud Build サービス アカウント
      'artifactregistry.aptartifacts.create',
      'artifactregistry.dockerimages.get',
      'artifactregistry.dockerimages.list',
      'artifactregistry.files.download',
      'artifactregistry.files.get',
      'artifactregistry.files.list',
      'artifactregistry.kfpartifacts.create',
      'artifactregistry.locations.get',
      'artifactregistry.locations.list',
      'artifactregistry.mavenartifacts.get',
      'artifactregistry.mavenartifacts.list',
      'artifactregistry.npmpackages.get',
      'artifactregistry.npmpackages.list',
      'artifactregistry.packages.get',
      'artifactregistry.packages.list',
      'artifactregistry.projectsettings.get',
      'artifactregistry.pythonpackages.get',
      'artifactregistry.pythonpackages.list',
      'artifactregistry.repositories.createOnPush',
      'artifactregistry.repositories.deleteArtifacts',
      'artifactregistry.repositories.downloadArtifacts',
      'artifactregistry.repositories.get',
      'artifactregistry.repositories.list',
      'artifactregistry.repositories.listEffectiveTags',
      'artifactregistry.repositories.listTagBindings',
      'artifactregistry.repositories.readViaVirtualRepository',
      'artifactregistry.repositories.uploadArtifacts',
      'artifactregistry.tags.create',
      'artifactregistry.tags.get',
      'artifactregistry.tags.list',
      'artifactregistry.tags.update',
      'artifactregistry.versions.get',
      'artifactregistry.versions.list',
      'artifactregistry.yumartifacts.create',
      'cloudbuild.builds.create',
      'cloudbuild.builds.get',
      'cloudbuild.builds.list',
      'cloudbuild.builds.update',
      'cloudbuild.operations.get',
      'cloudbuild.operations.list',
      'cloudbuild.workerpools.use',
      'containeranalysis.occurrences.create',
      'containeranalysis.occurrences.delete',
      'containeranalysis.occurrences.get',
      'containeranalysis.occurrences.list',
      'containeranalysis.occurrences.update',
      'logging.logEntries.create',
      'logging.logEntries.list',
      'logging.views.access',
      'pubsub.topics.create',
      'pubsub.topics.publish',
      'remotebuildexecution.blobs.get',
      'source.repos.get',
      'source.repos.list',
      'storage.buckets.create',
      'storage.buckets.get',
      'storage.buckets.list',
      'storage.objects.create',
      'storage.objects.delete',
      'storage.objects.get',
      'storage.objects.list',
      'storage.objects.update',

      // Cloud Run 管理者
      'recommender.locations.get',
      'recommender.locations.list',
      'recommender.runServiceCostInsights.get',
      'recommender.runServiceCostInsights.list',
      'recommender.runServiceCostInsights.update',
      'recommender.runServiceCostRecommendations.get',
      'recommender.runServiceCostRecommendations.list',
      'recommender.runServiceCostRecommendations.update',
      'recommender.runServiceIdentityInsights.get',
      'recommender.runServiceIdentityInsights.list',
      'recommender.runServiceIdentityInsights.update',
      'recommender.runServiceIdentityRecommendations.get',
      'recommender.runServiceIdentityRecommendations.list',
      'recommender.runServiceIdentityRecommendations.update',
      'recommender.runServiceSecurityInsights.get',
      'recommender.runServiceSecurityInsights.list',
      'recommender.runServiceSecurityInsights.update',
      'recommender.runServiceSecurityRecommendations.get',
      'recommender.runServiceSecurityRecommendations.list',
      'recommender.runServiceSecurityRecommendations.update',
      'run.configurations.get',
      'run.configurations.list',
      'run.executions.delete',
      'run.executions.get',
      'run.executions.list',
      'run.jobs.create',
      'run.jobs.createTagBinding',
      'run.jobs.delete',
      'run.jobs.deleteTagBinding',
      'run.jobs.get',
      'run.jobs.getIamPolicy',
      'run.jobs.list',
      'run.jobs.listEffectiveTags',
      'run.jobs.listTagBindings',
      'run.jobs.run',
      'run.jobs.runWithOverrides',
      'run.jobs.setIamPolicy',
      'run.jobs.update',
      'run.locations.list',
      'run.operations.delete',
      'run.operations.get',
      'run.operations.list',
      'run.revisions.delete',
      'run.revisions.get',
      'run.revisions.list',
      'run.routes.get',
      'run.routes.invoke',
      'run.routes.list',
      'run.services.create',
      'run.services.createTagBinding',
      'run.services.delete',
      'run.services.deleteTagBinding',
      'run.services.get',
      'run.services.getIamPolicy',
      'run.services.list',
      'run.services.listEffectiveTags',
      'run.services.listTagBindings',
      'run.services.setIamPolicy',
      'run.services.update',
      'run.tasks.get',
      'run.tasks.list',

      // サービス アカウント ユーザー
      'iam.serviceAccounts.actAs',
      'iam.serviceAccounts.get',
      'iam.serviceAccounts.list',
    ];

    return [...new Set(list)];
  }
}
