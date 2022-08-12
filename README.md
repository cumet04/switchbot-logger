## これはなに
SwitchBotのプラグや温湿度計の計測データを取得・蓄積するもの

各デバイスが発信するBLEのAdvertisementを受信・解析する方針。実際のプログラム実行（受信）はRaspberry Pi上で実施する想定。

## 開発

### 実行デバイス (Raspberry Pi) のセットアップ
なんらかBluetooth (BLE) が利用でき、pythonでbluepyライブラリが使えればok。また開発マシンからsshできるようになっていること。

Raspberry Pi OSであれば、以下を実行しておけば良いはず
```shell
sudo apt-get install bluez python3-pip
sudo pip install bluepy
```
※再現確認しておらず、上記で過不足ないかは未確認

### 本体の開発
goのビルドができればok。pythonは可能な限り触らない想定なので、最悪raspy上でnanoでも使って調整する。

実行デバイスへのデプロイおよびテスト用に、`TARGET_USER`と`TARGET_HOST`環境変数を設定しておく。`$TARGET_USER@$TARGET_HOST`というかたちでsshに使われる。

その他開発で使うコマンド類はMakefileにまとめているため、そちらを参照のこと。


## 設計など
BLE信号を受信する部分だけは実績が多いpythonスクリプトで実行し、それ以外の処理はすべてgoのプログラムで実行する設計にしている。

すべてgoで書きたかったのだが、目星をつけたbluetoothライブラリである[tinygo-org/bluetooth](https://github.com/tinygo-org/bluetooth)が[Manufacturerデータの取得が未実装](https://github.com/tinygo-org/bluetooth/issues/41#issuecomment-716163103)だったため、断念した。pythonではサンプルコードや記事も含めて実績が豊富であったため、bluetoothの最低限のデバイスドライバ相当の機能だけをpythonで実行することにした。

もしかするとtinygo-org/bluetoothがLinuxで使っている[muka/go-bluetooth](https://github.com/muka/go-bluetooth)ではできるのかもしれないが、よく調べていない。温湿度計はBLEのアクティブスキャンの必要があるようだが、そこのやり方も含めて後回しにしている。
