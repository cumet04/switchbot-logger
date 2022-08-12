from bluepy.btle import Scanner, DefaultDelegate


class ScanDelegate(DefaultDelegate):
    def handleDiscovery(self, dev, isNewDev, isNewData):
        results = [dev.addr]
        for (adtype, desc, value) in dev.getScanData():
            results += [str(adtype), desc, value]
        print("\t".join(results), flush=True)


scanner = Scanner().withDelegate(ScanDelegate())
scanner.scan(0)
