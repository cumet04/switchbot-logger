import {Construct} from 'constructs';
import {App, RemoteBackend, TerraformStack, TerraformVariable} from 'cdktf';
import {GoogleProvider} from '@cdktf/provider-google/lib/provider';
import {ServiceAccount} from './serviceAccount';
import {BigqueryDataset, BigqueryTable} from './bigquery';

declare global {
  type EnvType = 'production' | 'development';
}

class MyStack extends TerraformStack {
  constructor(
    scope: Construct,
    id: string,
    env: EnvType,
    gcpProjectId: string
  ) {
    super(scope, id);

    this.node.setContext('env', env);
    this.node.setContext('gcp_project_id', gcpProjectId);

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: mustEnv('TF_ORGANIZATION'),
      workspaces: {
        name: `switchbot-logger_${env}`,
      },
    });

    // terraform cloud側から入れるGCP認証情報
    new TerraformVariable(this, 'GOOGLE_CREDENTIALS', {
      type: 'string',
      sensitive: true,
    });

    new GoogleProvider(this, 'gcp', {
      project: gcpProjectId,
    });

    new ServiceAccount(this, 'recorder', [
      // MEMO: 対象リソース絞れるか？
      'bigquery.datasets.get',
      'bigquery.datasets.getIamPolicy',
      'bigquery.tables.get',
      'bigquery.tables.updateData',
    ]);

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
    new BigqueryDataset(this, 'switchbot');
    new BigqueryTable(this, 'switchbot', 'metrics', JSON.stringify(schema));
  }
}

function mustEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined) throw new Error(`${name} is not defined`);
  return value;
}

const app = new App();
new MyStack(app, 'production', 'production', mustEnv('PROJECT_ID_PRODUCTION'));
new MyStack(
  app,
  'development',
  'development',
  mustEnv('PROJECT_ID_DEVELOPMENT')
);
app.synth();
