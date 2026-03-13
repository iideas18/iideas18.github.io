---
title: "Redis 事件驱动分析"
date: 2022-03-26 15:06:56
cover: "/2022/03/26/Redis/Redis 事件驱动分析/640.jpg"
categories:
  - "Redis"
---

很多公司面试的时候都喜欢问为什么 Redis 那么快？这就得益于 Redis的 `事件驱动模块 `，什么是 `事件驱动` 呢？通俗来说，`事件驱动` 指的是当某一事件发生触发某一处理过程。举个例子，当发生火灾时，就会触发消防队救火，在这个例子中，事件是发生火灾，而处理过程是消防队救火。而在 Redis 中的事件指的是客户端连接就绪（可接收或者可发送数据），所以当客户端连接就绪时，就会触发 Redis 的处理过程（调用某一个处理函数）去处理客户端连接。

一般来说，客户端连接（socket）需要添加到多路复用IO句柄中进行监听，多路复用IO可以监听到客户端连接的状态变化，当客户端连接状态发生变化时（变为可读或可写），多路复用IO就会把状态发生变化的客户端连接列表返回给调用方。如下图：

![Image](640.jpg)

不同的操作系统有不同的多路复用IO接口，比如 Linux 系统中使用的是 epoll，而 FreeBSD 系统中使用的 kqueue。由于Redis支持多操作系统平台，所以 Redis 为了跨平台对多路复用IO进行封装。

下面主要讨论 Redis 在 Linux 操作系统下对事件驱动库的封装。

## Redis 事件驱动库的使用

#### 1. 创建事件驱动对象

要使用Redis的事件驱动库，首先需要调用 `aeCreateEventLoop()` 函数创建一个事件驱动对象，其原型如下：

```
aeEventLoop *aeCreateEventLoop(int setsize);
```

参数 `setsize` 指定了事件驱动库能够监听多少个客户端连接，`aeCreateEventLoop()` 函数返回一个类型为 `aeEventLoop `的对象（结构体）。

#### 2. 添加监听的客户端连接

要监听一个客户端连接的状态变化，需要调用 `aeCreateFileEvent()` 函数把客户端连接添加到事件驱动对象中进行监听， `aeCreateFileEvent()` 函数原型如下：

```
int aeCreateFileEvent(aeEventLoop *eventLoop, int fd, int mask, aeFileProc *proc, void *clientData);
```

下面介绍一下 `aeCreateFileEvent()` 函数各个参数的作用：

- `eventLoop`：由 `aeCreateEventLoop()` 函数创建的事件驱动对象。
- `fd`：客户端连接socket句柄。
- `mask`：监听客户端连接的事件，有 `AE_READABLE（读）` 和 `AE_WRITABLE（写）` 两种事件。
- `proc`：事件发生时的处理函数。
- `clientData`：`proc` 函数的参数。

#### 3. 删除监听的客户端连接

当我们不希望某个客户端连接被事件驱动库监听时，可以通过调用 `aeDeleteFileEvent()` 把客户端连接从事件驱动库中删除，其原型如下：

```
void aeDeleteFileEvent(aeEventLoop *eventLoop, int fd, int mask);
```

下面介绍一下 `aeDeleteFileEvent()` 函数各个参数的作用：

- `eventLoop`：由 `aeCreateEventLoop()` 函数创建的事件驱动对象。
- `fd`：客户端连接socket句柄。
- `mask`：监听客户端连接的事件，有 `AE_READABLE（读）` 和 `AE_WRITABLE（写）` 两种事件。

#### 4. 等待客户端连接状态变化

当我们通过调用 `aeCreateEventLoop()` 函数把客户端连接添加到事件驱动库进行监听后，需要调用 `aeMain()` 函数等待客户端连接状态发生变化，其原型如下：

```
void aeMain(aeEventLoop *eventLoop);
```

`aeMain()` 函数只有一个参数，就是由 `aeCreateEventLoop()` 函数创建的事件驱动对象。

#### 5. 事件驱动库使用示例

下面我们通过一个 demo 来说明事件驱动库的使用：

