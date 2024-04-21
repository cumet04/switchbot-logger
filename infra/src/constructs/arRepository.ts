import {Construct} from 'constructs';
import {BaseConstruct} from '../baseConstruct';
import {ArtifactRegistryRepository} from '@cdktf/provider-google/lib/artifact-registry-repository';

export class ArRepository extends BaseConstruct {
  public repo: ArtifactRegistryRepository;

  constructor(scope: Construct, name: string) {
    super(scope, `ArRepository_${name}`);

    this.repo = new ArtifactRegistryRepository(this, 'repository', {
      repositoryId: name,
      format: 'DOCKER',
      location: this.gcpLocation,
    });
  }
}
