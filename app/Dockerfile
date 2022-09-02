FROM golang:1.19.0-bullseye

RUN mkdir /go/src/app
WORKDIR /go/src/app

COPY go.mod go.sum main.go /go/src/app/
RUN go build -o app
