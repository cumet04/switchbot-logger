package viewer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/bigquery"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	"google.golang.org/api/iterator"
)

func init() {
	functions.HTTP("HandleFunc", HandleFunc)
}

type MyRow struct {
	Time     time.Time `bigquery:"Time"`
	DeviceId string    `bigquery:"DeviceId"`
	Type     string    `bigquery:"Type"`
	Value    float32   `bigquery:"Value"`
}

func HandleFunc(w http.ResponseWriter, r *http.Request) {
	projectID := os.Getenv("PROJECT_ID")
	datasetName := "switchbot"
	tableName := "metrics"

	ctx := context.Background()
	client, err := bigquery.NewClient(ctx, projectID)
	if err != nil {
		log.Printf("Failed to create BigQuery client: %v", err)
		http.Error(w, "Failed to create BigQuery client", http.StatusInternalServerError)
		return
	}

	queryString := fmt.Sprintf("SELECT Time, DeviceId, Type, Value FROM `%s.%s` ORDER BY Time DESC LIMIT 10", datasetName, tableName)
	query := client.Query(queryString)
	it, err := query.Read(ctx)
	if err != nil {
		log.Printf("Failed to execute query: %v", err)
		http.Error(w, "Failed to execute query", http.StatusInternalServerError)
		return
	}

	var rows []MyRow
	for {
		var row MyRow
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Printf("Failed to iterate over results: %v", err)
			http.Error(w, "Failed to iterate over results", http.StatusInternalServerError)
			return
		}

		rows = append(rows, row)
	}

	if err := json.NewEncoder(w).Encode(rows); err != nil {
		log.Printf("Failed to encode response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}
