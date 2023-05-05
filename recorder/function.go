package recorder

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"cloud.google.com/go/bigquery"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
)

func init() {
	functions.HTTP("HandleFunc", HandleFunc)
}

func HandleFunc(w http.ResponseWriter, r *http.Request) {
	err := main(r.Context(), os.Getenv("PROJECT_ID"), r.Body)
	if err != nil {
		log.Println(err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func main(ctx context.Context, projectID string, body io.Reader) error {
	parser, err := NewParser()
	if err != nil {
		return fmt.Errorf("NewParser: %v", err)
	}

	var records []Record

	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		line := scanner.Text()
		r, err := parser.ParseMessage(line)
		if err != nil {
			return fmt.Errorf("parser.ParseMessage: %v", err)
		}
		records = append(records, r...)
	}

	recorder, err := NewBigQueryRecorder(ctx, projectID)
	if err != nil {
		return fmt.Errorf("NewBigQueryRecorder: %v", err)
	}
	defer recorder.Close()

	if err := recorder.Record(ctx, records); err != nil {
		return fmt.Errorf("recorder.Record: %v", err)
	}

	return nil
}

type Recorder interface {
	Record(ctx context.Context, r []Record) error
	Close()
}

type StdoutRecorder struct{}

func NewStdoutRecorder() *StdoutRecorder {
	return &StdoutRecorder{}
}

func (r *StdoutRecorder) Record(ctx context.Context, records []Record) error {
	for _, r := range records {
		fmt.Println(r)
	}
	return nil
}

func (r *StdoutRecorder) Close() {
	// nop
}

type BigQueryRecorder struct {
	client   *bigquery.Client
	inserter *bigquery.Inserter
}

func NewBigQueryRecorder(ctx context.Context, projectID string) (*BigQueryRecorder, error) {
	client, err := bigquery.NewClient(ctx, projectID)
	if err != nil {
		return nil, err
	}

	return &BigQueryRecorder{
		client:   client,
		inserter: client.Dataset("switchbot").Table("metrics").Inserter(),
	}, nil
}

func (r *BigQueryRecorder) Record(ctx context.Context, records []Record) error {
	return r.inserter.Put(ctx, records)
}

func (r *BigQueryRecorder) Close() {
	r.client.Close()
}
