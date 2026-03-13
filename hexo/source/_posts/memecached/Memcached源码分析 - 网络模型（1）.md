---
title: "Memcached源码分析 - 网络模型（1）"
date: 2022-03-08 15:14:54
cover: "https://upload-images.jianshu.io/upload_images/6302559-7b933753b04ac9bb.png?imageMogr2/auto-orient/strip|imageView2/2/w/856/format/webp"
categories:
  - "memecached"
---

# Memcached源码分析 - 网络模型（1）

[Memcached源码分析 - 网络模型（1）](https://www.jianshu.com/p/eb57e7ae3893)
[Memcached源码分析 - 命令解析（2）](https://www.jianshu.com/p/5e0f54bb709c)
[Memcached源码分析 - 数据存储（3）](https://www.jianshu.com/p/2db1380b46e4)
[Memcached源码分析 - 增删改查操作（4）](https://www.jianshu.com/p/dafe0e878ca1)
[Memcached源码分析 - 内存存储机制Slabs（5）](https://www.jianshu.com/p/539860ea1b2c)
[Memcached源码分析 - LRU淘汰算法（6）](https://www.jianshu.com/p/bbd24ba0ad62)
[Memcached源码分析 - 消息回应（7）](https://www.jianshu.com/p/789440f853f4)

搞清楚和redis在多线程处理方面的差异

## 1. Memcached网络模型

- 1.Memcached主要是基于Libevent 网络事件库进行开发的。

- 2.Memcached的网络模型分为两部分：**主线程和工作线程**。主线程主要用来接收客户端的连接信息；工作线程主要用来接管客户端连接，处理具体的业务逻辑。默认情况下会开启8个工作线程。

  > 主线程和工作线程之间主要是**通过pipe管道**来进行通信。当主线程接收到客户端的连接的时候，会通过轮询的方式选择一个工作线程，然后向该工作线程的管道pipe写数据。工作线程监听到管道中有数据写入的时候，就会触发代码逻辑去接管客户端的连接。

  > 每个工作线程也是**基于Libevent的事件机制**，当客户端有数据写入的时候，就会触发读取的操作。

  ![img](https://upload-images.jianshu.io/upload_images/6302559-7b933753b04ac9bb.png?imageMogr2/auto-orient/strip|imageView2/2/w/856/format/webp)

## 2. libevent的知识铺垫

 整个步骤是：

1. pEventBase =event_init(); **初始化libevent库**
2. event_set(&event , sock, EV_READ | EV_PERSIST, MyCallBack, (void*)0 ); **赋值 struct event结构**
3. event_base_set(pEventBase, &event); **修改struct event事件结构所属的event_base为指定的event_base**
4. event_add(&event, 0); **增加事件到事件监控中**
5. event_base_loop(pEventBase, 0); **事件循环。调用底层的select、poll或epoll等，如监听事件发生，调用事件结构中指定的回调函数**

```csharp
//事件回调处理函数

static void MyCallBack(const int fd, constshort which, void *arg) {}
 

Int main(int argc, char** argv)
{
       //初始化libevent
       struct event_base *pEventBase;
       pEventBase =event_init();
       intsock=socket(……);
      
       struct event event;
       event_set(&event , sock, EV_READ | EV_PERSIST, MyCallBack, (void*)0 );
       event_base_set(pEventBase, &event);
       event_add(&event, 0);
       event_base_loop(pEventBase, 0);
       
      return 0;
}
```

## 3. 主线程初始化逻辑

 Memcached主线程的初始化逻辑比较简单，主要作用是启动**监听的master线程**和**工作的worker线程**，其中启动worker线程通过**memcached_thread_init**函数进行实现，这部分逻辑分析在worker线程初始化当中进行分析，这里主要分析**监听的master线程**。
 整个master线程的启动过程就是socket的server端初始化结合libevent的初始化。整个过程如下：

- server_sockets，该方法主要是遍历所有listen的socket列表并逐个进行绑定。

- server_socket，该方法主要是操作单个socket到listen状态。

- conn_new，将socket注册到libevent当中。

- event_handler，监听socket的回调函数。

- 最后event_base_loop让整个libevent进行循环工作状态。

 解析参数并把遍历所有的监听socket进行绑定。

```cpp
int main (int argc, char **argv) {
  
  #if defined(LIBEVENT_VERSION_NUMBER) && LIBEVENT_VERSION_NUMBER >= 0x02000101
    struct event_config *ev_config;
    ev_config = event_config_new();
    event_config_set_flag(ev_config, EVENT_BASE_FLAG_NOLOCK);
    main_base = event_base_new_with_config(ev_config);
    event_config_free(ev_config);
  #else
    /* Otherwise, use older API */
    main_base = event_init();
  #endif

  #ifdef EXTSTORE
    slabs_set_storage(storage);
    memcached_thread_init(settings.num_threads, storage);
    init_lru_crawler(storage);
  #else
    memcached_thread_init(settings.num_threads, NULL);
    init_lru_crawler(NULL);
  #endif


 if (settings.port && server_sockets(settings.port, tcp_transport,
                                           portnumber_file)) {
            vperror("failed to listen on TCP port %d", settings.port);
            exit(EX_OSERR);
        }

 /* enter the event loop */
 if (event_base_loop(main_base, 0) != 0) {
        retval = EXIT_FAILURE;
    }
}
```

执行方法server_socket(p, the_port, transport, portnumber_file)。

```cpp
static int server_sockets(int port, enum network_transport transport,
                          FILE *portnumber_file) {
    if (settings.inter == NULL) {
        return server_socket(settings.inter, port, transport, portnumber_file);
    } else {
        // tokenize them and bind to each one of them..
        char *b;
        int ret = 0;
        char *list = strdup(settings.inter);
        for (char *p = strtok_r(list, ";,", &b);
            ret |= server_socket(p, the_port, transport, portnumber_file);
        }
        free(list);
        return ret;
    }
}
```

针对单个listen的socket的初始化过程，这里主要做的事情是socket的相关初始化过程，主要是指设置socket相关的一些参数；进行socket的bind操作；通过方法conn_new关联socket和libevent当中。

```cpp
static int server_socket(const char *interface,
                         int port,
                         enum network_transport transport,
                         FILE *portnumber_file) {
    int sfd;
    struct linger ling = {0, 0};
    struct addrinfo *ai;
    struct addrinfo *next;
    struct addrinfo hints = { .ai_flags = AI_PASSIVE,
                              .ai_family = AF_UNSPEC };
    char port_buf[NI_MAXSERV];
    int error;
    int success = 0;
    int flags =1;

    for (next= ai; next; next= next->ai_next) {
        conn *listen_conn_add;
        if ((sfd = new_socket(next)) == -1) {
            continue;
        }

        //todo 设置socket相关的属性，这里省略相关代码

        // 绑定socket，省略相关代码
        if (bind(sfd, next->ai_addr, next->ai_addrlen) == -1) {}

        // 暂时只关心TCP协议的，忽略UDP协议实现
        if (IS_UDP(transport)) {
        } else {
            if (!(listen_conn_add = conn_new(sfd, conn_listening,
                                             EV_READ | EV_PERSIST, 1,
                                             transport, main_base))) {
                fprintf(stderr, "failed to create listening connection\n");
                exit(EXIT_FAILURE);
            }
            listen_conn_add->next = listen_conn;
            listen_conn = listen_conn_add;
        }
    }

    freeaddrinfo(ai);

    /* Return zero iff we detected no errors in starting up connections */
    return success == 0;
}
```

conn_new内部就是执行libevent相关的配置，包括event_set和event_base_set，这里需要关注的是event_set当中绑定了回调函数event_handler，用于连接到来后执行的逻辑。

```csharp
conn *conn_new(const int sfd, enum conn_states init_state,
                const int event_flags,
                const int read_buffer_size, enum network_transport transport,
                struct event_base *base) {
    conn *c;
    c = conns[sfd];

    // libevent相关的设置
    event_set(&c->event, sfd, event_flags, event_handler, (void *)c);
    event_base_set(base, &c->event);
    c->ev_flags = event_flags;

    if (event_add(&c->event, 0) == -1) {
        perror("event_add");
        return NULL;
    }

    STATS_LOCK();
    stats_state.curr_conns++;
    stats.total_conns++;
    STATS_UNLOCK();

    MEMCACHED_CONN_ALLOCATE(c->sfd);

    return c;
}
```

回调函数event_handler的核心在于drive_machine，这个函数是整个Memcached的状态转移中心，所有的操作都通过drive_machine进行驱动来实现的。

```cpp
void event_handler(const int fd, const short which, void *arg) {
    conn *c;

    c = (conn *)arg;
    assert(c != NULL);

    c->which = which;

    /* sanity */
    if (fd != c->sfd) {
        if (settings.verbose > 0)
            fprintf(stderr, "Catastrophic: event fd doesn't match conn fd!\n");
        conn_close(c);
        return;
    }

    drive_machine(c);
    return;
}
```

## 3. 工作线程worker的初始化逻辑

 memcached_thread_init主要用于工作线程worker的初始化，核心的三个操作主要是：

- 初始化master线程和worker线程通信的pipe管道，**pipe(fds)**。
- setup_thread，主要用于设置工作线程libevent相关的参数。
- create_worker，主要是启动工作线程开始循环处理工作。

```cpp
void memcached_thread_init(int nthreads, void *arg) {
    int         i;
    
    // 初始化所有工作线程的pipe的fds
    for (i = 0; i < nthreads; i++) {
        int fds[2];
        if (pipe(fds)) {}
        threads[i].notify_receive_fd = fds[0];
        threads[i].notify_send_fd = fds[1];
        threads[i].storage = arg;

        // 初始化线程对应的libevent事件
        setup_thread(&threads[i]);
        stats_state.reserved_fds += 5;
    }

    // 每个线程进入libevent的事件循环当中
    for (i = 0; i < nthreads; i++) {
        create_worker(worker_libevent, &threads[i]);
    }
}
```

 setup_thread内部主要是初始化工作线程worker的libevent相关参数，这里我们重点关注包括：

- 回调函数thread_libevent_process。
- 初始化master线程和worker线程通信的队列cq_init(me->new_conn_queue)。

```php
static void setup_thread(LIBEVENT_THREAD *me) {
    me->base = event_init();
    event_set(&me->notify_event, me->notify_receive_fd,
              EV_READ | EV_PERSIST, thread_libevent_process, me);
    event_base_set(me->base, &me->notify_event);

    if (event_add(&me->notify_event, 0) == -1) {
        fprintf(stderr, "Can't monitor libevent notify pipe\n");
        exit(1);
    }

    me->new_conn_queue = malloc(sizeof(struct conn_queue));
    if (me->new_conn_queue == NULL) {
        perror("Failed to allocate memory for connection queue");
        exit(EXIT_FAILURE);
    }

    cq_init(me->new_conn_queue);
}
```

 create_worker主要是启动工作线程worker使其开始工作就可以了。

- create_worker(worker_libevent, &threads[i])传入函数是worker_libevent
- 通过pthread_create方法触发worker_libevent的工作
- 在worker_libevent方法内部通过event_base_loop最终使得libevent开始工作。

```cpp
static void create_worker(void *(*func)(void *), void *arg) {
    pthread_attr_t  attr;
    int             ret;

    pthread_attr_init(&attr);

    if ((ret = pthread_create(&((LIBEVENT_THREAD*)arg)->thread_id, &attr, func, arg)) 
                                            != 0) {}
}

static void *worker_libevent(void *arg) {
    LIBEVENT_THREAD *me = arg;
    register_thread_initialized();
    event_base_loop(me->base, 0);
    event_base_free(me->base);
    return NULL;
}


typedef struct {
    pthread_t thread_id;        /* unique ID of this thread */
    struct event_base *base;    /* libevent handle this thread uses */
    struct event notify_event;  /* listen event for notify pipe */
    int notify_receive_fd;      /* receiving end of notify pipe */
    int notify_send_fd;         /* sending end of notify pipe */
    struct thread_stats stats;  /* Stats generated by this thread */
    struct conn_queue *new_conn_queue; /* queue of new connections to handle */
    cache_t *suffix_cache;      /* suffix cache */
    logger *l;                  /* logger buffer */
    void *lru_bump_buf;         /* async LRU bump buffer */
} LIBEVENT_THREAD;
```

thread_libevent_process用于接收到master线程分发的新连接并进行处理，新的连接到来以后通过conn_new来处理新到来的连接。

```cpp
static void thread_libevent_process(int fd, short which, void *arg) {
    LIBEVENT_THREAD *me = arg;
    CQ_ITEM *item;
    char buf[1];
    conn *c;
    unsigned int timeout_fd;

    if (read(fd, buf, 1) != 1) {
        if (settings.verbose > 0)
            fprintf(stderr, "Can't read from libevent pipe\n");
        return;
    }

    switch (buf[0]) {
    case 'c':
        item = cq_pop(me->new_conn_queue);

        if (NULL == item) {
            break;
        }
        switch (item->mode) {
            case queue_new_conn:
                c = conn_new(item->sfd, item->init_state, item->event_flags,
                                   item->read_buffer_size, item->transport,
                                   me->base);
                if (c == NULL) {
                } else {
                    c->thread = me;
                }
                break;

            case queue_redispatch:
                conn_worker_readd(item->c);
                break;
        }
}
```

## 4. 主从线程通信流程分析

 尝试讲清楚master线程和worker线程之间如何实现新来socket的分发操作。
 在master线程接受连接以后会触发drive_machine方法，其中master的状态为conn_listening，所以我们暂时只关注这部分逻辑，最终我们通过dispatch_conn_new方法实现master到worker的分发操作。

```cpp
static void drive_machine(conn *c) {
    bool stop = false;
    int sfd;
    socklen_t addrlen;
    struct sockaddr_storage addr;
    int nreqs = settings.reqs_per_event;
    int res;
    const char *str;
#ifdef HAVE_ACCEPT4
    static int  use_accept4 = 1;
#else
    static int  use_accept4 = 0;
#endif

    assert(c != NULL);

    while (!stop) {

        switch(c->state) {
        case conn_listening:
            addrlen = sizeof(addr);
            sfd = accept(c->sfd, (struct sockaddr *)&addr, &addrlen);
           // 中间省略一系列的socket相关的初始化工作            
            if (settings.maxconns_fast &&
            } else {
                dispatch_conn_new(sfd, conn_new_cmd, EV_READ | EV_PERSIST,
                                     DATA_BUFFER_SIZE, c->transport);
            }

            stop = true;
            break;
```

 dispatch_conn_new内部实现的功能比较简单，用于实现master向worker分发新连接：

- 组装通信的CQ_ITEM对象，CQ_ITEM *item = cqi_new();
- 通过轮询方式选择worker对象，(last_thread + 1) % settings.num_threads;
- 通过pipe管道想worker发送新连接的socket，write(thread->notify_send_fd, buf, 1)，其中buf[0] = 'c'。

```rust
void dispatch_conn_new(int sfd, enum conn_states init_state, int event_flags,
                       int read_buffer_size, enum network_transport transport) {
    CQ_ITEM *item = cqi_new();
    char buf[1];
    if (item == NULL) {
        close(sfd);
        /* given that malloc failed this may also fail, but let's try */
        fprintf(stderr, "Failed to allocate memory for connection object\n");
        return ;
    }

    int tid = (last_thread + 1) % settings.num_threads;

    LIBEVENT_THREAD *thread = threads + tid;

    last_thread = tid;

    item->sfd = sfd;
    item->init_state = init_state;
    item->event_flags = event_flags;
    item->read_buffer_size = read_buffer_size;
    item->transport = transport;
    item->mode = queue_new_conn;

    cq_push(thread->new_conn_queue, item);

    MEMCACHED_CONN_DISPATCH(sfd, thread->thread_id);
    buf[0] = 'c';
    if (write(thread->notify_send_fd, buf, 1) != 1) {
        perror("Writing to thread notify pipe");
    }
}
```

thread_libevent_process是worker线程接受master分发新来连接时候的回调函数，内部通过conn_new来处理新连接的到来，conn_new的内部操作就是把心连接的socket注册到worker线程的libevent当中。

```cpp
static void thread_libevent_process(int fd, short which, void *arg) {
    LIBEVENT_THREAD *me = arg;
    CQ_ITEM *item;
    char buf[1];
    conn *c;
    unsigned int timeout_fd;

    if (read(fd, buf, 1) != 1) {
        if (settings.verbose > 0)
            fprintf(stderr, "Can't read from libevent pipe\n");
        return;
    }

    switch (buf[0]) {
    case 'c':
        item = cq_pop(me->new_conn_queue);

        if (NULL == item) {
            break;
        }
        switch (item->mode) {
            case queue_new_conn:
                c = conn_new(item->sfd, item->init_state, item->event_flags,
                                   item->read_buffer_size, item->transport,
                                   me->base);
                if (c == NULL) {
                } else {
                    c->thread = me;
                }
                break;

            case queue_redispatch:
                conn_worker_readd(item->c);
                break;
        }
}



conn *conn_new(const int sfd, enum conn_states init_state,
                const int event_flags,
                const int read_buffer_size, enum network_transport transport,
                struct event_base *base) {
    conn *c;
    c = conns[sfd];

    // libevent相关的设置
    event_set(&c->event, sfd, event_flags, event_handler, (void *)c);
    event_base_set(base, &c->event);
    c->ev_flags = event_flags;

    if (event_add(&c->event, 0) == -1) {
        perror("event_add");
        return NULL;
    }

    STATS_LOCK();
    stats_state.curr_conns++;
    stats.total_conns++;
    STATS_UNLOCK();

    MEMCACHED_CONN_ALLOCATE(c->sfd);

    return c;
}
```