```
#include "ae.h"

// 把socket设置为非阻塞
void set_nonblock(int sockfd) {
    flags = fcntl(sockfd, F_GETFL, 0);            // 获取socket的flags值。
    fcntl(sockfd, F_SETFL, flags | O_NONBLOCK);   // 设置成非阻塞模式；
}

// 创建一个socket并监听端口
int listen_socket(short port) {
    int sockfd;
    sockaddr_in sin;

    sockfd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP); // 创建监听端口的socket

    sin.sin_family = AF_INET;
    sin.sin_port = htons(port);
    sin.sin_addr.S_un.S_addr = INADDR_ANY;

    bind(sockfd, (struct sockaddr*)&sin, sizeof(sin));  // 绑定IP地址和端口
    listen(sockfd, 10);                                 // 开始监听
    set_nonblock(sockfd);                               // 把socket设置为非阻塞(比较重要, 否则可能会阻塞进程)

    return sockfd;
}

int main() {
    int serverfd;
    aeEventLoop *eventLoop;

    serverfd = listen_socket(8080);                                           // 创建监听端口的socket

    eventLoop = aeCreateEventLoop(1024);                                      // 创建事件驱动对象
    aeCreateFileEvent(eventLoop, serverfd, AE_READABLE, accept_client, NULL); // 把socket添加到事件驱动对象中进行监听
    aeMain(eventLoop);                                                        // 开始等待socket的状态发生变化
}

// 处理接收到的连接
void accept_client(struct aeEventLoop *eventLoop, int serverfd, void *data, int mask) {
    while (1) {
        int clientfd;

        clientfd = accept(serverfd, (struct sockaddr*)NULL, NULL);
        if (clientfd == -1) {
            break;
        }

        set_nonblock(clientfd); // 把客户端socket设置为非阻塞(比较重要, 否则可能会阻塞进程)

        // 把客户端连接添加到事件驱动库中进行监听
        aeCreateFileEvent(eventLoop, clientfd, AE_READABLE, process_client, NULL);
    }
}

// 处理客户端连接的请求
void process_client(struct aeEventLoop *eventLoop, int clientfd, void *data, int mask) {
    // ...
}
```

上面的示例主要展示了怎样使用 `Redis` 的事件驱动库，程序主要完成了以下几个部分：

- 创建监听 `8080` 端口的socket句柄，然后设置为非阻塞。
- 创建事件驱动对象，并把监听 `8080` 端口的socket句柄添加到事件驱动对象中进行监听，监听事件为 `读事件（AE_READABLE）`，当其状态发生变化（可读）时回调函数为 `accept_client()`。
- `accept_client()` 函数会调用 `accpet()` 系统调用来接收客户端连接socket，并且把其添加到事件驱动对象中进行监听，监听事件为 `读事件（AE_READABLE）`，当其状态发生变化（可读）时回调函数为 `process_client()`，`process_client()` 函数可以处理客户端连接的请求。

> 注意：使用 `Redis` 事件驱动库时，必须把socket设置为非阻塞状态，如果socket是阻塞状态，那么可能会导致接收或发生数据时阻塞进程。

## Redis 事件驱动库源码分析

前面说过，不同的操作系统平台有不同的 `多路复用I/O` 接口，Redis 为了跨平台，使用了面向接口的编程模式。如果使用 `Java` 或者 `Golang` 这些编程语言的同学可能接触过接口，以 Golang 为例，如果某一个对象（结构）实现接口的所有方法，那么就可以把这个对象（结构）当成这个接口。

但 Redis 是使用 `C语言` 编写的，C语言是没有接口这个概念的，所以必须使用某种方式来模拟接口。Redis 为不同的操作系统平台定义了不同的实现文件，而这些文件都实现相同的方法，然后根据不同的平台引入实现文件即可。例如，在 Linux 系统的实现文件是 `ae_epoll.c`，在 FreeBSD 系统的实现文件是 `ae_kqueue.c`，在 Soliris 系统的实现文件是 `ae_evport.c`，其他系统是 `ae_select.c`。打开这些文件可以发现，它们都实现了以下几个函数（方法）：

```
aeApiCreate()      // 用于创建平台对应的事件驱动上下文, 比如epoll就是创建epoll句柄
aeApiResize()      // 用于扩展事件驱动库能够监听的的客户端连接
aeApiFree()        // 用于释放由aeApiCreate()创建的上下文
aeApiAddEvent()    // 用于把客户端连接添加到事件驱动上下文中
aeApiDelEvent()    // 用于把客户端连接从事件驱动上下文中删除
aeApiPoll()        // 用于等待监听的客户端连接状态发生变化
aeApiName()        // 用于获取正在使用的事件驱动的类型(如epoll、kqueue、select等)
```

