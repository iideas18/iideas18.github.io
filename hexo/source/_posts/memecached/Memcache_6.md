---
title: "Memcached源码分析 - LRU算法（6）"
date: 2022-03-09 15:44:32
cover: "/2022/03/09/memecached/Memcache_6/image-20220309153756064.png"
slug: "Memcache_6"
categories:
  - "memecached"
---

# Memcached源码分析 - LRU算法（6）

## 一、前言

上一章《Memcached源码分析 - Memcached源码分析之增删改查操作（5） 》中，我们讲到了SET命令的操作。当客户端向Memcached服务端SET一条缓存数据的时候，会将生成的Item地址挂到LRU的链表结构上。这一章节，我们主要讲一下Memcached是如何使用LRU算法的。

LRU：是Least Recently Used 近期最少使用算法。

## 二、Memcached的LRU算法分析

### 1. Memcached的LRU几种策略

- **惰性删除**。memcached一般不会主动去清除已经过期或者失效的缓存，当get请求一个item的时候，才会去检查item是否失效。
- **flush命令**。flush命令会将所有的item设置为失效。
  创建的时候检查。Memcached会在创建ITEM的时候去LRU的链表尾部开始检查，是否有失效的ITEM，如果没有的话就重新创建。
- **LRU爬虫**。memcached默认是关闭LRU爬虫的。LRU爬虫是一个单独的线程，会去清理失效的ITEM。
- **LRU淘汰**。当缓存没有内存可以分配给新的元素的时候，memcached会从LRU链表的尾部开始淘汰一个ITEM，不管这个ITEM是否还在有效期都将会面临淘汰。LRU链表插入缓存ITEM的时候有先后顺序，所以淘汰一个ITEM也是从尾部进行 也就是先淘汰最早的ITEM。

![image-20220309153756064](image-20220309153756064.png)

### 2. LRU的基本操作和存储的数据结构

Mecached的LRU的链表操作主要在item.c这个文件上的。其中数组heads和tails分别存储不同的LRU的双向链表的头地址和尾部地址。

每个slabs class都会有自己的一个双向链表结构。链表结构主要通过item结构中的两个指针地址来记录item在链表上左右两边位置的item地址值。

```c++
//item的具体结构
typedef struct _stritem {
    //记录LRU双向链表下一个item的地址
    struct _stritem *next;  //下一个结构
    //记录LRU双向链表前一个Item的地址
    struct _stritem *prev;  //前一个结构
    //....more code

} item;
```
```c++
static item *heads[LARGEST_ID]; //存储头部地址
static item *tails[LARGEST_ID]; //存储尾部地址
```


item_link_q方法主要是将一个item添加到LRU链表上面

```c++
//从LRU链表上新增一个Item
//LRU链表是一个双向链表结构
static void item_link_q(item *it) { /* item is the new head */
    item **head, **tail;
    assert(it->slabs_clsid < LARGEST_ID);
    assert((it->it_flags & ITEM_SLABBED) == 0);
head = &heads[it->slabs_clsid];
tail = &tails[it->slabs_clsid];
assert(it != *head);
assert((*head && *tail) || (*head == 0 && *tail == 0));
it->prev = 0;
it->next = *head;
if (it->next) it->next->prev = it;
*head = it;
if (*tail == 0) *tail = it;
sizes[it->slabs_clsid]++;
return;
}
```

item_unlink_q方法主要是将一个item从LRU链表上面解除：

```c++
//从LRU链表上解除Item
static void item_unlink_q(item *it) {
    item **head, **tail;
    assert(it->slabs_clsid < LARGEST_ID);
    head = &heads[it->slabs_clsid];
    tail = &tails[it->slabs_clsid];
if (*head == it) {
    assert(it->prev == 0);
    *head = it->next;
}
if (*tail == it) {
    assert(it->next == 0);
    *tail = it->prev;
}
assert(it->next != it);
assert(it->prev != it);
 
if (it->next) it->next->prev = it->prev;
if (it->prev) it->prev->next = it->next;
sizes[it->slabs_clsid]--;
return;
}
```
### 3. 策略1 - 惰性删除

Memcached的缓存清除策略是惰性的。这个如何来理解？当用户设置了一个缓存数据，缓存有效期为5分钟。当5分钟时间过后，缓存失效，这个时候Memcached并不会自动去检查当前的Item是否过期。当客户端再次来请求这个数据的时候，才会去检查缓存是否失效了，如果失效则会去清除这个数据。

