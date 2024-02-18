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
}
