import {Construct} from 'constructs';
import {BaseConstruct} from './baseConstruct';
import {BigqueryDataset as gBigqueryDataset} from '@cdktf/provider-google/lib/bigquery-dataset';
import {
  BigqueryTableConfig,
  BigqueryTable as gBigqueryTable,
} from '@cdktf/provider-google/lib/bigquery-table';
import {BigqueryDataTransferConfig} from '@cdktf/provider-google/lib/bigquery-data-transfer-config';

export class BigqueryTable extends BaseConstruct {
  constructor(
    scope: Construct,
    datasetId: string,
    tableId: string,
    schema: string,
    overrides?: Partial<BigqueryTableConfig>
  ) {
    super(scope, `BigqueryTable_${datasetId}_${tableId}`);

    new gBigqueryTable(this, 'this', {
      datasetId,
      tableId,
      schema,
      ...overrides,
    });
  }
}

export class BigqueryDataset extends BaseConstruct {
  constructor(scope: Construct, datasetId: string) {
    super(scope, `BigqueryDataset_${datasetId}`);

    new gBigqueryDataset(this, 'this', {
      datasetId,
      location: this.gcpLocation,
    });
  }
}

export class ScheduledQuery extends BaseConstruct {
  constructor(
    scope: Construct,
    config: {
      displayName: string;
      schedule: string;
      query: string;
      email: boolean;
    }
  ) {
    const {displayName, schedule, query, email} = config;

    super(scope, `ScheduledQuery_${displayName}`);

    new BigqueryDataTransferConfig(this, 'this', {
      displayName,
      dataSourceId: 'scheduled_query',
      location: this.gcpLocation,
      schedule,
      emailPreferences: {
        enableFailureEmail: email,
      },
      params: {query},
    });
  }
}
