import {Construct} from 'constructs';
import {App, GcsBackend, TerraformStack, TerraformVariable} from 'cdktf';
import {GoogleProvider} from '@cdktf/provider-google/lib/provider';
import {ServiceAccount} from './serviceAccount';
import {BigqueryDataset, BigqueryTable, ScheduledQuery} from './bigquery';
import {Secret} from './secretManager';
import {AppContext} from './baseConstruct';
import {CloudRun} from './cloudRun';
import {BillingBudget} from './billing';

declare global {
  type EnvType = 'production' | 'development';
}

class MyStack extends TerraformStack {
  private projectId: TerraformVariable;

  constructor(scope: Construct, id: string, env: EnvType) {
    super(scope, id);

    // TerraformVariableなどのリソース定義の後にsetContextができないという制約があるため
    // 一旦空オブジェクトをsetContextしておき、後から値を入れることで制約を回避する
    const context: Partial<AppContext> = {};
    this.node.setContext('appContext', context);

    this.projectId = new TerraformVariable(this, 'project_id', {
      type: 'string',
      default: {
        development: process.env.PROJECT_ID_DEVELOPMENT,
        production: process.env.PROJECT_ID_PRODUCTION,
      }[env],
    });

    context.env = env;
    context.gcpProjectId = this.projectId;
    context.gcpLocation = 'asia-northeast1';
    // gcloud billing projects describe {project_id} で取得できる
    context.gcpBillingAccount = process.env.GOOGLE_BILLING_ACCOUNT_ID!;

    new GcsBackend(this, {bucket: `switchbot-logger_tfstate_${env}`});

    new GoogleProvider(this, 'gcp', {
      project: this.projectId.value,
      // 下記を設定しないと予算リソースを扱えない
      billingProject: this.projectId.value,
      userProjectOverride: true,
    });

    new BillingBudget(this, {
      name: `ベース料金アラート-${this.projectId.value}`,
      targetProjectId: this.projectId.value,
      baseAmount: '150',
      rules: [{current: 100}, {forecasted: 200}, {forecasted: 2000}],
    });

    this.setupCloudRunApp(env);

    this.setupMetricsTable(env);
  }

  private setupCloudRunApp(env: EnvType): void {
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

    new CloudRun(this, 'app', {
      serviceAccount: sa,
      buildPermissions: ['secretmanager.versions.access'],
      envvars: {
        PROJECT_ID: this.projectId.value,
        NEXT_PUBLIC_APP_ENV: env,
      },
      secrets: {
        AUTH_PATH: authPath,
        SWITCHBOT_TOKEN: token,
        SWITCHBOT_SECRET: secret,
        SENTRY_AUTH_TOKEN: sentryToken,
      },
      github: {
        owner: 'cumet04',
        name: 'switchbot-logger',
        push: {
          // mainが更新された場合は開発系も更新する
          branch: env === 'production' ? '^main$' : `^(main|${env})$`,
        },
      },
      buildYamlPath: 'app/cloudbuild.yaml',
    });
  }

  private setupMetricsTable(env: EnvType): void {
    new BigqueryDataset(this, 'switchbot');

    const datasetId = 'switchbot';
    const tableId = 'metrics';
    const schema = Object.entries({
      Time: 'TIMESTAMP',
      DeviceId: 'STRING',
      Type: 'STRING',
      Value: 'FLOAT',
    }).map(([name, type]) => ({
      mode: 'NULLABLE',
      name,
      type,
    }));
    new BigqueryTable(this, datasetId, tableId, JSON.stringify(schema), {
      timePartitioning: {
        type: 'DAY',
        field: 'Time',
      },
    });

    // MEMO: SELECT * ではなくCOUNTとかのほうが料金やすいかも？
    const aliveQuery = [
      'SELECT *',
      `FROM ${datasetId}.${tableId}`,
      'WHERE Time > DATETIME_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 MINUTE)',
    ].join(' ');
    new ScheduledQuery(this, {
      // displayNameはメール通知の件名に入るので、envを入れておく
      displayName: `[${env.toUpperCase()}] switchbotメトリクス死活監視`,
      schedule: 'every 10 minutes',
      query: `ASSERT EXISTS ( ${aliveQuery} )`,
      email: true,
    });
  }
}

const app = new App();
new MyStack(app, 'production', 'production');
new MyStack(app, 'development', 'development');
app.synth();
