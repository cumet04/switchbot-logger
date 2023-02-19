app: cd app && sleep 1 && env DEVICE_FILE='./config/devices.json' REDIS_HOST=localhost:6379 REDIS_CHANNEL=switchbot go run main.go
redis: ssh -L 6379:localhost:6379 pi@raspberrypi.local
