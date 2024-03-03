import {Construct} from 'constructs';
import {BaseConstruct} from './baseConstruct';
import {
  BigqueryDataset,
  BigqueryTable,
  ScheduledQuery,
} from './helpers/bigquery';

export class MetricTable extends BaseConstruct {
  constructor(scope: Construct) {
    super(scope, 'MetricTable');

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
      displayName: `[${this.env.toUpperCase()}] switchbotメトリクス死活監視`,
      schedule: 'every 10 minutes',
      query: `ASSERT EXISTS ( ${aliveQuery} )`,
      email: true,
    });
  }
}
