import {Construct} from 'constructs';
import {App, GcsBackend, TerraformStack, TerraformVariable} from 'cdktf';
import {GoogleProvider} from '@cdktf/provider-google/lib/provider';
import {AppContext} from './baseConstruct';
import {BillingBudget} from './helpers/billing';
import {CloudRunApp} from './CloudRunApp';
import {MetricTable} from './MetricTable';

const EnvTypes = ['production', 'development'] as const;
declare global {
  type EnvType = (typeof EnvTypes)[number];
}

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
        development: process.env.PROJECT_ID_DEVELOPMENT,
        production: process.env.PROJECT_ID_PRODUCTION,
      }[env],
    });

    context.env = env;
    context.gcpProjectId = this.projectId;
    context.gcpLocation = 'asia-northeast1';
    // gcloud billing projects describe {project_id} で取得できる
    context.gcpBillingAccount = process.env.GOOGLE_BILLING_ACCOUNT_ID!;

    new GcsBackend(this, {
      bucket: `switchbot-logger_tfstate_${env}`,
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

    new CloudRunApp(this);
    new MetricTable(this);
  }
}

class AdminStack extends BaseStack {
  constructor(scope: Construct, id: string, env: EnvType) {
    super(scope, id, env);

    const ctx = this.node.getContext('appContext') as AppContext;
    const projectId = ctx.gcpProjectId.value;

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