然后在 `ae.c` 文件中可以发现以下代码：

```
#ifdef HAVE_EVPORT
#include "ae_evport.c"
#else
    #ifdef HAVE_EPOLL
    #include "ae_epoll.c"
    #else
        #ifdef HAVE_KQUEUE
        #include "ae_kqueue.c"
        #else
        #include "ae_select.c"
        #endif
    #endif
#endif
```

上面的代码意思是：如果是 Soliris 系统就引入 `ae_evport.c` 文件，如果是 Linux 系统就引入 `ae_epoll.c` 文件，如果是 FreeBSD 系统就引入 `ae_kqueue.c` 文件，而其他系统就引入 `ae_select.c` 文件。

### Linux 系统下的实现

下面主要分析 Linux 平台的实现，也就是 `ae_epoll.c` 文件的实现，我们主要分析几个比较重要的方法：`aeApiCreate()`、`aeApiAddEvent()` 和 `aeApiPoll()`。

#### aeApiCreate() 函数

`aeApiCreate()` 函数用于创建平台对应的事件驱动上下文，其代码如下：

```
static int aeApiCreate(aeEventLoop *eventLoop) {
    aeApiState *state = zmalloc(sizeof(aeApiState));
    ...
    state->events = zmalloc(sizeof(struct epoll_event)*eventLoop->setsize);
    ...
    state->epfd = epoll_create(1024); /* 1024 is just a hint for the kernel */
    ...
    eventLoop->apidata = state;
    return 0;
}
```

Redis 定义了一个 `aeApiState` 结构体用于保存事件驱动上下文，在 `ae_epoll.c` 文件下的定义如下：

```
typedef struct aeApiState {
    int epfd;
    struct epoll_event *events;
} aeApiState;
```

`aeApiState` 结构体中的 `epfd` 字段用于保存使用 `epoll_create()` 系统调用创建的 epoll 文件句柄，而 `events` 字段是个 `epoll_event` 结构的数组，用于保存所有就绪（可读或可写）的客户端连接。

`aeApiCreate()` 函数的实现比较简单，主要完成以下几件事情：

- 首先申请一个 `aeApiState` 结构。
- 然后初始化其 `events` 字段（申请 `events` 数组需要的内存）。
- 接着调用 `epoll_create()` 函数创建一个 epoll 句柄并保存到 `epfd` 字段中。
- 最后把 `aeApiState` 结构保存到事件驱动对象的 `apidata` 字段中。

#### aeApiAddEvent() 函数

`aeApiAddEvent()` 函数用于把客户端连接添加到事件驱动上下文中进行监听，其代码如下：

```
static int aeApiAddEvent(aeEventLoop *eventLoop, int fd, int mask) {
    aeApiState *state = eventLoop->apidata;
    struct epoll_event ee = {0};
    int op = eventLoop->events[fd].mask == AE_NONE ? EPOLL_CTL_ADD : EPOLL_CTL_MOD;

    ee.events = 0;
    mask |= eventLoop->events[fd].mask; /* Merge old events */
    if (mask & AE_READABLE) ee.events |= EPOLLIN;     // 监听读事件
    if (mask & AE_WRITABLE) ee.events |= EPOLLOUT;    // 监听写事件
    ee.data.fd = fd;
    if (epoll_ctl(state->epfd,op,fd,&ee) == -1) return -1; // 把客户端连接添加到epoll中进行监听
    return 0;
}
```

`aeApiAddEvent()` 函数的参数作用如下：

- `eventLoop`：事件驱动对象。
- `fd`：添加要进行监听的客户端连接socket句柄。
- `mask`：要监听的事件（读或写）。

`aeApiAddEvent()` 函数主要通过调用 `epoll_ctl()` 系统调用把客户端连接添加到事件驱动上下文（epoll句柄）中进行监听，当然添加前要指定监听的事件，在epoll 中 `EPOLLIN` 表示读事件，而 `EPOLLOUT` 表示写事件。

#### aeApiPoll()函数

`aeApiPoll()` 函数用于等待监听的客户端连接状态发生变化，也就是等待客户端连接变为可读或者可写状态，其代码如下：

