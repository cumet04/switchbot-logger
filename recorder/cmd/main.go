package main

import (
	"log"
	"os"

	"github.com/GoogleCloudPlatform/functions-framework-go/funcframework"
	_ "github.com/cumet04/switchbot-logger/recorder"
)

func main() {
	if os.Getenv("AUTH_PATH") == "" {
		os.Setenv("AUTH_PATH", "/recorder")
	}

	port := "8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	os.Setenv("FUNCTION_TARGET", "HandleFunc")
	if err := funcframework.Start(port); err != nil {
		log.Fatalf("funcframework.Start: %v\n", err)
	}
}
