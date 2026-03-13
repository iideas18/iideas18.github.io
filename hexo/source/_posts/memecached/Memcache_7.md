---
title: "Memcached源码分析 - 存储机制Slabs"
date: 2022-03-09 15:52:14
slug: "Memcache_7"
categories:
  - "memecached"
---

# Memcached源码分析 - 存储机制Slabs

## 一、前言

前几章节我们介绍了Memcached的网络模型，命令行的解析，消息回应，HashTable，Memcached的增删改查操作以及LRU算法模块。

这一章我们重点讲解Memcached的存储机制Slabs。Memcached存储Item的代码都是在slabs.c中来实现的。

在解读这一章前，我们必须先了解几个概念。

Item 缓存数据存储的基本单元

- Item是Memcached存储的最小单位
- 每一个缓存都会有自己的一个Item数据结构
- Item主要存储缓存的key、value、key的长度、value的长度、缓存的时间等信息。
- HashTable和LRU链表结构都是依赖Item结构中的元素的。
- 在Memcached中，Item扮演着重要的角色。

```c++
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

### 1. slabclass 划分数据空间

Memcached在启动的时候，会初始化一个slabclass数组，该数组用于存储最大200个slabclass_t的数据结构体。
Memcached并不会将所有大小的数据都会放置在一起，而是预先将数据空间划分为一系列的slabclass_t。
每个slabclass_t，都只存储一定大小范围的数据。slabclass数组中，前一个slabclass_t可以存储的数据大小要小于下一个slabclass_t结构可以存储的数据大小。
例如：slabclass[3]只存储大小介于120 （slabclass[2]的最大值）到 150 bytes的数据。如果一个数据大小为134byte将被分配到slabclass[3]中。
memcached默认情况下下一个slabclass_t存储数据的最大值为前一个的1.25倍（settings.factor），这个可以通过修 改-f参数来修改增长比例。

```c++
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

### 2. slab 内存分配单位

- Memcached的内存分配是以slab为单位的。默认情况下，每个slab大小为1M。
- slabclass数组初始化的时候，每个slabclass_t都会分配一个1M大小的slab。
- 当某个slabclass_t结构上的内存不够的时候（freelist空闲列表为空），则会分配一个slab给这个slabclass_t结构。
- 一旦slab分配后，不可回收。
- slab会被切分为N个小的内存块，这个小的内存块的大小取决于slabclass_t结构上的size的大小。例如slabclass[0]上的size为103，则每个小的内存块大小为103byte。
- 这些被切割的小的内存块，主要用来存储item。但是，存储的item，可能会比切割出来的内存块会小。因为这是为了防止内存碎片，虽然有一些内存的浪费。

slabclass和slab、item以及free list之间的关系：

![image-20220309154836944](image-20220309154836944.png)

通过item的size来选择slab_class的数据存储空间：

![image-20220309154848562](image-20220309154848562.png)

## 二、slabs源码分析

### 1. 查询slabclass ID操作slabs_clsid

slabs_clsid方法，主要通过item的长度来查询应该适合存放到哪个slabsclass_t上面。

```c++
//通过item的size，选择当前的item适合放在哪个slab class中
unsigned int slabs_clsid(const size_t size) {
    int res = POWER_SMALLEST; //从id = 1开始查找
 
    //slabclass这个结构上的size会存储该class适合多大的item存储
    //例如
    //slabclass[0] 存储96byte
    //slabclass[1] 存储120byte
    //slabclass[2] 存储150byte
    //则，如果存储的item等于109byte，则存储在slabclass[1]上
    if (size == 0)
        return 0;
    while (size > slabclass[res].size)
        if (res++ == power_largest)     /* won't fit in the biggest slab */
            return 0;
    return res;
}
```

### 2. slabclass的初始化slabs_init

slabs_init方法主要用于初始化slabclass数组结构。

