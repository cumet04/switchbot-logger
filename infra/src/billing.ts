import {Construct} from 'constructs';
import {BaseConstruct} from './baseConstruct';
import {BillingBudget as gBillingBudget} from '@cdktf/provider-google/lib/billing-budget';

type ThresholdRule =
  | {
      // 値は%指定。100%なら100
      current: number;
    }
  | {
      forecasted: number;
    };

export class BillingBudget extends BaseConstruct {
  constructor(
    scope: Construct,
    config: {
      name: string;
      targetProjectId: string;
      baseAmount: string; // JPY
      rules: ThresholdRule[];
    }
  ) {
    const {name, targetProjectId, baseAmount, rules} = config;
    super(scope, `BillingBudget_${name}`);

    new gBillingBudget(this, 'this', {
      billingAccount: this.gcpBillingAccount,
      displayName: name,
      budgetFilter: {
        // 抑止するのは想定外の引き落としではなく想定外の利用なので、割引などは含めない
        creditTypesTreatment: 'EXCLUDE_ALL_CREDITS',
        projects: [`projects/${targetProjectId}`],
      },
      amount: {
        specifiedAmount: {
          currencyCode: 'JPY',
          units: baseAmount,
        },
      },
      thresholdRules: rules.map(rule =>
        'current' in rule
          ? {
              spendBasis: 'CURRENT_SPEND',
              thresholdPercent: rule.current / 100,
            }
          : {
              spendBasis: 'FORECASTED_SPEND',
              thresholdPercent: rule.forecasted / 100,
            }
      ),
      lifecycle: {
        // 実リソース上ではproject_idではなくproject_numberで記録されており、毎回plan差分が出てしまうため無視しておく
        ignoreChanges: ['budget_filter[0].projects'],
      },
    });
  }
}
