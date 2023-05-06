package recorder

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

type Record struct {
	Time     time.Time
	DeviceId string
	Type     RecordType
	Value    float32
}

type Parser struct {
	deviceTypes map[string]string
}

func NewParser() *Parser {
	return &Parser{}
}

func (p *Parser) fetchDeviceTypes(token string, secret string) error {
	data, err := fetchDevices(token, secret)
	if err != nil {
		return err
	}
	if data.StatusCode != 100 {
		return fmt.Errorf("switchbot API devicess; status code is not 100: %v", data)
	}

	types := make(map[string]string)
	for _, d := range data.Body.DeviceList {
		types[d.DeviceId] = d.DeviceType
	}

	p.deviceTypes = types
	return nil
}

type DevicesSchema struct {
	StatusCode int `json:"statusCode"`
	Body       struct {
		DeviceList []struct {
			DeviceId           string `json:"deviceId"`
			DeviceName         string `json:"deviceName"`
			DeviceType         string `json:"deviceType"`
			EnableCloudService bool   `json:"enableCloudService"`
			HubDeviceId        string `json:"hubDeviceId"`
		} `json:"deviceList"`
		InfraredRemoteList []struct {
			DeviceId    string `json:"deviceId"`
			DeviceName  string `json:"deviceName"`
			RemoteType  string `json:"remoteType"`
			HubDeviceId string `json:"hubDeviceId"`
		} `json:"infraredRemoteList"`
	} `json:"body"`
	Message string `json:"message"`
}

func fetchDevices(token string, secret string) (*DevicesSchema, error) {
	resp, err := switchbotGet("https://api.switch-bot.com/v1.1/devices", token, secret)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data DevicesSchema

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}

	return &data, nil
}

func switchbotGet(url string, token string, secret string) (*http.Response, error) {
	// https://github.com/OpenWonderLabs/SwitchBotAPI/blob/21f905ba96147028d85517b517beef3a2d66bb50/README.md#authentication

	// SecureRandom.hex(16)
	k := make([]byte, 16)
	if _, err := rand.Read(k); err != nil {
		panic(err)
	}
	nonce := fmt.Sprintf("%x", k)

	time := strconv.FormatInt(time.Now().UnixMilli(), 10)

	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(token + time + nonce))
	sig := h.Sum(nil)
	sign := base64.StdEncoding.EncodeToString(sig)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", token)
	req.Header.Set("sign", sign)
	req.Header.Set("nonce", nonce)
	req.Header.Set("t", time)

	return http.DefaultClient.Do(req)
}

func (p *Parser) ParseMessage(msg string) ([]Record, error) {
	// msg has-many AdStructures
	// AdStructure has-many Records

	structs, err := p.extractAdStructures(msg)
	if err != nil {
		return nil, fmt.Errorf("parse message failed: %v", err)
	}

	var records []Record
	for _, s := range structs {
		items, err := p.extractRecords(s)
		if err == nil {
			records = append(records, items...)
		} else {
			fmt.Fprintf(os.Stderr, "failed to extract records, err=%v, ad structure=%v\n", err, s)
		}
	}

	return records, nil
}

type AdStructure struct {
	Time          time.Time
	DeviceAddress string
	AdType        int
	Data          string
}

func (p *Parser) extractAdStructures(msg string) ([]AdStructure, error) {
	var signal struct {
		Time    string `json:"time"`
		Addr    string `json:"addr"`
		Structs []struct {
			AdType int    `json:"adtype"`
			Desc   string `json:"desc"`
			Value  string `json:"value"`
		} `json:"structs"`
	}
	if err := json.Unmarshal([]byte(msg), &signal); err != nil {
		return nil, err
	}

	t, err := time.Parse(time.RFC3339Nano, signal.Time)
	if err != nil {
		return nil, err
	}

	var structs []AdStructure
	for _, s := range signal.Structs {
		structs = append(structs, AdStructure{t.UTC(), signal.Addr, s.AdType, s.Value})
	}
	return structs, nil
}