```c++
//slabclass初始化
void slabs_init(const size_t limit, const double factor, const bool prealloc) {
    int i = POWER_SMALLEST - 1;
    unsigned int size = sizeof(item) + settings.chunk_size;
 
    mem_limit = limit;
 
    //这边是否初始化的时候，就给每一个slabclass_t结构分配一个slab内存块
    //默认都会分配
    if (prealloc) {
        /* Allocate everything in a big chunk with malloc */
        mem_base = malloc(mem_limit);
        if (mem_base != NULL) {
            mem_current = mem_base;
            mem_avail = mem_limit;
        } else {
            fprintf(stderr, "Warning: Failed to allocate requested memory in"
                    " one large chunk.\nWill allocate in smaller chunks\n");
        }
    }
 
    memset(slabclass, 0, sizeof(slabclass));
    //factor 默认等于1.25 ，也就是说前一个slabclass允许存储96byte大小的数据，
    //则下一个slabclass可以存储120byte
    while (++i < POWER_LARGEST && size <= settings.item_size_max / factor) {
        /* Make sure items are always n-byte aligned */
        if (size % CHUNK_ALIGN_BYTES)
            size += CHUNK_ALIGN_BYTES - (size % CHUNK_ALIGN_BYTES);
 
        //每个slabclass[i]存储最大多大的item
        slabclass[i].size = size;
        slabclass[i].perslab = settings.item_size_max / slabclass[i].size;
        size *= factor;
        if (settings.verbose > 1) {
            fprintf(stderr, "slab class %3d: chunk size %9u perslab %7u\n",
                    i, slabclass[i].size, slabclass[i].perslab);
        }
    }
 
    power_largest = i;
    slabclass[power_largest].size = settings.item_size_max;
    slabclass[power_largest].perslab = 1;
    if (settings.verbose > 1) {
        fprintf(stderr, "slab class %3d: chunk size %9u perslab %7u\n",
                i, slabclass[i].size, slabclass[i].perslab);
    }
 
    /* for the test suite:  faking of how much we've already malloc'd */
    {
        char *t_initial_malloc = getenv("T_MEMD_INITIAL_MALLOC");
        if (t_initial_malloc) {
            mem_malloced = (size_t)atol(t_initial_malloc);
        }
 
    }
 
    if (prealloc) {
        slabs_preallocate(power_largest);
    }
}
```

```c++
//分配内存
static void slabs_preallocate (const unsigned int maxslabs) {
    int i;
    unsigned int prealloc = 0;
 
    /* pre-allocate a 1MB slab in every size class so people don't get
       confused by non-intuitive "SERVER_ERROR out of memory"
       messages.  this is the most common question on the mailing
       list.  if you really don't want this, you can rebuild without
       these three lines.  */
    //给每一个slabclass_t结构分配一个默认的slab
    for (i = POWER_SMALLEST; i <= POWER_LARGEST; i++) {
        if (++prealloc > maxslabs)
            return;
        if (do_slabs_newslab(i) == 0) {
            fprintf(stderr, "Error while preallocating slab memory!\n"
                "If using -L or other prealloc options, max memory must be "
                "at least %d megabytes.\n", power_largest);
            exit(1);
        }
    }
 
}
```

### 3. 分配一个item的操作do_slabs_alloc

- Memcached分配一个item，会先检查freelist空闲的列表中是否有空闲的item，如果有的话就用空闲列表中的item。
- 如果空闲列表没有空闲的item可以分配，则Memcached会去申请一个slab（默认大小为1M）的内存块，如果申请失败，则返回NULL，表明分配失败。
- 如果申请成功，则会去将这个1M大小的内存块，根据slabclass_t可以存储的最大的item的size，将slab切割成N个item，然后放进freelist（空闲列表中）
- 然后去freelist（空闲列表）中取出一个item来使用。

```c++
//分配一个Item
void *slabs_alloc(size_t size, unsigned int id) {
    void *ret;
    //分配Item前需要上线程锁
    pthread_mutex_lock(&slabs_lock);
    //size：需要分配的item的长度
    //id：需要分配在哪个slab class上面
    ret = do_slabs_alloc(size, id);
    pthread_mutex_unlock(&slabs_lock);
    return ret;
}
```