```
static int aeApiPoll(aeEventLoop *eventLoop, struct timeval *tvp) {
    aeApiState *state = eventLoop->apidata;
    int retval, numevents = 0;

    retval = epoll_wait(state->epfd,state->events,eventLoop->setsize,
            tvp ? (tvp->tv_sec*1000 + tvp->tv_usec/1000) : -1);
    if (retval > 0) {
        int j;

        numevents = retval;
        for (j = 0; j < numevents; j++) {
            int mask = 0;
            struct epoll_event *e = state->events+j;

            if (e->events & EPOLLIN) mask |= AE_READABLE;
            if (e->events & EPOLLOUT) mask |= AE_WRITABLE;
            if (e->events & EPOLLERR) mask |= AE_WRITABLE|AE_READABLE;
            if (e->events & EPOLLHUP) mask |= AE_WRITABLE|AE_READABLE;
            eventLoop->fired[j].fd = e->data.fd;
            eventLoop->fired[j].mask = mask;
        }
    }
    return numevents;
}
```

`tvp` 参数表示要等待多长时间，如果在等待的时间内没有客户端连接的状态发生变化，那么就会超时。`aeApiPoll()` 函数主要通过调用 `epoll_wait()` 系统调用来等待被监听的客户端连接的状态发生变化，`epoll_wait()` 系统调用会将就绪的客户端连接保存到 `events` 参数中，并且通过返回值告知其数量。最后，`aeApiPoll()` 函数会把就绪的客户端连接（socket句柄和发生的事件）记录到事件驱动对象的 `fired` 字段中。

### 事件驱动库封装

前面介绍了在 Linux 系统下的事件驱动实现，但为了跨平台的需要，Redis 还需要把这些函数进行一层封装，封装成统一的对外接口，也就是前面介绍过的事件驱动库接口。

这里，我们主要介绍以下几个接口的实现：`aeCreateEventLoop()`、`aeCreateFileEvent()` 和 `aeMain()`。

#### aeCreateEventLoop() 函数

`aeCreateEventLoop()` 函数的主要作用是创建一个类型为 `aeEventLoop` 的事件驱动对象，`aeEventLoop` 的定义如下：

```
typedef struct aeEventLoop {
    int maxfd;   /* highest file descriptor currently registered */
    int setsize; /* max number of file descriptors tracked */
    ...
    aeFileEvent *events; /* Registered events */
    aeFiredEvent *fired; /* Fired events */
    ...
    int stop;
    void *apidata; /* This is used for polling API specific data */
    ...
} aeEventLoop;
```

我们去掉了定时器相关的字段，下面介绍一下 `aeEventLoop` 结构各个字段的作用：

- `maxfd`：所有被监听的客户端连接中最大的句柄号，`select` 这种多路复用I/O需要用到。
- `setmax`：事件驱动对象最大能够监听的客户端连接数。
- `events`：所有注册到事件驱动对象中的客户端连接事件。
- `fired`：所有就绪的客户端连接事件。
- `stop`：是否要停止监听。
- `apidata`：用于保存前面介绍过的事件驱动上下文。

`aeCreateEventLoop()` 函数的实现如下：

```
aeEventLoop *aeCreateEventLoop(int setsize) {
    aeEventLoop *eventLoop;
    int i;

    if ((eventLoop = zmalloc(sizeof(*eventLoop))) == NULL) goto err;
    eventLoop->events = zmalloc(sizeof(aeFileEvent)*setsize);
    eventLoop->fired = zmalloc(sizeof(aeFiredEvent)*setsize);
    if (eventLoop->events == NULL || eventLoop->fired == NULL) goto err;
    eventLoop->setsize = setsize;
    ...
    eventLoop->stop = 0;
    eventLoop->maxfd = -1;
    ...
    if (aeApiCreate(eventLoop) == -1) goto err;
    
    for (i = 0; i < setsize; i++)
        eventLoop->events[i].mask = AE_NONE;
    return eventLoop;
    ...
}
```

`aeCreateEventLoop()` 函数的实现比较简单，主要是创建和初始化 `aeEventLoop` 对象。值得注意的是，`aeCreateEventLoop()` 函数调用了 `aeApiCreate()` 函数来创建事件驱动上下文。所以，`aeCreateEventLoop()` 函数主要是对 `aeApiCreate()` 函数的封装。

#### aeCreateFileEvent() 函数

`aeCreateFileEvent()` 函数用于添加被监听的客户端连接，其实现如下：

