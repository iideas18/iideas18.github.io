---
title: "Memcached源码分析 - 源码分析之总结篇"
date: 2022-03-09 15:58:14
slug: "Memcache_8"
categories:
  - "memecached"
---

# Memcached源码分析 - 源码分析之总结篇

Memcached源码分析共8篇文章，前7篇文章主要分析每个模块的c源代码。这一篇文章主要是将之前的流程串起来，总结和回顾。同时通过这篇文章可以全局去看Memcached的结构。

## 一、Memcache的网络模型

- Memcached主要是基于Libevent 网络事件库进行开发的。

- Memcached的网络模型分为两部分：主线程和工作线程。主线程主要用来接收客户端的连接信息；工作线程主要用来接管客户端连接，处理具体的业务逻辑。默认情况下会开启8个工作线程。

- 主线程和工作线程之间主要是通过pipe管道来进行通信。当主线程接收到客户端的连接的时候，会通过轮询的方式选择一个工作线程，然后向该工作线程的管道pipe写数据。工作线程监听到管道中有数据写入的时候，就会触发代码逻辑去接管客户端的连接。

- 每个工作线程也是基于Libevent的事件机制，当客户端有数据写入的时候，就会触发读取的操作。

  详细的源码解读还是请看网络模型这一章节，下面是一张Memcached的网络模型图：

![image-20220309155404419](image-20220309155404419.png)

## 二、Memcached的命令解析和消息回应

- 每一个客户端连接都会维护一个struct conn的数据结构。该结构主要用来保存客户端的连接相关信息，以及读取客户端数据的buf结构，以及消息回应的iov和msghdr数据结构。

- Memcached的命令是通过\n符号来进行分割的。当接收到一串命令之后，会去检查rbuf中是否有\n符号，如果没有，则继续等待客户端的数据到来；如果有\n符号，则去解析这个命令。

- 每个命令行命令的参数，都是通过空格符号分割的。例如：get username。通过空格符号，将命令分解成N（N小于8）个部分，然后放入tokens的一个数组中。然后就可以通过不同的操作命令，来调用不同的业务逻辑。

- Memcached的消息回应主要是通过封装iov和msghdr的数据结构，调用sendmsg方法来向客户端发送数据。客户端也是通过\n的符号来分隔命令行。

  具体的源码解析，需要详细看命令解析和消息回应的章节。

看一下conn结构中比较重要的几个参数:

![image-20220309155516503](image-20220309155516503.png)

然后看一下整个命令解析和消息回应的流程图：

![image-20220309155554154](image-20220309155554154.png)

## 三、Memcached的缓存存储

- Memcached的缓存存储的基本单元是struct item的数据结构。每一个item都包含了存储缓存的key，key的长度，value值，value值的长度，缓存有效期，最近访问时间等信息。

- Memcached在初始化的时候，会初始化一个slabclass_t结构的数组（slabclass）。slabclass是数据空间，规定了不同长度的item会存储在不同的slabclass_t的结构上面。例如slabclass[0]最大存储96byte，slabclass[1]最大存储120byte，slabclass[2]最大存储150byte，则当一个item的大小为135byte的时候，会存储在slabclass[2]上面。

- Memcached每次分配内存都是以slab为基础单位。默认情况下，slab的大小为1M。slabclass在初始化的时候，Memcached会给每一个slabclass_t的数据结构分配一个1M大小的slab。slab主要是用来存储item数据的，当slab被分配了之后，就会根据每个slabclass_t所能存储的最大size（slabclass_t->size），来切分成N个item，并且将这部分item放入slabclass_t的空闲列表（*slots），当需要使用item的时候就会从这个空闲里列表中取一个。*

- 每个slabclass_t分配的item大小都是根据slabclass_t->size来设置的，真正存储的时候实际item的大小可能会小于slabclass_t->size的情况。浪费主要是为了减少内存碎片，内存管理起来更加合理。

- Memcached在读取数据的时候，需要依赖于HashTable。当每次创建一个Item的时候，都会将item的地址挂载到HashTable上去。客户端就可以通过key来查询到对应的item地址了。

- 每个使用中的item都会通过*prev和*next被挂载到LRU链表上。每个未使用的item都会通过*prev和*next放入slabclass的空闲链表*slots上。

- 当memcached需要使用item的时候，先去LRU链表尾部查询是否有过期的item，有的话则直接使用过期的item；如果没有，则取slabclass的空闲链表上获取一个待使用的item（如果空闲链表为空，则会分配一个1M的slab放入slabclass上，并且填充空闲链表）。如果内存分配失败，则开始开启LRU淘汰策略，就会从LRU链中强制淘汰一个item。

  详细的源码解读还得看前面的文章，Memcached的增删改查操作，HashTable，LRU，缓存存储机制slabs