看一下do_item_get这个方法中，判断缓存数据是否失效的代码：

```c++
/** wrapper around assoc_find which does the lazy expiration logic */
item *do_item_get(const char *key, const size_t nkey, const uint32_t hv) {
//...code
    if (it != NULL) {
        //settings.oldest_live主要用来记录flush命令执行的时间
        //it->time用来记录item最近set/add/replce等操作的时间（get操作不会改变）
        //然后判断it->time是否在执行flush命令之前，如果是执行flush之前，说明该item已经失效
        if (settings.oldest_live != 0 && settings.oldest_live <= current_time &&
            it->time <= settings.oldest_live) {
            //LRU链表和HASHTABLE上解除绑定
            do_item_unlink(it, hv);
            //删除该Item
            do_item_remove(it);
            it = NULL; //返回NULL
            if (was_found) {
                fprintf(stderr, " -nuked by flush");
            }
        //检查是否过期，主要是检查有效期时间
        //如果数据已经过期，则需要清除
        } else if (it->exptime != 0 && it->exptime <= current_time) {
            //LRU链表和HASHTABLE上解除绑定
            do_item_unlink(it, hv);
            //删除该Item
            do_item_remove(it);
            it = NULL;
            if (was_found) {
                fprintf(stderr, " -nuked by expire");
            }
        } else {
            it->it_flags |= ITEM_FETCHED;
            DEBUG_REFCNT(it, '+');
        }
    }
//...code
}
```

### 4. 策略2 - flush命令

当用户发送一个flush命令的时候，Memcached会将命令之前的所有的缓存都设置为失效。

Memcached不会主动去清除这些item。主要通过两种方式：

#### 1. do_item_flush_expired方法。

Memcached会在接受到flush命令的时候，将设置全局参数settings.oldest_live =current_time - 1。然后去调用item_flush_expired方法。

因为设置全局参数item_flush_expired到调用缓存锁方法之间会有一定的时间差，有可能这个过程中，会有新的item在操作。

然后Memcached调用do_item_flush_expired方法，去遍历所有的LRU链表。do_item_flush_expired不会将每一个在flush命令前的Item删除，因为这样会非常耗时，而是删除在设置全局变量到加上缓存锁这之间操作的item。这样就能加快flush的速度。

#### 2. 惰性删除方法。

Memcached会在get操作的时候去判断it->time是否小于settings.oldest_live，如果小于，说明这个item就是过期的。通过这种方法，惰性删除大批量的item数据。

```c++
/*
Flushes expired items after a flush_all call
*/
void item_flush_expired() {
mutex_lock(&cache_lock);
do_item_flush_expired();
mutex_unlock(&cache_lock);
}
```

```c++
/* expires items that are more recent than the oldest_live setting. */
void do_item_flush_expired(void) {
    int i;
    item *iter, *next;
    if (settings.oldest_live == 0)
        return;
    for (i = 0; i < LARGEST_ID; i++) {
        /* The LRU is sorted in decreasing time order, and an item's timestamp
         * is never newer than its last access time, so we only need to walk
         * back until we hit an item older than the oldest_live time.
         * The oldest_live checking will auto-expire the remaining items.
         */
        for (iter = heads[i]; iter != NULL; iter = next) {
            /* iter->time of 0 are magic objects. */
        	//iter->time 最近一次的访问时间
        	//这边为何是iter->time >= settings.oldest_live？
        	//因为在执行do_item_flush_expired方法前，已经上了cache锁，其它worker是不能操作的
        	//这边过程中，如果遍历每一个Item都去删除，那么这个遍历过程会非常缓慢，会导致客户端一直等待。
        	//
        	//Memcached就想出了一个聪明的办法，从设置settings.oldest_live到上锁之间，还是会有其它客户端
        	//操作item数据，那么Memcache就将这一部分数据先清理（这部分数据非常少量），这样就能加快flush的速度
        	//而剩余iter->time < settings.oldest_live的那大批量的item，会通过惰性删除的方式，在get请求中去判断处理
            if (iter->time != 0 && iter->time >= settings.oldest_live) {
                next = iter->next;
                if ((iter->it_flags & ITEM_SLABBED) == 0) {
                    do_item_unlink_nolock(iter, hash(ITEM_key(iter), iter->nkey));
                }
            } else {
                /* We've hit the first old item. Continue to the next queue. */
                break;
            }
        }
    }
}
```

