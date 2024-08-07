## これはなに
SwitchBotのプラグや温湿度計の計測データを取得・蓄積するもの

各デバイスが発信するBLEのAdvertisementを受信・解析する方針。

## コンポーネント構成
* Raspberry Pi (as bluetooth hardware)
  - bluepyでAdvertisement (生データ) を読み取り、定期的にrecorderにデータを渡す
  - raspiディレクトリ以下
* app (Next.js/CloudRun)
  - recorder
    - Advertisementを入力として受け取り、SwitchBotのセンサデータとしてパースし、BigQueryに貯める
  - viewer
    - BigQueryに貯めたデータをグラフ表示する

Raspi上のコードや設定はごく最低限にし、デプロイやメンテの頻度を下げる。

## デプロイ
主に自分用のメモ

### app
* デプロイはCloudBuildで実施される
* mainブランチが更新されると、production, stagingへデプロイされる
* stagingブランチが更新されると、stagingへデプロイされる

### infra
* GCPプロジェクトは適宜セットアップ。APIも適宜有効化
* infra配下で`npm run apply staging (or production)`
  - 初期セットアップ時は多分コケる。SecretManagerで各種値を埋めてやり直す

### Raspberry Pi
※Raspberry OS Lite 64bit (bullseye)で確認

デバイスにsshできるように鍵など設定し、必要に応じて`raspi/hosts`ファイルにホスト名を入れておき
```
ansible-playbook -i hosts -u pi entry.yml
```

なお`files/record.env`はansible管理化に無いので、初期構築時は手動で配置する。
