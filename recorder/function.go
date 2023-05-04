package recorder

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
)

func init() {
	functions.HTTP("HandleFunc", HandleFunc)
}

func HandleFunc(w http.ResponseWriter, r *http.Request) {
	err := main(r.Context(), r.Body)
	if err != nil {
		log.Println(err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func main(ctx context.Context, body io.Reader) error {
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

	recorder := NewStdoutRecorder() // TODO: impl BigQueryRecorder
	defer recorder.Close()

	for _, r := range records {
		err := recorder.Record(ctx, r)
		if err != nil {
			return fmt.Errorf("recorder.Record: %v", err)
		}
	}
	return nil
}

type Recorder interface {
	Record(ctx context.Context, r Record) error
	Close()
}

type StdoutRecorder struct{}

func NewStdoutRecorder() *StdoutRecorder {
	return &StdoutRecorder{}
}

func (r *StdoutRecorder) Record(ctx context.Context, record Record) error {
	fmt.Println(record)
	return nil
}

func (r *StdoutRecorder) Close() {
	// nop
}