### 5. 策略3 - 分配Item的时候去检查

Memcached在分配一个新的Item。（这个流程有点绕，需要看N遍，才能明白）步骤如下：

先检查缓存存储空间大小。前几章我们讲到，memcached的命令中会将key的长度和value的长度带上，这样就可以计算出item总的占用空间的大小。
通过缓存item的存储空间大小，就可以找到slabs class和slabs class的LRU双向链表。
开始尝试分配内存，尝试次数为5次。
尝试分配内存的过程中，会从LRU链表的尾部开始搜索，检查ITEM状态，如果item内容为空或者item被其它worker引用锁定等情况，则继续往LRU列表尾部搜索。
如果尝试了5次，从LRU尾部搜索都没有找到符合预期的ITEM，则会slabs_alloc方法，申请创建一个新的内存块。
如果从LRU尾部搜索找到符合预期的ITEM（没有锁定和有数据），首先会检查ITEM是否已经过了有效期，如果已经过了有效期，则将这个ITEM淘汰，占用该ITEM。
如果ITEM还是有效的，则使用slabs_alloc分配一个新的ITEM，分配成功，则就用最新分配的ITEM
如果使用slabs_alloc分配一个新的ITEM，分配失败，则开启了不使用LRU强制淘汰，返回ERROR；如果开启了强制淘汰，会将当前LRU链表尾部搜索到的ITEM强制进行淘汰（如果ITEM有效期还在或者设置了永久的也会被淘汰）

