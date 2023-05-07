package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/cumet04/switchbot-logger/switchbot"
)

func main() {
	// APIの疎通やレスポンスの形式を確認するためのテストコマンド

	devices, err := switchbot.FetchDevices(
		os.Getenv("SWITCHBOT_TOKEN"),
		os.Getenv("SWITCHBOT_SECRET"),
	)
	if err != nil {
		log.Fatal(err)
	}
	b, err := json.MarshalIndent(devices, "", "  ")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(b))
}
