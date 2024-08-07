import json
import time
from datetime import datetime, timezone
from bluepy.btle import Scanner, DefaultDelegate, BTLEManagementError

output_path = "out.json"

class ScanDelegate(DefaultDelegate):
    def handleDiscovery(self, dev, isNewDev, isNewData):
        result = {
            "time": datetime.now(timezone.utc).isoformat(),
            "addr": dev.addr,
            "structs": [],
        }
        for (adtype, desc, value) in dev.getScanData():
            # descはbluepyにハードコードされたテキストのため、受信した信号としての情報量は無い（adtypeと同値）
            # そのため出力する必要性はあまり無いが、scannerの範疇では取得できるデータは全部投げておき、利用有無はアプリケーション側で判断する
            # refs https://github.com/IanHarvey/bluepy/blob/v/1.3.0/bluepy/btle.py#L659
            result["structs"].append(
                {
                    "adtype": adtype,
                    "desc": desc,
                    "value": value,
                }
            )
        # 途中でファイルを消した場合などのハンドリングは面倒なので、毎回ファイルを開いて書き込む
        with open(output_path, mode='a') as f:
            print(json.dumps(result), file=f, flush=True)


scanner = Scanner().withDelegate(ScanDelegate())

while True:
    try:
        scanner.scan(0)
    except BTLEManagementError:
        # raspi起動直後など、デバイスがreadyになるまでリトライで待つ
        print("catch BTLEManagementError, retry after 10 seconds...")
        time.sleep(10)