```c++
//创建一个新的Item
item *do_item_alloc(char *key, const size_t nkey, const int flags,
                    const rel_time_t exptime, const int nbytes,
                    const uint32_t cur_hv) {
    uint8_t nsuffix;
    item *it = NULL; //item结构
    char suffix[40];
    //item_make_header 计算存储数据的总长度
    size_t ntotal = item_make_header(nkey + 1, flags, nbytes, suffix, &nsuffix);
    if (settings.use_cas) {
        ntotal += sizeof(uint64_t);
    }
 
    //通过ntotal 查询在哪个slabs_class上面
    //Memcached会根据存储数据长度的不同，分为N多个slabs_class
    //用户存储数据的时候，根据需要存储数据的长度，就可以查询到需要存储到哪个slabs_class中。
    //每个slabs_class都由诺干个slabs组成，slabs每个大小为1M，我们的item结构的数据就会被分配在slabs上
    //每个slabs都会根据自己slabs_class存储的数据块的大小，会被分割为诺干个chunk
    //
    //举个例子：
    //如果id=1的slabs_class为存储 最大为224个字节的缓存数据
    //当用户的设置的缓存数据总数据长度为200个字节，则这个item结构就会存储到id=1的slabs_class上。
    //当第一次或者slabs_class中的slabs不够用的时候，slabs_class就会去分配一个1M的slabs给存储item使用
    //因为id=1的slabs_class存储小于224个字节的数据，所以slabs会被分割为诺干个大小为224字节的chunk块
    //我们的item结构数据，就会存储在这个chunk块上面
    unsigned int id = slabs_clsid(ntotal);
    if (id == 0)
        return 0;
 
    mutex_lock(&cache_lock);
    /* do a quick check if we have any expired items in the tail.. */
    int tries = 5;
    /* Avoid hangs if a slab has nothing but refcounted stuff in it. */
    int tries_lrutail_reflocked = 1000;
    int tried_alloc = 0;
    item *search;
    item *next_it;
    void *hold_lock = NULL;
    rel_time_t oldest_live = settings.oldest_live;
 
    //这边就可以得到slabs_class上第一个item的地址
    //item数据结构通过item->next和item->prev 来记录链表结构
    //这边是寻找LRU 链表的尾部地址
    search = tails[id];
 
    /* We walk up *only* for locked items. Never searching for expired.
     * Waste of CPU for almost all deployments */
    //tries = 5 这边只尝试5次循环搜索
    //search = tails[id] 搜索从LRU链表 的尾部开始
    for (; tries > 0 && search != NULL; tries--, search=next_it) {
        /* we might relink search mid-loop, so search->prev isn't reliable */
        next_it = search->prev;
        if (search->nbytes == 0 && search->nkey == 0 && search->it_flags == 1) {
            /* We are a crawler, ignore it. */
            tries++;
            continue;
        }
        uint32_t hv = hash(ITEM_key(search), search->nkey);
        /* Attempt to hash item lock the "search" item. If locked, no
         * other callers can incr the refcount
         */
        /* Don't accidentally grab ourselves, or bail if we can't quicklock */
        if (hv == cur_hv || (hold_lock = item_trylock(hv)) == NULL)
            continue;
        /* Now see if the item is refcount locked */
 
        //一般情况下search->refcount为1，如果增加了refcount之后，不等于2，说明item被其它的worker线程锁定
        //refcount往上加1，是锁定当前的item，如果不等于2，说明锁定失败
        if (refcount_incr(&search->refcount) != 2) {
            /* Avoid pathological case with ref'ed items in tail */
            do_item_update_nolock(search);
            tries_lrutail_reflocked--;
            tries++; //try的次数+1
            refcount_decr(&search->refcount); //减去1
            itemstats[id].lrutail_reflocked++;
            /* Old rare bug could cause a refcount leak. We haven't seen
             * it in years, but we leave this code in to prevent failures
             * just in case */
            if (settings.tail_repair_time &&
                    search->time + settings.tail_repair_time < current_time) {
                itemstats[id].tailrepairs++;
                search->refcount = 1;
                do_item_unlink_nolock(search, hv);
            }
            if (hold_lock)
                item_trylock_unlock(hold_lock);
 
            if (tries_lrutail_reflocked < 1)
                break;
 
            continue;
        }
 
        /* Expired or flushed */
        //这边判断尾部的Item是否失效，如果已经失效了的话，将当前的失效的item分配给最新的缓存
        if ((search->exptime != 0 && search->exptime < current_time)
            || (search->time <= oldest_live && oldest_live <= current_time)) {
            itemstats[id].reclaimed++;
            if ((search->it_flags & ITEM_FETCHED) == 0) {
                itemstats[id].expired_unfetched++;
            }
            it = search;
            slabs_adjust_mem_requested(it->slabs_clsid, ITEM_ntotal(it), ntotal);
            do_item_unlink_nolock(it, hv);
            /* Iniialize the item block: */
            it->slabs_clsid = 0;
 
        //slabs_alloc方法是去分配一个新的内存块
        } else if ((it = slabs_alloc(ntotal, id)) == NULL) {
            tried_alloc = 1;
            //如果设置了不允许LRU淘汰，则返回ERROR
            if (settings.evict_to_free == 0) {
                itemstats[id].outofmemory++;
            } else {
            	//这边设置了LRU淘汰
            	//如果分配失败，则从LRU链表尾部，淘汰一个item
            	//如果这个item设置了有效期为0，也会被淘汰
                itemstats[id].evicted++;
                itemstats[id].evicted_time = current_time - search->time;
                if (search->exptime != 0)
                    itemstats[id].evicted_nonzero++;
                if ((search->it_flags & ITEM_FETCHED) == 0) {
                    itemstats[id].evicted_unfetched++;
                }
                //这边直接将LRU尾部的ITEM淘汰，并且给了最新的ITEM使用
                it = search;
                //重新计算一下这个slabclass_t分配出去的内存大小
                //直接霸占被淘汰的item就需要重新计算
                slabs_adjust_mem_requested(it->slabs_clsid, ITEM_ntotal(it), ntotal);
                //从哈希表和lru链表中删除
                //it->refcount的值为2，所以item不会被删除，只是HashTable和LRU上的链接关系
                do_item_unlink_nolock(it, hv);
                /* Initialize the item block: */
                it->slabs_clsid = 0;
 
                /* If we've just evicted an item, and the automover is set to
                 * angry bird mode, attempt to rip memory into this slab class.
                 * TODO: Move valid object detection into a function, and on a
                 * "successful" memory pull, look behind and see if the next alloc
                 * would be an eviction. Then kick off the slab mover before the
                 * eviction happens.
                 */
                if (settings.slab_automove == 2)
                    slabs_reassign(-1, id);
            }
        }
 
        //解除引用锁定
        refcount_decr(&search->refcount);
        /* If hash values were equal, we don't grab a second lock */
        if (hold_lock)
            item_trylock_unlock(hold_lock);
        break;
    }
 
    /* 如果分配了5次，结果LRU链表尾部的item都是被锁定的，则重新分配一个item */
    if (!tried_alloc && (tries == 0 || search == NULL))
        it = slabs_alloc(ntotal, id);
 
    if (it == NULL) {
        itemstats[id].outofmemory++;
        mutex_unlock(&cache_lock);
        return NULL;
    }
 
    assert(it->slabs_clsid == 0);
    assert(it != heads[id]);
 
    /* Item initialization can happen outside of the lock; the item's already
     * been removed from the slab LRU.
     */
    it->refcount = 1; //引用的次数 又设置为1   /* the caller will have a reference */
    mutex_unlock(&cache_lock);
    it->next = it->prev = it->h_next = 0;
    it->slabs_clsid = id;
 
    DEBUG_REFCNT(it, '*');
    it->it_flags = settings.use_cas ? ITEM_CAS : 0;
    it->nkey = nkey;
    it->nbytes = nbytes;
    //这边是内存拷贝，拷贝到item结构地址的内存块上
    memcpy(ITEM_key(it), key, nkey);
    it->exptime = exptime;
    //这边也是内存拷贝
    memcpy(ITEM_suffix(it), suffix, (size_t)nsuffix);
    it->nsuffix = nsuffix;
    return it;
}
```

