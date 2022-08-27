package main

import (
	"bufio"
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"strconv"
	"sync"
)

var elog = log.New(os.Stderr, "", log.LstdFlags)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	var broadcaster Broadcaster

	ln, err := StartListen(ctx, 5000)
	if err != nil {
		log.Fatalln(err)
	}

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				elog.Printf("accept failed: %v\n", err)
				continue
			}

			go func() {
				c := broadcaster.Subscribe()
				defer conn.Close()

				for {
					s, ok := <-c
					if !ok {
						return
					}

					_, err := conn.Write([]byte(s))
					if err != nil {
						elog.Printf("failed to send data. close connection. err=%v\n", err)
						broadcaster.Unsubscribe(c)
						return
					}
				}
			}()
		}
	}()

	queue := make(chan string, 500)
	defer close(queue)
	go func() {
		for {
			s, ok := <-queue
			if !ok {
				return
			}
			broadcaster.Publish(s)
		}
	}()

	scan := bufio.NewScanner(os.Stdin)
	for {
		line, err := scanLineWithContext(ctx, scan)
		if err != nil {
			elog.Print(err)
			break
		}
		if line == "" {
			break
		}

		if len(queue) == cap(queue) {
			<-queue
		}
		queue <- line
	}
}

// net.Listen/Accept with context
type Listener struct {
	ln  net.Listener
	ctx context.Context
}

func StartListen(ctx context.Context, port int) (*Listener, error) {
	ln, err := net.Listen("tcp", ":"+strconv.Itoa(port))
	if err != nil {
		return nil, err
	}

	go func() {
		<-ctx.Done()
		ln.Close()
	}()

	return &Listener{
		ln:  ln,
		ctx: ctx,
	}, nil
}

func (l *Listener) Accept() (net.Conn, error) {
	conn, err := l.ln.Accept()

	select {
	case <-l.ctx.Done():
		return nil, nil
	default:
	}

	if err != nil {
		elog.Printf("accept failed: %v\n", err)
	}

	return conn, nil
}

func scanLineWithContext(ctx context.Context, s *bufio.Scanner) (string, error) {
	chText := make(chan string)
	chErr := make(chan error)
	go func() {
		ok := s.Scan()
		if ok {
			chText <- s.Text()
			return
		}
		if err := s.Err(); err != nil {
			chErr <- err
		} else {
			chText <- ""
		}
	}()

	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case err := <-chErr:
		return "", err
	case text := <-chText:
		return text, nil
	}
}

// subscribeしている複数のchannelに対してstringをpublishする中継機
type Broadcaster struct {
	subscribers sync.Map
}

func (b *Broadcaster) Subscribe() <-chan string {
	c := make(chan string)
	b.subscribers.Store(c, c)
	return c
}

func (b *Broadcaster) Unsubscribe(c <-chan string) {
	v, _ := b.subscribers.Load(c)
	b.subscribers.Delete(c)

	switch old := v.(type) {
	case chan string:
		close(old)
	}
}

func (b *Broadcaster) Publish(s string) {
	b.subscribers.Range(func(key any, value any) bool {
		switch c := value.(type) {
		case chan string:
			c <- s
		}

		return true
	})
}
