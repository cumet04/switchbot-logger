import json
from datetime import datetime
from bluepy.btle import Scanner, DefaultDelegate


class ScanDelegate(DefaultDelegate):
    def handleDiscovery(self, dev, isNewDev, isNewData):
        result = {
            "time": datetime.utcnow().isoformat(),
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
        print(json.dumps(result), flush=True)


scanner = Scanner().withDelegate(ScanDelegate())
scanner.scan(0)