### 6. 策略4 - LRU爬虫

Memcached的LRU爬虫默认是关闭的。
Memcached会开一个单独的线程对失效的缓存数据进行处理。
爬虫代码主要在item.c中，这边只看两个最重要的方法：

```c++
//LRU爬虫
static void *item_crawler_thread(void *arg) {
    int i;
 
    pthread_mutex_lock(&lru_crawler_lock);
    if (settings.verbose > 2)
        fprintf(stderr, "Starting LRU crawler background thread\n");
    while (do_run_lru_crawler_thread) {
    pthread_cond_wait(&lru_crawler_cond, &lru_crawler_lock);
 
    while (crawler_count) {
        item *search = NULL;
        void *hold_lock = NULL;
 
        for (i = 0; i < LARGEST_ID; i++) {
            if (crawlers[i].it_flags != 1) {
                continue;
            }
            pthread_mutex_lock(&cache_lock);
            search = crawler_crawl_q((item *)&crawlers[i]);
            if (search == NULL ||
                (crawlers[i].remaining && --crawlers[i].remaining < 1)) {
                if (settings.verbose > 2)
                    fprintf(stderr, "Nothing left to crawl for %d\n", i);
                crawlers[i].it_flags = 0;
                crawler_count--;
                crawler_unlink_q((item *)&crawlers[i]);
                pthread_mutex_unlock(&cache_lock);
                continue;
            }
            uint32_t hv = hash(ITEM_key(search), search->nkey);
            /* Attempt to hash item lock the "search" item. If locked, no
             * other callers can incr the refcount
             */
            if ((hold_lock = item_trylock(hv)) == NULL) {
                pthread_mutex_unlock(&cache_lock);
                continue;
            }
            /* Now see if the item is refcount locked */
            if (refcount_incr(&search->refcount) != 2) {
                refcount_decr(&search->refcount);
                if (hold_lock)
                    item_trylock_unlock(hold_lock);
                pthread_mutex_unlock(&cache_lock);
                continue;
            }
 
            /* Frees the item or decrements the refcount. */
            /* Interface for this could improve: do the free/decr here
             * instead? */
            item_crawler_evaluate(search, hv, i);
 
            if (hold_lock)
                item_trylock_unlock(hold_lock);
            pthread_mutex_unlock(&cache_lock);
 
            if (settings.lru_crawler_sleep)
                usleep(settings.lru_crawler_sleep);
        }
    }
    if (settings.verbose > 2)
        fprintf(stderr, "LRU crawler thread sleeping\n");
    STATS_LOCK();
    stats.lru_crawler_running = false;
    STATS_UNLOCK();
    }
    pthread_mutex_unlock(&lru_crawler_lock);
    if (settings.verbose > 2)
        fprintf(stderr, "LRU crawler thread stopping\n");
 
    return NULL;
}
 
 
int start_item_crawler_thread(void) {
    int ret;
 
    if (settings.lru_crawler)
        return -1;
    pthread_mutex_lock(&lru_crawler_lock);
    do_run_lru_crawler_thread = 1;
    settings.lru_crawler = true;
    if ((ret = pthread_create(&item_crawler_tid, NULL,
        item_crawler_thread, NULL)) != 0) {
        fprintf(stderr, "Can't create LRU crawler thread: %s\n",
            strerror(ret));
        pthread_mutex_unlock(&lru_crawler_lock);
        return -1;
    }
    pthread_mutex_unlock(&lru_crawler_lock);
 
    return 0;
}
```