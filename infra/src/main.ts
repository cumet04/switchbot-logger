import * as path from 'path';
import {Construct} from 'constructs';
import {App, RemoteBackend, TerraformStack} from 'cdktf';
import {GoogleProvider} from '@cdktf/provider-google/lib/provider';
import {ServiceAccount} from './serviceAccount';
import {BigqueryDataset, BigqueryTable} from './bigquery';
import {CloudFunctionGo} from './cloudFunctions';
import {Secret} from './secretManager';

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
    this.node.setContext('gcp_location', 'asia-northeast1');

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: mustEnv('TF_ORGANIZATION'),
      workspaces: {
        name: `switchbot-logger_${env}`,
      },
    });

    new GoogleProvider(this, 'gcp', {
      project: gcpProjectId,
    });

    const token = new Secret(this, 'switchbot_token');
    const secret = new Secret(this, 'switchbot_secret');

    const recorderAuthPath = new Secret(this, 'recorder_auth_path');

    const saRecorder = new ServiceAccount(this, 'recorder', [
      // TODO: 対象リソース絞れるか？
      'bigquery.datasets.get',
      'bigquery.datasets.getIamPolicy',
      'bigquery.tables.get',
      'bigquery.tables.updateData',
      'secretmanager.versions.access',
    ]);

    const recorderSourcePath = path.resolve(__dirname, '../../recorder');
    new CloudFunctionGo(this, 'recorder', {
      sourcePath: recorderSourcePath,
      allowUnauthenticated: true,
      secrets: {
        AUTH_PATH: recorderAuthPath.secretId,
        SWITCHBOT_TOKEN: token.secretId,
        SWITCHBOT_SECRET: secret.secretId,
      },
      serviceConfig: {
        serviceAccountEmail: saRecorder.account.email,
        environmentVariables: {
          PROJECT_ID: gcpProjectId,
        },
      },
    });

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
