PROGRAM = dist/main

deploy: $(PROGRAM) dist/*
	./deploy.sh

$(PROGRAM): *.go
# for raspberry pi 3B+
	env GOOS=linux GOARCH=arm GOARM=7 \
		go build -o $(PROGRAM) main.go

clean:; rm -f $(PROGRAM)

.PHONY: deploy clean
