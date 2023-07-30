import {Construct} from 'constructs';
import {BaseConstruct} from './baseConstruct';
import {
  Cloudfunctions2Function,
  Cloudfunctions2FunctionBuildConfig,
  Cloudfunctions2FunctionServiceConfig,
} from '@cdktf/provider-google/lib/cloudfunctions2-function';
import {StorageBucket} from '@cdktf/provider-google/lib/storage-bucket';
import {StorageBucketObject} from '@cdktf/provider-google/lib/storage-bucket-object';
import {AssetType, TerraformAsset} from 'cdktf';
import {CloudRunServiceIamBinding} from '@cdktf/provider-google/lib/cloud-run-service-iam-binding';

export class CloudFunctionGo extends BaseConstruct {
  constructor(
    scope: Construct,
    name: string,
    options: {
      sourcePath: string;
      allowUnauthenticated?: boolean;
      secrets?: Record<string, string>;
      buildConfig?: Partial<Cloudfunctions2FunctionBuildConfig>;
      serviceConfig?: Partial<Cloudfunctions2FunctionServiceConfig>;
    }
  ) {
    super(scope, `CloudFunctionGo_${name}`);

    const bucket = new StorageBucket(this, 'source-bucket', {
      name: `switchbot-logger-${this.env}-cfsource-${name}`,
      location: this.gcpLocation,
    });

    const zip = new TerraformAsset(this, 'zip', {
      path: options.sourcePath,
      type: AssetType.ARCHIVE,
    });

    // FIXME: デプロイのたびにこのリソースがforce replacementになり、見た目上不安なのでなんとかしたい
    const object = new StorageBucketObject(this, 'source-object', {
      name: `${zip.assetHash}.zip`,
      bucket: bucket.name,
      source: zip.path,
    });

    const func = new Cloudfunctions2Function(this, 'this', {
      name,
      location: this.gcpLocation,
      buildConfig: {
        runtime: 'go120',
        entryPoint: 'HandleFunc',
        source: {
          storageSource: {
            bucket: bucket.name,
            object: object.name,
          },
        },
        ...options?.buildConfig,
      },
      serviceConfig: {
        availableMemory: '256M',
        maxInstanceCount: 1,
        timeoutSeconds: 60,
        secretEnvironmentVariables: Object.entries(options?.secrets || {}).map(
          ([k, v]) => ({
            key: k,
            secret: v,
            projectId: this.projectId.value,
            version: 'latest',
          })
        ),
        ...options?.serviceConfig,
      },
    });

    if (options.allowUnauthenticated) {
      // CloudFunctions2はallowUnauthenticatedがストレートにサポートされていないため、CloudRunのIAMを使って実現する
      // refs https://github.com/hashicorp/terraform-provider-google/issues/5833#issuecomment-1237493434
      new CloudRunServiceIamBinding(this, 'unauth-bind', {
        location: func.location,
        service: func.name,
        role: 'roles/run.invoker',
        members: ['allUsers'],
      });
    }
  }
}
