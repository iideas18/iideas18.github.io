---
title: "Redis 6.0 IO线程功能分析"
date: 2022-03-26 19:54:26
categories:
  - "Redis"
---

## 1. Redis多线程原理

`Redis 6.0` 的亮点之一就是支持多线程，Redis 分 `主线程` 和 `IO线程`，`IO线程` 只用于读取客户端的命令和发送回复数据给客户端，处理客户端命令还是在 `主线程` 进行，如下图所示：

![Image](Redis%206.0%20IO%E7%BA%BF%E7%A8%8B%E5%8A%9F%E8%83%BD%E5%88%86%E6%9E%90/640.jpg)

从上图可知，`主线程` 主要负责接收客户端连接，并且分发到各个 `IO线程`，而 `IO线程` 负责读取客户端命令。命令读取完成后，由 `主线程` 执行命令。`主线程` 执行完命令后，再由 `IO线程` 把回复数据发送给客户端。

读者可能会问，为什么处理命令不在 `IO线程` 进行，我觉得主要有两个原因：

- 如果处理命令在 `IO线程` 进行，那么就会涉及到竞争的问题。因为 Redis 的数据库是共享的，所以如果多个线程同时操作数据库，那么就必须要对数据库进行上锁，而上锁是一个比较耗时的操作（因为上锁可能会导致线程上下文切换）。
- 由于 Redis 6.0 以前一直都是由单线程执行命令的，所以如果要改为多线程执行命令，那么需要修改大量代码，而且可能会引入新的问题（比如bug）。所以，为了稳定性，继续使用单线程执行命令是最好的选择。

为什么要使用多线程呢？主要为了使用多核CPU的优势，下面是使用多线程的测试数据（数据来源网络）：

![Image](Redis%206.0%20IO%E7%BA%BF%E7%A8%8B%E5%8A%9F%E8%83%BD%E5%88%86%E6%9E%90/640.png)



![Image](Redis%206.0%20IO%E7%BA%BF%E7%A8%8B%E5%8A%9F%E8%83%BD%E5%88%86%E6%9E%90/640-1648278475525.png)

从上面的测试结果可以看出，多线程版本的 Redis 读写QPS都要比单线程版本的高。

## 2. Redis 多线程实现

要开启 Redis 的 `IO线程` 功能，可以在配置文件中加入以下配置项：

```
io-threads-do-reads yes     # 开启IO线程
io-threads 6                # 设置IO线程数
```

Redis 在启动时会根据配置文件中设置的 `IO线程` 数来启动 `IO线程`，启动 `IO线程` 在函数 `initThreadedIO()` 中完成，代码如下：

```c++
void initThreadedIO(void) {
    io_threads_active = 0;
    
    if (server.io_threads_num == 1) return;
    ...
    for (int i = 0; i < server.io_threads_num; i++) {
        /* Things we do for all the threads including the main thread. */
        io_threads_list[i] = listCreate();
        if (i == 0) continue; /* Thread 0 is the main thread. */

        /* Things we do only for the additional threads. */
        pthread_t tid;
        pthread_mutex_init(&io_threads_mutex[i],NULL);
        io_threads_pending[i] = 0;
        pthread_mutex_lock(&io_threads_mutex[i]); /* Thread will be stopped. */
        if (pthread_create(&tid,NULL,IOThreadMain,(void*)(long)i) != 0) {
            serverLog(LL_WARNING,"Fatal: Can't initialize IO thread.");
            exit(1);
        }
        io_threads[i] = tid;
    }
}
```

`initThreadedIO()` 函数的主要工作是：

- 为每个IO线程创建一个链表，用于放置要进行IO操作的客户端连接。
- 为每个IO线程创建一个锁，用于主线程与IO线程的通信。
- 调用 `pthread_create()` 系统调用来创建IO线程，IO线程的主体函数是 `IOThreadMain()`。

下面我们来分析一下IO线程的主体函数主要完成的工作：

```c++
void *IOThreadMain(void *myid) {
    long id = (unsigned long)myid;
    ...
    while (1) {
        /* Wait for start */
        for (int j = 0; j < 1000000; j++) {
            if (io_threads_pending[id] != 0) break;
        }

        if (io_threads_pending[id] == 0) { // 不等于0表示有客户端连接需要处理
            pthread_mutex_lock(&io_threads_mutex[id]);
            pthread_mutex_unlock(&io_threads_mutex[id]);
            continue;
        }
        ...
        listIter li;
        listNode *ln;
        listRewind(io_threads_list[id],&li);
        while((ln = listNext(&li))) {
            client *c = listNodeValue(ln);
            if (io_threads_op == IO_THREADS_OP_WRITE) {
                writeToClient(c,0);
            } else if (io_threads_op == IO_THREADS_OP_READ) {
                readQueryFromClient(c->conn);
            } else {
                serverPanic("io_threads_op value is unknown");
            }
        }
        listEmpty(io_threads_list[id]);
        io_threads_pending[id] = 0;
        ...
    }
}
```

IO线程的主体函数主要完成以下几个操作：

