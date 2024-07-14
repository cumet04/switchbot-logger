import {Construct} from 'constructs';
import {BaseConstruct} from './baseConstruct';
import {Secret} from './constructs/secretManager';
import {ServiceAccount} from './constructs/serviceAccount';
import {CloudRun} from './constructs/cloudRun';
import {CloudBuild} from './constructs/CloudBuild';
import {ArRepository} from './constructs/arRepository';

export class CloudRunApp extends BaseConstruct {
  constructor(scope: Construct) {
    super(scope, 'CloudRunApp');

    const serviceName = 'app';
    // CloudRun一式のリージョンは、いくつかの理由によりus-central1にする:
    // * Artifact Registry, Cloud Build, Cloud Runのリージョンを揃えることで、image pullの通信コストを抑えられる
    // * Cloud Buildはなんらかの条件（？）で一部のリージョンでしか動作しないことがある（us-central1は動作する）
    //   - https://cloud.google.com/build/docs/locations#restricted_regions_for_some_projects
    // * Cloud Runでカスタムドメインを直接使う場合、asia-northeast1はレイテンシが大きく増加する
    //   - https://cloud.google.com/run/docs/issues#latency-domains
    const location = 'us-central1';

    const repo = new ArRepository(this, serviceName, {location});

    new CloudBuild(this, 'app', {
      location,
      repo: repo.repo,
      serviceName,
      buildPermissions: ['secretmanager.versions.access'],
      githubRepo: 'https://github.com/cumet04/switchbot-logger.git',
      event: {
        push: {
          // mainが更新された場合は開発系も更新する
          // stagingはappのrenovateのPRでも自動デプロイさせる
          branch: {
            production: '^main$',
            staging: ['^main$', `^${this.env}$`, '^renovate/app/'].join('|'),
          }[this.env],
        },
      },
      buildYamlPath: 'app/cloudbuild.yaml',
    });

    const sa = new ServiceAccount(this, 'application', [
      // TODO: 対象リソース絞れるか？
      'bigquery.datasets.get',
      'bigquery.jobs.create',
      'bigquery.tables.get',
      'bigquery.tables.getData',
      'bigquery.tables.updateData',
      'secretmanager.versions.access',
    ]);

    new CloudRun(this, serviceName, {
      location,
      serviceAccount: sa,
      envvars: {
        PROJECT_ID: this.projectId.value,
        NEXT_PUBLIC_APP_ENV: this.env,
      },
      secrets: {
        AUTH_PATH: new Secret(this, 'auth_path'),
        SWITCHBOT_TOKEN: new Secret(this, 'switchbot_token'),
        SWITCHBOT_SECRET: new Secret(this, 'switchbot_secret'),
        SENTRY_AUTH_TOKEN: new Secret(this, 'sentry_token'),
      },
    });
  }
}
