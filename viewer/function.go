package viewer

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"

	"cloud.google.com/go/bigquery"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	"google.golang.org/api/iterator"

	"github.com/cumet04/switchbot-logger/switchbot"
)

func init() {
	functions.HTTP("HandleFunc", HandleFunc)
}

type Metric struct {
	Time     time.Time `bigquery:"Time"`
	DeviceId string    `bigquery:"DeviceId"`
	Type     string    `bigquery:"Type"`
	Value    float32   `bigquery:"Value"`
}

func HandleFunc(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	resp, err := main(ctx)
	if err != nil {
		log.Println(err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Write([]byte(resp))
}

var rows [][]bigquery.Value

func main(ctx context.Context) (string, error) {
	projectID := os.Getenv("PROJECT_ID")

	client, err := NewBigQueryClient(ctx, projectID)
	if err != nil {
		return "", fmt.Errorf("failed to NewBigQueryClient: %v", err)
	}

	if rows == nil {
		// TODO: キャッシュクリアする手段
		rows, err = fetchMetrics(ctx, client, "Temperature")
		if err != nil {
			return "", fmt.Errorf("failed to fetchMetrics: %v", err)
		}
	}

	tmpl, err := template.ParseFiles("template.html")
	if err != nil {
		return "", fmt.Errorf("failed to template.ParseFiles: %v", err)
	}

	var resp bytes.Buffer
	err = tmpl.Execute(&resp, struct {
		Metrics [][]bigquery.Value
	}{rows})
	if err != nil {
		return "", fmt.Errorf("failed to tmpl.Execute: %v", err)
	}

	return resp.String(), nil
}

func fetchMetrics(ctx context.Context, client *BigQueryClient, deviceType string) ([][]bigquery.Value, error) {
	devices := devicesFor(deviceType)
	queryString := buildSampledMetricsQuery(devices, 6, 100)

	var headers []bigquery.Value
	headers = append(headers, "Time")
	for _, d := range devices {
		headers = append(headers, d.Name)
	}

	vaules, err := client.Query(ctx, queryString)
	if err != nil {
		return nil, err
	}

	var rows [][]bigquery.Value
	rows = append(rows, headers)
	rows = append(rows, vaules...)

	return rows, nil
}

type Device struct {
	Id   string
	Name string
}

func devicesFor(metricType string) []Device {
	var deviceIds []string
	if metricType == "Humidity" || metricType == "Temperature" {
		deviceIds = deviceIdsFor("Meter")
	} else if metricType == "Load" {
		deviceIds = deviceIdsFor("Plug Mini (US)")
	}
	if len(deviceIds) == 0 {
		panic("invalid metric type")
	}

	var devices []Device
	for _, id := range deviceIds {
		devices = append(devices, Device{
			Id:   strings.ToLower(id),             // MEMO: これの大文字小文字ってどこで正規化すべき？
			Name: strings.ReplaceAll(id, ":", ""), // TODO: デバイス名をマッピングする
		})
	}
	return devices
}

var deviceIdsFor_devices *switchbot.DevicesSchema

func deviceIdsFor(class string) []string {
	if deviceIdsFor_devices == nil {
		var err error
		deviceIdsFor_devices, err = switchbot.FetchDevices(os.Getenv("SWITCHBOT_TOKEN"), os.Getenv("SWITCHBOT_SECRET"))
		if err != nil {
			panic(err) // TODO:
		}
	}
	devices := deviceIdsFor_devices

	var deviceIds []string
	for _, c := range devices.Body.DeviceList {
		if c.DeviceType == class {
			deviceIds = append(deviceIds, c.DeviceId)
		}
	}
	return deviceIds
}

func buildSampledMetricsQuery(devices []Device, timeRangeInHours int, sampleSize int) string {
	var devQueries []string
	for _, d := range devices {
		q := fmt.Sprintf("AVG(IF (DeviceId = '%s', Value, NULL)) AS %s", d.Id, d.Name)
		devQueries = append(devQueries, q)
	}

	samplingInterval := timeRangeInHours * 60 / sampleSize
	if samplingInterval == 0 {
		samplingInterval = 1
	}

	return fmt.Sprintf(`
SELECT
	TIMESTAMP_TRUNC(TIMESTAMP_SUB(Time, INTERVAL MOD(EXTRACT(MINUTE FROM Time), %d) MINUTE),MINUTE) AS Time,
	%s
FROM
  switchbot.metrics
WHERE
  Time > DATETIME_SUB(CURRENT_TIMESTAMP(), INTERVAL %d HOUR)
GROUP BY 1
ORDER BY 1
`, samplingInterval, strings.Join(devQueries, ","), timeRangeInHours)
}

type BigQueryClient struct {
	client    *bigquery.Client
	projectID string
}

func NewBigQueryClient(ctx context.Context, projectID string) (*BigQueryClient, error) {
	client, err := bigquery.NewClient(ctx, projectID)
	if err != nil {
		return nil, err
	}

	return &BigQueryClient{
		client:    client,
		projectID: projectID,
	}, nil
}

// Queryは指定されたクエリを実行し、結果を二次元配列的な形式で返す。
func (c *BigQueryClient) Query(ctx context.Context, queryString string) ([][]bigquery.Value, error) {
	query := c.client.Query(queryString)
	it, err := query.Read(ctx)
	if err != nil {
		return nil, err
	}

	var rows [][]bigquery.Value
	for {
		var row []bigquery.Value
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		rows = append(rows, row)
	}

	return rows, nil
}
