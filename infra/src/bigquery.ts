import {Construct} from 'constructs';
import {BaseConstruct} from './baseConstruct';
import {BigqueryDataset as gBigqueryDataset} from '@cdktf/provider-google/lib/bigquery-dataset';
import {BigqueryTable as gBigqueryTable} from '@cdktf/provider-google/lib/bigquery-table';

export class BigqueryTable extends BaseConstruct {
  constructor(
    scope: Construct,
    datasetId: string,
    tableId: string,
    schema: string
  ) {
    super(scope, `BigqueryTable_${datasetId}_${tableId}`);

    new gBigqueryTable(this, 'this', {
      datasetId,
      tableId,
      schema,
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
