import {Construct} from 'constructs';
import {App, GcsBackend, TerraformStack, TerraformVariable} from 'cdktf';
import {GoogleProvider} from '@cdktf/provider-google/lib/provider';
import {ServiceAccount} from './serviceAccount';
import {BigqueryDataset, BigqueryTable} from './bigquery';
import {Secret} from './secretManager';
import {AppContext} from './baseConstruct';
import {CloudRun} from './cloudRun';

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

    new GcsBackend(this, {bucket: `switchbot-logger_tfstate_${env}`});

    new GoogleProvider(this, 'gcp', {
      project: this.projectId.value,
    });

    this.setupCloudRunApp(env);

    this.setupMetricsTable();
  }

  private setupCloudRunApp(env: EnvType): void {
    const token = new Secret(this, 'switchbot_token');
    const secret = new Secret(this, 'switchbot_secret');
    const authPath = new Secret(this, 'auth_path');

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
      envvars: {
        PROJECT_ID: this.projectId.value,
      },
      secrets: {
        AUTH_PATH: authPath,
        SWITCHBOT_TOKEN: token,
        SWITCHBOT_SECRET: secret,
      },
      github: {
        owner: 'cumet04',
        name: 'switchbot-logger',
        push: {
          branch: env === 'production' ? '^main$' : `^${env}$`,
        },
      },
      buildYamlPath: 'app/cloudbuild.yaml',
    });
  }

  private setupMetricsTable(): void {
    new BigqueryDataset(this, 'switchbot');

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
    new BigqueryTable(this, 'switchbot', 'metrics', JSON.stringify(schema), {
      timePartitioning: {
        type: 'DAY',
        field: 'Time',
      },
    });
  }
}

const app = new App();
new MyStack(app, 'production', 'production');
new MyStack(app, 'development', 'development');
app.synth();
