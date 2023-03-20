## これはなに
SwitchBotのプラグや温湿度計の計測データを取得・蓄積するもの

各デバイスが発信するBLEのAdvertisementを受信・解析する方針。実際のプログラム実行（受信）はRaspberry Pi上で実施する想定。

## コンポーネント構成

コンポーネントの構成およびデータの流れ:
```
[bluetooth hardware]
↓  bluepyでAdvertisement (生データ) を読み取る
[scanner]
↓  生データをそのままRedis PubSubでチャンネルにpublishする
[Redis]
↓  上記チャンネルをsubscribeして生データを受け取る
[recorder]
↓  パースした計測データを送信する
[InfluxDB]
```

Bluetoothのデータ読み取りが1プロセスからしか実行できないことと、BLE Advertisementの受信プログラムのサンプルコード・実績がほぼpythonにしかないことから、データを読み取ってRedisに流すだけのscannerをアプリケーションから独立して用意している。`/scanner/src/scanner.py`が事実上のデバイスドライバであり、Redisが信号の複製機になっている（複数プロセスから同じデータをsubscribeできることから）。

scannerでは可能な限りアプリケーションロジックは実装せず、変更・デプロイを発生させないことを想定している。

recorderはBluetoothデバイスアクセス以外のロジックをすべて持つ。現在は必要な信号データのパースおよびInfluxDBへの送信を行っている。この部分は実装を取り替えたり複数のアプリケーションを並列して動かすことも想定している。


## 実行デバイス (Raspberry Pi) のセットアップ
※以降はRaspberry OS Lite 64bit (bullseye)で確認しています

### ローカルマシンの設定
実行デバイスにsshできること。また、ssh先のユーザ名とホスト名をそれぞれ`TARGET_USER` `TARGET_HOST`環境変数に入れておく。

普通にRaspberry OSをセットアップした場合は
```
export TARGET_USER=pi
export TARGET_HOST=raspberrypi.local
```
など。

### bluepy
なんらかBluetooth (BLE) が利用でき、pythonでbluepyライブラリが使えればok。Raspberry Pi OSであれば、以下を実行しておけば良いはず
```shell
sudo apt-get install python3-pip libglib2.0-dev
sudo pip install bluepy
```

### Redis
`sudo apt install redis-server`などで入れる。

もし他の方法で入れる場合は、scannerおよびappのserviceファイルにある`Requires=redis-server.service`をなんとかする必要がある。

### InfluxDB
（なんらか入る方法で入れる、このアプリケーションの動作にはインストール方法は関係ない）

### scanner service
`/opt/scanner`ディレクトリを作成し、ユーザ権限で読み書き可能にしておく。

デプロイ時はローカルマシンで`/scanner/deploy.sh`を実行すればデプロイ及びsystemd serviceの更新などが行われる。

### app service
scannerと同様に`/opt/recorder`ディレクトリを作成しておき、`app`ディレクトリ下で`make deploy`でデプロイする。

また`/app/config/`のファイルを参考に、
* 監視するSwitchBotデバイスの情報 -> `/opt/recorder/devices.json`
* InfluxDBの接続情報 -> `/opt/recorder/environment` 

に配置する。