```c++
//分配一个Item
static void *do_slabs_alloc(const size_t size, unsigned int id) {
    slabclass_t *p;
    void *ret = NULL;
    item *it = NULL;
 
    if (id < POWER_SMALLEST || id > power_largest) {
        MEMCACHED_SLABS_ALLOCATE_FAILED(size, 0);
        return NULL;
    }
 
    //获取slabclass
    p = &slabclass[id];
    assert(p->sl_curr == 0 || ((item *)p->slots)->slabs_clsid == 0);
 
    /* fail unless we have space at the end of a recently allocated page,
       we have something on our freelist, or we could allocate a new page */
    //p->sl_curr 说明是否有空闲的item list
    //如果没有空闲的item list，则取分配一个新的slab，如果分配失败，返回NULL
    if (! (p->sl_curr != 0 || do_slabs_newslab(id) != 0)) {
        /* We don't have more memory available */
        ret = NULL;
    //如果有free item lits，则从空闲的列表中取一个Item
    } else if (p->sl_curr != 0) {
        /* return off our freelist */
        it = (item *)p->slots;
        p->slots = it->next;
        if (it->next) it->next->prev = 0;
        p->sl_curr--;
        ret = (void *)it;
    }
 
    if (ret) {
        p->requested += size;
        MEMCACHED_SLABS_ALLOCATE(size, id, p->size, ret);
    } else {
        MEMCACHED_SLABS_ALLOCATE_FAILED(size, id);
    }
 
    return ret;
}
```

分配一个新的slab：

```c++
//分配一块新的item块
static int do_slabs_newslab(const unsigned int id) {
	//获取slabclass
    slabclass_t *p = &slabclass[id];
    //分配一个slab，默认是1M
    //分配的slab也可以根据 该slabclass存储的item的大小 * 可以存储的item的个数 来计算出内存块长度
    int len = settings.slab_reassign ? settings.item_size_max
        : p->size * p->perslab;
    char *ptr;

    //这边回去分配一块slab内存块
    if ((mem_limit && mem_malloced + len > mem_limit && p->slabs > 0) ||
        (grow_slab_list(id) == 0) ||
        ((ptr = memory_allocate((size_t)len)) == 0)) {
     
        MEMCACHED_SLABS_SLABCLASS_ALLOCATE_FAILED(id);
        return 0;
    }
     
    //将slab内存内存块切割成N个item，放进freelist中
    memset(ptr, 0, (size_t)len);
    split_slab_page_into_freelist(ptr, id);
     
    p->slab_list[p->slabs++] = ptr;
    mem_malloced += len;
    MEMCACHED_SLABS_SLABCLASS_ALLOCATE(id);
     
    return 1;

}
```

将slab内存块进行切割：

```c++
//将slab 切割成N个item
static void split_slab_page_into_freelist(char *ptr, const unsigned int id) {
    slabclass_t *p = &slabclass[id];
    int x;
    for (x = 0; x < p->perslab; x++) {
        //将指针传递给ptr，free操作并不是真正意义上的释放内存块，只是将内存块放到free list（空闲列表上面）
        do_slabs_free(ptr, 0, id);
        //这边使用p->size，来设置每个item内存块的大小
        //实际存储的时候，item的size都会小于p->size
        ptr += p->size;
    }
}
```

### 4. 释放一个item的操作slabs_free

释放item后，会将item放进free list（空闲列表中）。

```c++
//释放一个Item
void slabs_free(void *ptr, size_t size, unsigned int id) {
    pthread_mutex_lock(&slabs_lock);
    //ptr：item的指针
    //size：item的大小
    //id：在哪个slab class上面
    do_slabs_free(ptr, size, id);
    pthread_mutex_unlock(&slabs_lock);
}
//释放一个item
static void do_slabs_free(void *ptr, const size_t size, unsigned int id) {
    slabclass_t *p;
    item *it;

    assert(((item *)ptr)->slabs_clsid == 0);
    assert(id >= POWER_SMALLEST && id <= power_largest);
    if (id < POWER_SMALLEST || id > power_largest)
        return;
     
    MEMCACHED_SLABS_FREE(size, id, ptr);
    p = &slabclass[id];
     
    it = (item *)ptr;
    it->it_flags |= ITEM_SLABBED;
    //放进空闲列表  freelist
    it->prev = 0;
    it->next = p->slots;
    if (it->next) it->next->prev = it;
    p->slots = it;
     
    p->sl_curr++;
    p->requested -= size;
    return;

}
```