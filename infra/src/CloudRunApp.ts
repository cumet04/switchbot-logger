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

    const repo = new ArRepository(this, serviceName);

    new CloudBuild(this, 'app', {
      repo: repo.repo,
      serviceName,
      buildPermissions: ['secretmanager.versions.access'],
      github: {
        owner: 'cumet04',
        name: 'switchbot-logger',
        push: {
          // mainが更新された場合は開発系も更新する
          branch: this.env === 'production' ? '^main$' : `^(main|${this.env})$`,
        },
      },
      buildYamlPath: 'app/cloudbuild.yaml',
    });

    const token = new Secret(this, 'switchbot_token');
    const secret = new Secret(this, 'switchbot_secret');
    const authPath = new Secret(this, 'auth_path');
    const sentryToken = new Secret(this, 'sentry_token');

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
      serviceAccount: sa,
      envvars: {
        PROJECT_ID: this.projectId.value,
        NEXT_PUBLIC_APP_ENV: this.env,
      },
      secrets: {
        AUTH_PATH: authPath,
        SWITCHBOT_TOKEN: token,
        SWITCHBOT_SECRET: secret,
        SENTRY_AUTH_TOKEN: sentryToken,
      },
    });
  }
}
