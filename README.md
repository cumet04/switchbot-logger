## これはなに
SwitchBotのプラグや温湿度計の計測データを取得・蓄積するもの

各デバイスが発信するBLEのAdvertisementを受信・解析する方針。

## コンポーネント構成
* Raspberry Pi (as bluetooth hardware)
  - bluepyでAdvertisement (生データ) を読み取り、定期的にrecorderにデータを渡す
  - raspiディレクトリ以下
* recorder (Cloud Function)
  - Advertisementを入力として受け取り、SwitchBotのセンサデータとしてパースし、BigQueryに貯める
  - recorderディレクトリ以下

Raspi上のコードや設定はごく最低限にし、デプロイやメンテの頻度を下げる。

## デプロイ
主に自分用のメモ

### recorder
* GCPプロジェクトは適宜セットアップ
* BigQueryはdataset`switcbot`, table`metrics`で作る（コード内決め打ち）
  - Time (TIMESTAMP)
  - DeviceId (STRING)
  - Type (STRING)
  - Value (FLOAT)
* env.yamlを適宜設定
* `deploy.sh`

### Raspberry Pi
※Raspberry OS Lite 64bit (bullseye)で確認

デバイスにsshできるように鍵など設定し、必要に応じて`raspi/hosts`ファイルにホスト名を入れておく。

また、recorderのエンドポイントを`RECORDER_URL`環境変数から読めるようにしつつ
```
ansible-playbook -i hosts -u pi entry.yml
```
