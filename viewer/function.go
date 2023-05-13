package viewer

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"io"
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

func HandleFunc(w http.ResponseWriter, r *http.Request) {
	// pathで簡易認証を設ける
	if r.URL.Path != os.Getenv("AUTH_PATH") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	resp, err := main(ctx)
	if err != nil {
		log.Println(err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Write([]byte(resp))
}

type Results struct {
	Temperature [][]bigquery.Value
	Humidity    [][]bigquery.Value
	Load        [][]bigquery.Value
}

var results *Results

func main(ctx context.Context) (string, error) {
	projectID := os.Getenv("PROJECT_ID")

	client, err := NewBigQueryClient(ctx, projectID)
	if err != nil {
		return "", fmt.Errorf("failed to NewBigQueryClient: %v", err)
	}

	if results == nil {
		// TODO: キャッシュクリアする手段
		t, err := fetchMetrics(ctx, client, "Temperature")
		if err != nil {
			return "", fmt.Errorf("failed to fetchMetrics temperature: %v", err)
		}
		h, err := fetchMetrics(ctx, client, "Humidity")
		if err != nil {
			return "", fmt.Errorf("failed to fetchMetrics humidity: %v", err)
		}
		l, err := fetchMetrics(ctx, client, "Load")
		if err != nil {
			return "", fmt.Errorf("failed to fetchMetrics load: %v", err)
		}

		results = &Results{
			Temperature: t,
			Humidity:    h,
			Load:        l,
		}
	}

	tmpl, err := parseTemplate("template.html")
	if err != nil {
		return "", fmt.Errorf("failed to template.ParseFiles: %v", err)
	}

	var resp bytes.Buffer
	err = tmpl.Execute(&resp, results)
	if err != nil {
		return "", fmt.Errorf("failed to tmpl.Execute: %v", err)
	}

	return resp.String(), nil
}

func parseTemplate(name string) (*template.Template, error) {
	var f *os.File
	f, err := os.OpenFile(name, os.O_RDONLY, 0)
	if os.IsNotExist(err) {
		// https://zenn.dev/kmtym1998/articles/ae997382235acb
		f, err = os.OpenFile("serverless_function_source_code/"+name, os.O_RDONLY, 0)
	}
	if err != nil {
		return nil, err
	}
	b, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}
	return template.New(name).Parse(string(b))
}

func fetchMetrics(ctx context.Context, client *BigQueryClient, deviceType string) ([][]bigquery.Value, error) {
	devices := devicesFor(deviceType)
	queryString := buildSampledMetricsQuery(devices, deviceType, 6, 100)

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
	if metricType == "Humidity" || metricType == "Temperature" {
		return deviceIdsFor("Meter")
	} else if metricType == "Load" {
		return deviceIdsFor("Plug Mini (US)")
	} else {
		panic("invalid metric type")
	}
}

var deviceIdsFor_devices *switchbot.DevicesSchema

func deviceIdsFor(class string) []Device {
	if deviceIdsFor_devices == nil {
		var err error
		deviceIdsFor_devices, err = switchbot.FetchDevices(os.Getenv("SWITCHBOT_TOKEN"), os.Getenv("SWITCHBOT_SECRET"))
		if err != nil {
			panic(err) // TODO:
		}
	}
	devices := deviceIdsFor_devices

	var deviceIds []Device
	for _, c := range devices.Body.DeviceList {
		if c.DeviceType == class {
			deviceIds = append(deviceIds, Device{
				Id:   strings.ToLower(c.DeviceId), // MEMO: Idはテーブルのレコードの時点で大文字（APIが言うDeviceIdに準拠）が良いんだと思う
				Name: c.DeviceName,
			})
		}
	}
	return deviceIds
}

func buildSampledMetricsQuery(devices []Device, deviceType string, timeRangeInHours int, sampleSize int) string {
	var devQueries []string
	for _, d := range devices {
		mac := strings.ToLower(id2mac(d.Id))
		q := fmt.Sprintf("AVG(IF (DeviceId = '%s', Value, NULL))", mac)
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
	AND Type = '%s'
GROUP BY 1
ORDER BY 1
`, samplingInterval, strings.Join(devQueries, ","), timeRangeInHours, deviceType)
}

func id2mac(id string) string {
	return id[0:2] + ":" + id[2:4] + ":" + id[4:6] + ":" + id[6:8] + ":" + id[8:10] + ":" + id[10:12]
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