```
int aeCreateFileEvent(aeEventLoop *eventLoop, int fd,
        int mask, aeFileProc *proc, void *clientData)
{
    ...
    aeFileEvent *fe = &eventLoop->events[fd];

    if (aeApiAddEvent(eventLoop, fd, mask) == -1) // 把客户端连接添加到事件驱动上下文中
        return AE_ERR;
    fe->mask |= mask;
    if (mask & AE_READABLE) fe->rfileProc = proc; // 设置读事件的回调函数
    if (mask & AE_WRITABLE) fe->wfileProc = proc; // 设置写事件的回调函数
    fe->clientData = clientData;                  // 设置回调函数的参数
    if (fd > eventLoop->maxfd)
        eventLoop->maxfd = fd;
    return AE_OK;
}
```

`aeCreateFileEvent()` 函数的参数前面已经介绍过，这里就不再重复了。

`aeCreateFileEvent()` 函数首先会调用 `aeApiAddEvent()` 函数把客户端连接添加到事件驱动上下文（也就是epoll句柄）中进行监听，然后设置事件的回调函数和回调函数的参数。所以，`aeCreateFileEvent()` 函数主要是对 `aeApiAddEvent()` 函数的封装。

#### aeMain() 函数

`aeMain()` 函数用于等待客户端连接的状态发生变化，并且调用客户端连接的事件回调函数进行处理。代码如下：

```
void aeMain(aeEventLoop *eventLoop) {
    eventLoop->stop = 0;
    while (!eventLoop->stop) {
        aeProcessEvents(eventLoop, AE_ALL_EVENTS|
                                   AE_CALL_BEFORE_SLEEP|
                                   AE_CALL_AFTER_SLEEP);
    }
}
```

从上面的代码可以看出，`aeMain()` 函数里面是一个无限循环，循环的停止条件是事件驱动对象的 `stop` 字段被设置为1。在循环里，每次都会调用 `aeProcessEvents()` 函数来监听客户端连接的状态变化，并且调用事件相关的回调函数对客户端连接进行处理。 `aeProcessEvents()` 函数的实现如下：

```
int aeProcessEvents(aeEventLoop *eventLoop, int flags)
{
    int processed = 0, numevents;

    ...
    if (eventLoop->maxfd != -1 ||
        ((flags & AE_TIME_EVENTS) && !(flags & AE_DONT_WAIT))) {
        ...
        numevents = aeApiPoll(eventLoop, tvp); // 等待客户端连接就绪
        ...
        for (j = 0; j < numevents; j++) {
            aeFileEvent *fe = &eventLoop->events[eventLoop->fired[j].fd];
            int mask = eventLoop->fired[j].mask;
            int fd = eventLoop->fired[j].fd;
            int fired = 0; /* Number of events fired for current fd. */

            int invert = fe->mask & AE_BARRIER;

            if (!invert && fe->mask & mask & AE_READABLE) { // 处理读事件
                fe->rfileProc(eventLoop,fd,fe->clientData,mask);
                fired++;
                fe = &eventLoop->events[fd]; /* Refresh in case of resize. */
            }

            /* Fire the writable event. */
            if (fe->mask & mask & AE_WRITABLE) { // 处理写事件
                if (!fired || fe->wfileProc != fe->rfileProc) {
                    fe->wfileProc(eventLoop,fd,fe->clientData,mask);
                    fired++;
                }
            }

            if (invert) {
                fe = &eventLoop->events[fd]; /* Refresh in case of resize. */
                if ((fe->mask & mask & AE_READABLE) &&
                    (!fired || fe->wfileProc != fe->rfileProc))
                {
                    fe->rfileProc(eventLoop,fd,fe->clientData,mask);
                    fired++;
                }
            }
            processed++;
        }
    }
    ...
    return processed; /* return the number of processed file/time events */
}
```

`aeProcessEvents()` 函数首先会调用 `aeApiPoll()` 函数等待客户端连接的状态变化。然后遍历就绪的客户端连接，判断其发生的事件类型（读事件还是写事件）。如果发生的是读事件，那么就调用读事件回调函数对客户端连接进行处理。如果发生的是写事件，那么就调用写事件回调函数对客户端连接进行处理。

## 总结

这篇文章主要介绍了 Redis 的事件驱动库的使用与原理实现，Redis的事件驱动库主要使用了 多路复用I/O 来对客户端连接进行监听，如果客户端连接从不可用变为就绪，那么事件驱动库就会调用事件相关的回调函数对连接进行处理。

另外本文未对 Redis 事件驱动库的定时器进行分析，有兴趣的同学可以自行阅读代码分析。