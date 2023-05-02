## デプロイ
TODO: ansibleなりスクリプトなり作る

* `/opt/fluentbit`ディレクトリを作る
* その配下に`fluent-bit.conf`を置く
* 同配下にGCPのサービスアカウントのjsonを置き、`creds.json`でsymlinkする
* `docker run -d --name fluentbit -p 9880:9880 -v /opt/fluentbit:/opt cr.fluentbit.io/fluent/fluent-bit -c /opt/fluent-bit.conf`
