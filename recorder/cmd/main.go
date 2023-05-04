package main

import (
	"log"
	"os"

	"github.com/GoogleCloudPlatform/functions-framework-go/funcframework"
	_ "github.com/cumet04/switchbot-logger/recorder"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load("env.yaml")
	if err != nil {
		log.Printf("Error loading env.yaml: %v", err)
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
