FROM golang:1.19.0-bullseye

RUN mkdir /app
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./
RUN go build -o /switchbot-logger

CMD [ "/switchbot-logger" ]
