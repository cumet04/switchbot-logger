import {Construct} from 'constructs';
import {App, GcsBackend, TerraformStack, TerraformVariable} from 'cdktf';
import {GoogleProvider} from '@cdktf/provider-google/lib/provider';
import {AppContext} from './baseConstruct';
import {BillingBudget} from './constructs/billing';
import {CloudRunApp} from './CloudRunApp';
import {MetricTable} from './MetricTable';
import {ProjectService} from '@cdktf/provider-google/lib/project-service';
import {ServiceAccount} from './constructs/serviceAccount';
import {WorkloadIdentityResources} from './workloadIdentity';
import {GcsBucket} from './constructs/gcsBucket';

const EnvTypes = ['production', 'staging'] as const;
declare global {
  type EnvType = (typeof EnvTypes)[number];
}

const tfstateBucketName = (env: EnvType) => `switchbot-logger_tfstate_${env}`;

class BaseStack extends TerraformStack {
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
        staging: process.env.PROJECT_ID_STAGING,
        production: process.env.PROJECT_ID_PRODUCTION,
      }[env],
    });

    context.env = env;
    context.gcpProjectId = this.projectId;
    context.gcpLocation = 'asia-northeast1';
    // gcloud billing projects describe {project_id} で取得できる
    context.gcpBillingAccount = process.env.GOOGLE_BILLING_ACCOUNT_ID!;

    new GcsBackend(this, {
      bucket: tfstateBucketName(env),
      prefix: id,
    });

    new GoogleProvider(this, 'gcp', {
      project: this.projectId.value,
      // 下記を設定しないと予算リソースを扱えない
      billingProject: this.projectId.value,
      userProjectOverride: true,
    });
  }
}

class MainStack extends BaseStack {
  constructor(scope: Construct, id: string, env: EnvType) {
    super(scope, id, env);

    new GcsBucket(this, {
      name: tfstateBucketName(env),
      // tfstateはさほどサイズ大きくもないし、あとから参照したいことが稀にあるので基本的にはバージョン残す
      // ただしproduction以外はゴミが増えやすいので30日程度残して削除
      versioning: {enabled: true},
      lifecycleRule:
        env === 'production'
          ? []
          : [
              {
                action: {type: 'Delete'},
                condition: {
                  daysSinceNoncurrentTime: 30,
                },
              },
            ],
    });

    new CloudRunApp(this);
    new MetricTable(this);

    const serviceAccount = new ServiceAccount(this, 'ghactions', [
      // tfstateの読み書き時にtflockファイルを作成・削除するためにcreate/deleteが必要
      'storage.objects.create',
      'storage.objects.delete',

      'artifactregistry.repositories.get',
      'bigquery.datasets.get',
      'bigquery.jobs.create', // google_bigquery_data_transfer_configのチェックにいるっぽい？
      'bigquery.tables.get',
      'bigquery.transfers.get',
      'cloudbuild.builds.get',
      'cloudbuild.connections.get',
      'cloudbuild.repositories.get',
      'iam.roles.get',
      'iam.serviceAccounts.get',
      'iam.serviceAccounts.getIamPolicy',
      'iam.workloadIdentityPoolProviders.get',
      'iam.workloadIdentityPools.get',
      'resourcemanager.projects.getIamPolicy', // project_iam_memberを見るのにいる
      'run.services.get',
      'run.services.getIamPolicy',
      'secretmanager.secrets.get',
      'serviceusage.services.use',
      'storage.buckets.get',
      'storage.objects.get',
      'storage.objects.list',
    ]).account;
    new WorkloadIdentityResources(this, 'ghactions', {
      repositoryId: '524107595',
      serviceAccount,
    });
  }
}

class AdminStack extends BaseStack {
  constructor(scope: Construct, id: string, env: EnvType) {
    super(scope, id, env);

    const ctx = this.node.getContext('appContext') as AppContext;
    const projectId = ctx.gcpProjectId.value;

    [
      'iam.googleapis.com',
      'billingbudgets.googleapis.com',
      'secretmanager.googleapis.com',
      'bigquery.googleapis.com',
      'bigquerydatatransfer.googleapis.com',
      'artifactregistry.googleapis.com',
      'cloudbuild.googleapis.com',
      'run.googleapis.com',

      // 下記2つはAPI有効化自体に必要なので、初回は手動で有効化が必要
      'serviceusage.googleapis.com',
      'cloudresourcemanager.googleapis.com',
    ].forEach(service => {
      new ProjectService(this, `enable-api_${service}`, {
        project: projectId,
        service,
      });
    });

    new BillingBudget(this, {
      name: `ベース料金アラート-${projectId}`,
      targetProjectId: projectId,
      baseAmount: '150',
      rules: [{current: 100}, {forecasted: 200}, {forecasted: 2000}],
    });
  }
}

const app = new App();
EnvTypes.forEach(env => {
  new MainStack(app, env, env);
  new AdminStack(app, `admin-${env}`, env);
});
app.synth();
