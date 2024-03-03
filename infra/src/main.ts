import {Construct} from 'constructs';
import {App, GcsBackend, TerraformStack, TerraformVariable} from 'cdktf';
import {GoogleProvider} from '@cdktf/provider-google/lib/provider';
import {AppContext} from './baseConstruct';
import {BillingBudget} from './helpers/billing';
import {CloudRunApp} from './CloudRunApp';
import {MetricTable} from './MetricTable';

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

    new CloudRunApp(this);
    new MetricTable(this);
  }
}

const app = new App();
new MyStack(app, 'production', 'production');
new MyStack(app, 'development', 'development');
app.synth();