看一下Item数据结构：

```C++
//item的具体结构  
typedef struct _stritem {  
    //记录下一个item的地址,主要用于LRU链和freelist链  
    struct _stritem *next;  
    //记录下一个item的地址,主要用于LRU链和freelist链  
    struct _stritem *prev;  
    //记录HashTable的下一个Item的地址  
    struct _stritem *h_next;  
    //最近访问的时间，只有set/add/replace等操作才会更新这个字段  
    //当执行flush命令的时候，需要用这个时间和执行flush命令的时间相比较，来判断是否失效  
    rel_time_t      time;       /* least recent access */  
    //缓存的过期时间。设置为0的时候，则永久有效。  
    //如果Memcached不能分配新的item的时候，设置为0的item也有可能被LRU淘汰  
    rel_time_t      exptime;    /* expire time */  
    //value数据大小  
    int             nbytes;     /* size of data */  
    //引用的次数。通过这个引用的次数，可以判断item是否被其它的线程在操作中。  
    //也可以通过refcount来判断当前的item是否可以被删除，只有refcount -1 = 0的时候才能被删除  
    unsigned short  refcount;  
    uint8_t         nsuffix;    /* length of flags-and-length string */  
    uint8_t         it_flags;   /* ITEM_* above */  
    //slabs_class的ID。  
    uint8_t         slabs_clsid;/* which slab class we're in */  
    uint8_t         nkey;       /* key length, w/terminating null and padding */  
    /* this odd type prevents type-punning issues when we do 
     * the little shuffle to save space when not using CAS. */  
    //数据存储结构  
    union {  
        uint64_t cas;  
        char end;  
    } data[];  
    /* if it_flags & ITEM_CAS we have 8 bytes CAS */  
    /* then null-terminated key */  
    /* then " flags length\r\n" (no terminating null) */  
    /* then data with terminating \r\n (no terminating null; it's binary!) */  
} item;  
```
slabclass的数据结构：

```C++
//slabclass的结构  
typedef struct {  
    //当前的slabclass存储最大多大的item  
    unsigned int size;  
    //每一个slab上可以存储多少个item.每个slab大小为1M， 可以存储的item个数根据size决定。  
    unsigned int perslab;  
  
    //当前slabclass的（空闲item列表）freelist 的链表头部地址  
    //freelist的链表是通过item结构中的item->next和item->prev连建立链表结构关系  
    void *slots;           /* list of item ptrs */  
    //当前总共剩余多少个空闲的item  
    //当sl_curr=0的时候，说明已经没有空闲的item，需要分配一个新的slab（每个1M，可以切割成N多个Item结构）  
    unsigned int sl_curr;   /* total free items in list */  
  
    //总共分配多少个slabs  
    unsigned int slabs;     /* how many slabs were allocated for this class */  
    //分配的slab链表  
    void **slab_list;       /* array of slab pointers */  
    unsigned int list_size; /* size of prev array */  
  
    unsigned int killing;  /* index+1 of dying slab, or zero if none */  
    //总共请求的总bytes  
    size_t requested; /* The number of requested bytes */  
} slabclass_t;  
//定义一个slabclass数组，用于存储最大200个的slabclass_t的结构。  
static slabclass_t slabclass[MAX_NUMBER_OF_SLAB_CLASSES];  
```
通过item的size来选择slab_class的数据存储空间：

![image-20220309155659073](image-20220309155659073.png)

slabclass和slab、item以及free list之间的关系：

 ![image-20220309155711072](image-20220309155711072.png)

LUR链，主要用于内存不够分配的时候，进行item的淘汰：

![image-20220309155728047](image-20220309155728047.png)

HashTable，Memcahced主要通过HashTable来查询Item的地址：

![image-20220309155739977](image-20220309155739977.png)

## 四、Memcached使用的注意事项

- 存储的数据尽量小于10K，因为数据太大，容易导致LRU淘汰比较严重，而且Memcached是CPU密集型的程序，容易降低QPS
- 分布式Memcached部署的时候，要注意热点Key
- 可以通过存储索引、拆分大结构数据等方式，存储比较小的缓存数据
- memcached的缓存会有LRU强制淘汰，所以设置了缓存不过期，在内存分配完了之后也会造成强制淘汰的情况。
- memcached的key有长度限制
- 存储的数据不能超过1M，最好小于10K