- 等待主线程分配客户端连接（对应IO线程的 `io_threads_list` 链表不为空）。
- 判断当前是进行读操作还是写操作（`io_threads_op` 等于 `IO_THREADS_OP_WRITE` 表示要进行写操作，而 `io_threads_op` 等于 `IO_THREADS_OP_READ` 表示要进行读操作）。如果是进行写操作，那么就调用 `writeToClient()` 函数向客户端连接进行发送数据。如果是读操作，那么就调用 `readQueryFromClient()` 函数读取客户端连接的请求。
- 完成对客户端连接的读写操作后，需要清空对应IO线程的 `io_threads_list` 链表和计数器 `io_threads_pending`，用于通知主线程已经完成读写操作。

那么，主线程是怎样分配客户端连接给各个IO线程的呢？

主线程在接收到客户端连接后，会把客户端连接添加到事件驱动库中监听其读事件，读事件的回调函数为 `readQueryFromClient()`。也就是说，当客户端连接可读时会触发调用 `readQueryFromClient()` 函数，而 `readQueryFromClient()` 函数会调用 `postponeClientRead()` 函数判断当前 Redis 是否开启了 `IO线程` 功能，代码如下：

```c++
int postponeClientRead(client *c) {
    if (io_threads_active &&
        server.io_threads_do_reads &&
        !ProcessingEventsWhileBlocked &&
        !(c->flags & (CLIENT_MASTER|CLIENT_SLAVE|CLIENT_PENDING_READ)))
    {
        c->flags |= CLIENT_PENDING_READ;
        listAddNodeHead(server.clients_pending_read,c);
        return 1;
    } else {
        return 0;
    }
}
```

`postponeClientRead()` 函数主要判断 Redis 是否开启了 `IO线程` 功能，如果开启了就调用 `listAddNodeHead()` 函数把客户端连接添加到 `clients_pending_read` 链表中，并且设置客户端连接的 `CLIENT_PENDING_READ` 标志位，表示当前连接已经在 `clients_pending_read` 链表中，防止二次添加。

把客户端连接添加到 `clients_pending_read` 链表后，主线程会在 `handleClientsWithPendingReadsUsingThreads()` 函数中把客户端连接分配给各个 `IO线程`。代码如下：

```c++
int handleClientsWithPendingReadsUsingThreads(void) {
    ...
    /* 分配给各个IO线程 */
    listIter li;
    listNode *ln;
    listRewind(server.clients_pending_read,&li);
    int item_id = 0;
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        int target_id = item_id % server.io_threads_num;
        listAddNodeTail(io_threads_list[target_id],c);
        item_id++;
    }

    // 设置各个IO线程负责的客户端连接数
    io_threads_op = IO_THREADS_OP_READ;
    for (int j = 1; j < server.io_threads_num; j++) {
        int count = listLength(io_threads_list[j]);
        io_threads_pending[j] = count;
    }

    // 主线程也要负责一部分客户端连接的读写操作
    listRewind(io_threads_list[0],&li);
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        readQueryFromClient(c->conn);
    }
    listEmpty(io_threads_list[0]);

    // 等待所有IO线程完成
    while (1) {
        unsigned long pending = 0;
        for (int j = 1; j < server.io_threads_num; j++)
            pending += io_threads_pending[j];
        if (pending == 0) break;
    }
    ...
    // 执行各个客户端连接的命令
    while(listLength(server.clients_pending_read)) {
        ln = listFirst(server.clients_pending_read);
        client *c = listNodeValue(ln);
        c->flags &= ~CLIENT_PENDING_READ;
        listDelNode(server.clients_pending_read,ln);

        if (c->flags & CLIENT_PENDING_COMMAND) {
            c->flags &= ~CLIENT_PENDING_COMMAND;
            if (processCommandAndResetClient(c) == C_ERR) {
                continue;
            }
        }
        processInputBuffer(c);
    }
    return processed;
}
```

`handleClientsWithPendingReadsUsingThreads()` 函数主要完成以下几个操作：

- 分配客户端连接给各个 `IO线程`（添加到对应 `IO线程` 的 `io_threads_list` 链表中），分配策略为轮询。
- 设置各个 `IO线程` 负责的客户端连接数 `io_threads_pending`。
- 处理主线程负责那部分客户端连接的读写操作。
- 等待所有 `IO线程` 完成读取客户端连接请求的命令。
- 执行各个客户端连接请求的命令。

前面说过，`IO线程` 在完成读取客户端连接的请求后，会把 `io_threads_pending` 计数器清零，主线程就是通过检测 `io_threads_pending` 计数器来判断是否所有 `IO线程` 都完成了对客户端连接的读取命令操作。

但这里要吐槽一下的是，在等待 `IO线程` 读取客户端请求时，居然用了一个死循环来等待，这样有可能会导致CPU使用率飙升的问题，有可能影响其他服务的运行（不知道作者怎么想的）。我觉得比较合适的方式是，各个 `IO线程` 完成了读取命令操作后，通过一个信号来通知主线程。