import {Construct} from 'constructs';
import {BaseConstruct} from '../baseConstruct';
import {
  StorageBucket,
  StorageBucketConfig,
} from '@cdktf/provider-google/lib/storage-bucket';

export class GcsBucket extends BaseConstruct {
  constructor(
    scope: Construct,
    config: {} & Pick<
      StorageBucketConfig,
      'name' | 'versioning' | 'lifecycleRule'
    >
  ) {
    const {name, versioning, lifecycleRule} = config;

    super(scope, `GcsBucket_${name}`);

    new StorageBucket(this, 'this', {
      name,
      versioning,
      lifecycleRule,

      location: this.gcpLocation,
      // ストレージ全体をデフォルトでSTANDARD以外にすることは無いでしょう
      // refs https://cloud.google.com/storage/docs/storage-classes
      storageClass: 'STANDARD',
      // バケットをそのまま公開するユースケースは特殊なので、デフォルトで安全側に倒す
      // refs https://cloud.google.com/storage/docs/public-access-prevention
      publicAccessPrevention: 'enforced',
      uniformBucketLevelAccess: true, // refs https://cloud.google.com/storage/docs/uniform-bucket-level-access
    });
  }
}
