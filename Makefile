PROGRAM = main
SCANNER = scanner.py
SAMPLE_FILE = sample.out

# 事前生成したサンプル入力を使い、プログラムをテスト実行する
run: $(SAMPLE_FILE)
	cd app; cat ../$(SAMPLE_FILE) | go run main.go

# 実行デバイス上で無停止のスキャンを実行する
scan:
	ssh "$$TARGET_USER@$$TARGET_HOST" sudo python $(SCANNER)

# 5秒分のサンプル入力ファイルを生成する
$(SAMPLE_FILE):
# この場合、timeoutコマンドもpythonコマンドも非ゼロのstatusを返すため、"|| true" で成功扱いにする
	ssh "$$TARGET_USER@$$TARGET_HOST" sudo timeout 5 python $(SCANNER) > $(SAMPLE_FILE) || true

# 実行デバイス上のscanner出力を入力として接続し、プログラムをローカル実行する
ssh_run:
	cd app; ssh "$$TARGET_USER@$$TARGET_HOST" sudo python $(SCANNER) | go run main.go

# 実行デバイス用のビルド成果物およびscannerスクリプトを実行デバイス上にデプロイする
deploy: $(PROGRAM) $(SCANNER) devices.json
	scp ./$(PROGRAM) ./$(SCANNER) ./devices.json "$$TARGET_USER@$$TARGET_HOST:"

$(PROGRAM): *.go
# for raspberry pi 3B+
	cd app; env GOOS=linux GOARCH=arm GOARM=7 go build main.go -o ../$(PROGRAM)

clean:; rm -f $(PROGRAM) $(SAMPLE_FILE)

.PHONY: run ssh_run deploy clean
