import {Construct} from 'constructs';
import {BaseConstruct} from '../baseConstruct';
import {ArtifactRegistryRepository} from '@cdktf/provider-google/lib/artifact-registry-repository';

export class ArRepository extends BaseConstruct {
  public repo: ArtifactRegistryRepository;

  constructor(scope: Construct, name: string, options: {location: string}) {
    super(scope, `ArRepository_${name}`);

    this.repo = new ArtifactRegistryRepository(this, 'repository', {
      repositoryId: name,
      format: 'DOCKER',
      location: options.location,
      cleanupPolicies: [
        // 全削除ポリシーを入れておき、ホワイトリスト的に保持ポリシーを入れるスタイルにする
        {
          // 削除の実施は1日経過してから
          id: 'delete_images_older_than_1d',
          action: 'DELETE',
          condition: {
            olderThan: `${24 * 60 * 60}s`,
          },
        },
        {
          // ひとまず無条件で5世代を残すようにする。
          // mainとcacheを考慮してどちらをどの程度などあるかもしれないが、
          // 細かい調整は必要になったらその時に考える
          id: 'keep-minimum-versions',
          action: 'KEEP',
          mostRecentVersions: {
            keepCount: 5,
          },
        },
      ],
    });
  }
}
