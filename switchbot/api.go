package switchbot

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

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

func FetchDevices(token string, secret string) (*DevicesSchema, error) {
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