func (p *Parser) extractRecords(s AdStructure) ([]Record, error) {
	deviceId := strings.ToUpper(strings.ReplaceAll(s.DeviceAddress, ":", ""))
	devType, ok := p.deviceTypes[deviceId]
	if !ok {
		devType = "_unknown_"
	}

	switch devType {
	case "Meter":
		return p.parseMeterData(s)
	case "Plug Mini (US)":
		return p.parsePlugData(s)
	case "Motion Sensor":
		return p.parseMotionData(s)
	case "Hub Mini":
		// Hub Miniの情報は特に必要ない
		return nil, nil
	case "_unknown_":
		return nil, nil
	default:
		// devicesに記載があるがparseが未実装な場合
		return nil, fmt.Errorf("unimplemented device type: %s, addr: %s", devType, s.DeviceAddress)
	}
}

type RecordType string

var RecordTypes = struct {
	Battery,
	Temperature,
	Humidity,
	PowerOn,
	Load RecordType
}{
	Battery:     "Battery",
	Temperature: "Temperature",
	Humidity:    "Humidity",
	PowerOn:     "PowerOn",
	Load:        "Load",
}

func (p *Parser) parseMeterData(s AdStructure) ([]Record, error) {
	// 温湿度計のパケットの仕様: https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/5351dff1c78f6c7e2191cb0e37b9df080266ae77/devicetypes/meter.md#new-broadcast-message

	// 温湿度計のデータはService Data (AdType 22)に入っているので、それ以外は無視
	if s.AdType != 22 {
		return nil, nil
	}

	bytes, err := hex.DecodeString(s.Data)
	if err != nil {
		return nil, err
	}

	// 下記bytesへのインデックスの数字は上記仕様にある Byte: 0 や Byte: 1 の数字とは2つズレている。
	// "The Service data can be 8 bytes max." と記載があるのにテーブルは6byte分しかなく、
	// 適当にズラしてみたら意図通りの数値が得られたためその状態で決め打ちにしておく。
	// その詳細は仕様に記載がないため間違った対応の可能性があるが、ドキュメントされてないもんは仕方ない。
	tempIsNegative := bytes[6]&0b10000000 == 0
	tempInt := int(bytes[6] & 0b01111111)
	tempReal := float32(bytes[5]&0b00001111) / 10
	temperature := float32(tempInt) + tempReal
	if tempIsNegative {
		temperature = -temperature
	}

	battery := float32(bytes[4] & 0b01111111)
	humidity := float32(bytes[7] & 0b01111111)

	return []Record{
		{s.Time, s.DeviceAddress, RecordTypes.Battery, battery},
		{s.Time, s.DeviceAddress, RecordTypes.Temperature, temperature},
		{s.Time, s.DeviceAddress, RecordTypes.Humidity, humidity},
	}, nil
}

func (p *Parser) parsePlugData(s AdStructure) ([]Record, error) {
	// プラグミニのパケットの仕様: https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/5351dff1c78f6c7e2191cb0e37b9df080266ae77/devicetypes/plugmini.md

	// プラグミニのデータはManufacturer (AdType 255)に入っているので、それ以外は無視
	if s.AdType != 255 {
		return nil, nil
	}

	bytes, err := hex.DecodeString(s.Data)
	if err != nil {
		return nil, err
	}

	var poweron int
	if bytes[9] == 0x80 {
		poweron = 1
	} else {
		poweron = 0
	}

	loadMSB := int(bytes[12] & 0b01111111)
	loadLSB := int(bytes[13])
	load := float32(loadMSB*0xff+loadLSB) / 10

	return []Record{
		{s.Time, s.DeviceAddress, RecordTypes.PowerOn, float32(poweron)},
		{s.Time, s.DeviceAddress, RecordTypes.Load, load},
	}, nil
}

func (p *Parser) parseMotionData(s AdStructure) ([]Record, error) {
	// https://github.com/OpenWonderLabs/SwitchBotAPI-BLE/blob/5351dff1c78f6c7e2191cb0e37b9df080266ae77/devicetypes/motionsensor.md
	// TODO: impl
	return nil, nil
}
