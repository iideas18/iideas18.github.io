---
title: "Memcached源码分析 - 增删改查操作的实现"
date: 2022-03-09 15:35:25
slug: "Memcache_5"
categories:
  - "memecached"
---

# Memcached源码分析 - 增删改查操作的实现

## 一、前言

在第二章《Memcached源码分析 - Memcached源码分析之命令解析（2）》 和第三章《Memcached源码分析 - Memcached源码分析之消息回应（3）》 中我们主要通过Memcached的get命令，分析了Memcached的命令解析和消息回应的模块功能。这一章，我们主要来详细看一下Memcached常用的增删改查操作。

在看Memcached的增删改查操作前，我们先来看一下process_command方法。Memcached解析命令之后，就通过process_command方法将不同操作类型的命令进行分发。

```c++
//命令处理函数
//前一个方法中，我们找到了rbuf中\n的字符，然后将其替换成\0
static void process_command(conn *c, char *command) {
//tokens结构，这边会将c->rcurr（command）命令拆分出来
//并且将命令通过空格符号来分隔成多个元素
//例如：set username zhuli,则会拆分成3个元素，分别是set和username和zhuli
//MAX_TOKENS最大值为8，说明memcached的命令行，最多可以拆分成8个元素
token_t tokens[MAX_TOKENS];
size_t ntokens;
int comm;
 
assert(c != NULL);
 
MEMCACHED_PROCESS_COMMAND_START(c->sfd, c->rcurr, c->rbytes);
 
if (settings.verbose > 1)
	fprintf(stderr, "<%d %s\n", c->sfd, command);
 
/*
 * for commands set/add/replace, we build an item and read the data
 * directly into it, then continue in nread_complete().
 */
 
c->msgcurr = 0;
c->msgused = 0;
c->iovused = 0;
if (add_msghdr(c) != 0) {
	out_of_memory(c, "SERVER_ERROR out of memory preparing response");
	return;
}
 
//tokenize_command非常重要，主要就是拆分命令的
//并且将拆分出来的命令元素放进tokens的数组中
//参数:command为命令
ntokens = tokenize_command(command, tokens, MAX_TOKENS);
 
//tokens[COMMAND_TOKEN] COMMAND_TOKEN=0
//分解出来的命令的第一个参数为操作方法
if (ntokens >= 3
		&& ((strcmp(tokens[COMMAND_TOKEN].value, "get") == 0)
				|| (strcmp(tokens[COMMAND_TOKEN].value, "bget") == 0))) {
 
	//处理get命令
	process_get_command(c, tokens, ntokens, false);
 
} else if ((ntokens == 6 || ntokens == 7)
		&& ((strcmp(tokens[COMMAND_TOKEN].value, "add") == 0 && (comm =
				NREAD_ADD))
				|| (strcmp(tokens[COMMAND_TOKEN].value, "set") == 0
						&& (comm = NREAD_SET))
				|| (strcmp(tokens[COMMAND_TOKEN].value, "replace") == 0
						&& (comm = NREAD_REPLACE))
				|| (strcmp(tokens[COMMAND_TOKEN].value, "prepend") == 0
						&& (comm = NREAD_PREPEND))
				|| (strcmp(tokens[COMMAND_TOKEN].value, "append") == 0
						&& (comm = NREAD_APPEND)))) {
 
	//处理更新命令 add/set/replace/prepend/append
	process_update_command(c, tokens, ntokens, comm, false);
 
} else if ((ntokens == 7 || ntokens == 8)
		&& (strcmp(tokens[COMMAND_TOKEN].value, "cas") == 0 && (comm =
				NREAD_CAS))) {
 
	process_update_command(c, tokens, ntokens, comm, true);
 
} else if ((ntokens == 4 || ntokens == 5)
		&& (strcmp(tokens[COMMAND_TOKEN].value, "incr") == 0)) {
 
	process_arithmetic_command(c, tokens, ntokens, 1);
 
} else if (ntokens >= 3
		&& (strcmp(tokens[COMMAND_TOKEN].value, "gets") == 0)) {
 
	process_get_command(c, tokens, ntokens, true);
 
} else if ((ntokens == 4 || ntokens == 5)
		&& (strcmp(tokens[COMMAND_TOKEN].value, "decr") == 0)) {
 
	process_arithmetic_command(c, tokens, ntokens, 0);
 
} else if (ntokens >= 3 && ntokens <= 5
		&& (strcmp(tokens[COMMAND_TOKEN].value, "delete") == 0)) {
 
	//处理删除命令 delete
	process_delete_command(c, tokens, ntokens);
 
} else if ((ntokens == 4 || ntokens == 5)
		&& (strcmp(tokens[COMMAND_TOKEN].value, "touch") == 0)) {
 
	process_touch_command(c, tokens, ntokens);
 
} else if (ntokens >= 2
		&& (strcmp(tokens[COMMAND_TOKEN].value, "stats") == 0)) {
 
	//获取状态的命令
	process_stat(c, tokens, ntokens);
//.....more code
}
```
## 二、Memcached的增删改查操作源码分析

### 1. 增/改 set add replace 操作

我们看一个Memcached的命令行的set操作命令：

```shell
set key flags exptime vlen
value
```


set：操作方法名称
key：缓存的key
flags：缓存标识
exptime：缓存时间，0 - 不过期
vlen：缓存value的长度
value：缓存的值，一般会在第二行。
例子：

```shell
set username 0 10 9
woshishen
```


我们在第二章《Linux c 开发 - Memcached源码分析之命令解析（2）》中讲解到了如何解析命令的。Memcached一般会通过\n符号去分隔每个命令行语句，然后通过空格将一行命令切割成N个元素，元素会放进一个tokens的数组中。

这边我们可以看到，set命令会分层两部分：命令行部分和Value值部分：

1. Memcached会先去解析命令行部分，并且命令行部分中带上了vlen，就可以知道value的长度，然后就会去初始化一个Item的数据结构，用于存放缓存数据。

2. 命令行部分解析完毕，Memcached会去继续读取Socket中的剩余数据报文，边读取边复制到Item的数据结构中，直到读取到的Value数据长度和命令行中的vlen长度一致的时候才会结束。然后会去存储item，如果item存储成功，则会将item挂到HashTable和LRU链上面；如果存储失败，则会删除item。


下面我们先看一下process_update_command这个方法，这个方法主要作用：

- 帮助解析命令行部分

- 分配一个Item数据结构用于存储数据。

该方法结束后，会跳转到状态机drive_machine中conn_nread的代码块。conn_nread主要是用于读取value数据。

```c++
/*********************************
新增、编辑操作
看一个set操作的命令
命令：
set key flags exptime vlen
value
其中vlen为缓存数据长度
flages 为标志
exptime为过期时间，0 不过期
value 为需要缓存的数据，value一般都会在第二行
例如
set username 0 10 9
woshishen
**************************************/
static void process_update_command(conn *c, token_t *tokens,
		const size_t ntokens, int comm, bool handle_cas) {
	char *key; //key
	size_t nkey; //key的长度
	unsigned int flags; //命令标志
	int32_t exptime_int = 0;
	time_t exptime; //有效期
	int vlen; //value的缓存数据长度
	uint64_t req_cas_id = 0;
	//item结构，Memcached的key/value等值都是存储在item的数据结构中
	//item的分配在slabclass上的
	item *it;
assert(c != NULL);
 
set_noreply_maybe(c, tokens, ntokens);
//检查 key的长度，key最大长度250个字节
if (tokens[KEY_TOKEN].length > KEY_MAX_LENGTH) {
	out_string(c, "CLIENT_ERROR bad command line format");
	return;
}
 
//获取key的值和key的长度
//tokens[0]为操作命令
key = tokens[KEY_TOKEN].value; //获取key的值
nkey = tokens[KEY_TOKEN].length; //key的长度
 
//检查参数的合法性
if (!(safe_strtoul(tokens[2].value, (uint32_t *) &flags)
		&& safe_strtol(tokens[3].value, &exptime_int)
		&& safe_strtol(tokens[4].value, (int32_t *) &vlen))) {
	out_string(c, "CLIENT_ERROR bad command line format");
	return;
}
 
/* Ubuntu 8.04 breaks when I pass exptime to safe_strtol */
exptime = exptime_int;
 
/* Negative exptimes can underflow and end up immortal. realtime() will
 immediately expire values that are greater than REALTIME_MAXDELTA, but less
 than process_started, so lets aim for that. */
if (exptime < 0)
	exptime = REALTIME_MAXDELTA + 1;
 
// does cas value exist?
if (handle_cas) {
	if (!safe_strtoull(tokens[5].value, &req_cas_id)) {
		out_string(c, "CLIENT_ERROR bad command line format");
		return;
	}
}
 
//这边为何vlen要+2呢？
//因为value存储的时候，每次在数据结尾都会加上/r/n
//加上/r/n后，客户端获取数据就可以通过\r\n来分割 数据报文
vlen += 2;
if (vlen < 0 || vlen - 2 < 0) {
	out_string(c, "CLIENT_ERROR bad command line format");
	return;
}
 
if (settings.detail_enabled) {
	stats_prefix_record_set(key, nkey);
}
 
//item_alloc是最核心的方法，item_alloc主要就是去分配一个item
//结构用于存储需要缓存的信息
//key：缓存的key
//nkey：缓存的长度
//flags:标识
//exptime：过期时间
//vlen：缓存value的长度
//这边你可能有疑问了？为何这边只传递了vlen，缓存数据的字节长度，而没有value的值呢？
//1. 因为set/add/replace等这些命令，会将命令行和数据行分为两行传输
//2. 而我们首选会去解析命令行，命令行中需要包括缓存数据value的长度，这样我们就可以根据长度去预先分配内存空间
//3. 然后我们继续取解析数据行。因为缓存的数据一般都比较长，TCP发送会有粘包和拆包的情况，需要接收多次后才能接收到
//完整的数据，所以会在命令行中先传递一个value的长度值，这样就可以在解析命令行的过程中预先分配存储的空间，等接收完
//value的数据后，存储到内存空间即可。
//4. 此函数最后一行：conn_set_state(c, conn_nread); 就是跳转到conn_nread这个状态中，而conn_nread
//就是用来读取value的缓存数据的
it = item_alloc(key, nkey, flags, realtime(exptime), vlen);
 
//分配失败的情况
if (it == 0) {
	if (!item_size_ok(nkey, flags, vlen))
		out_string(c, "SERVER_ERROR object too large for cache");
	else
		out_of_memory(c, "SERVER_ERROR out of memory storing object");
	/* swallow the data line */
	c->write_and_go = conn_swallow;
	c->sbytes = vlen;
 
	/* Avoid stale data persisting in cache because we failed alloc.
	 * Unacceptable for SET. Anywhere else too? */
	if (comm == NREAD_SET) {
		it = item_get(key, nkey);
		if (it) {
			item_unlink(it);
			item_remove(it);
		}
	}
 
	return;
}
ITEM_set_cas(it, req_cas_id);
 
c->item = it;
c->ritem = ITEM_data(it); //value存储的指针地址
c->rlbytes = it->nbytes; //value的长度
c->cmd = comm;
//状态跳转到conn_nread，继续循环读取缓存的value数据
conn_set_state(c, conn_nread);
}
```

看一下item_alloc方法，主要作用：

- 分配一块可以用的Item内存块，用于存储缓存数据。
- Memcached是通过存储数据的长度选择合适的slab class，然后在该slabs class上分配一块item。
  先看一下Item的数据结构。

```c++
//item的具体结构
typedef struct _stritem {
    //链表结构：记录下一个item的地址
    struct _stritem *next;  //下一个结构
    //链表结构：记录前一个Item的地址
    struct _stritem *prev;  //前一个结构
    struct _stritem *h_next; //hashtable的list   /* hash chain next */
    //最近一次的访问时间
    rel_time_t      time;       /* least recent access */
    //过期时间
    rel_time_t      exptime;    /* expire time */
    //value数据大小
    int             nbytes;     /* size of data */
    unsigned short  refcount;
    uint8_t         nsuffix;    /* length of flags-and-length string */
    uint8_t         it_flags;   /* ITEM_* above */
    //slab class的ID，在哪个slab class上
    uint8_t         slabs_clsid;/* which slab class we're in */
    uint8_t         nkey;       /* key length, w/terminating null and padding */
    /* this odd type prevents type-punning issues when we do
     * the little shuffle to save space when not using CAS. */
    //存储数据的
    union {
        uint64_t cas;
        char end;
    } data[];
    /* if it_flags & ITEM_CAS we have 8 bytes CAS */
    /* then null-terminated key */
    /* then " flags length\r\n" (no terminating null) */
    /* then data with terminating \r\n (no terminating null; it's binary!) */
} item;
/*
```


```c++
Allocates a new item.
*/
//分配一个新的Item
item *item_alloc(char *key, size_t nkey, int flags, rel_time_t exptime, int nbytes) {
item *it;
/* do_item_alloc handles its own locks */
it = do_item_alloc(key, nkey, flags, exptime, nbytes, 0);
return it;
}
```



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
search = tails[id];
/* We walk up *only* for locked items. Never searching for expired.

Waste of CPU for almost all deployments */
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

other callers can incr the refcount
*/
 /* Don't accidentally grab ourselves, or bail if we can't quicklock */
 if (hv == cur_hv || (hold_lock = item_trylock(hv)) == NULL)
 continue;
 /* Now see if the item is refcount locked */
 if (refcount_incr(&search->refcount) != 2) {
 /* Avoid pathological case with ref'ed items in tail */
 do_item_update_nolock(search);
 tries_lrutail_reflocked--;
 tries++;
 refcount_decr(&search->refcount);
 itemstats[id].lrutail_reflocked++;
 /* Old rare bug could cause a refcount leak. We haven't seen

it in years, but we leave this code in to prevent failures

just in case */
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
 if ((search->exptime != 0 && search->exptime < current_time)
     || (search->time <= oldest_live && oldest_live <= current_time)) {
     itemstats[id].reclaimed++;
     if ((search->it_flags & ITEM_FETCHED) == 0) {
         itemstats[id].expired_unfetched++;
     }
     it = search;
     slabs_adjust_mem_requested(it->slabs_clsid, ITEM_ntotal(it), ntotal);
     do_item_unlink_nolock(it, hv);
     /* Initialize the item block: */
     it->slabs_clsid = 0;
 //slabs_alloc方法是去分配一个新的内存块
 } else if ((it = slabs_alloc(ntotal, id)) == NULL) {
     tried_alloc = 1;
     if (settings.evict_to_free == 0) {
         itemstats[id].outofmemory++;
     } else {
         itemstats[id].evicted++;
         itemstats[id].evicted_time = current_time - search->time;
         if (search->exptime != 0)
             itemstats[id].evicted_nonzero++;
         if ((search->it_flags & ITEM_FETCHED) == 0) {
             itemstats[id].evicted_unfetched++;
         }
         it = search;
         slabs_adjust_mem_requested(it->slabs_clsid, ITEM_ntotal(it), ntotal);
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

 refcount_decr(&search->refcount);
 /* If hash values were equal, we don't grab a second lock */
 if (hold_lock)
     item_trylock_unlock(hold_lock);
 break;
}

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

been removed from the slab LRU.
*/
it->refcount = 1;     /* the caller will have a reference */
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

然后我们看一下状态机drive_machine中conn_nread的代码块，这段代码主要作用：

- 读取缓存的value值
- 将数据拷贝到item数据结构。

```c++
		//conn_nread 主要用于读取缓存的value数据报文
		case conn_nread:
			//缓存 value数据报文的长度为0的时候，说明已经读取完成了
			if (c->rlbytes == 0) {
				complete_nread(c);
				break;
			}
		/* Check if rbytes < 0, to prevent crash */
		//失败的情况，关闭连接
		if (c->rlbytes < 0) {
			if (settings.verbose) {
				fprintf(stderr, "Invalid rlbytes to read: len %d\n",
						c->rlbytes);
			}
			conn_set_state(c, conn_closing);
			break;
		}
 
		/* first check if we have leftovers in the conn_read buffer */
		//c->rbytes 未解析的数据报文长度
		//c->rlbytes 缓存value数据报文长度
		//如果有为解析的数据报文，则处理
		if (c->rbytes > 0) {
			//总共需要拷贝的数据，我们的目的是拷贝c->rlbytes长度的数据
			//如果c->rbytes 大于 c->rlbytes 说明命令行未解析容器中待处理的数据大于value数据报文的长度
			//如果c->rbytes 小于 c->rlbytes 说明我们只接收到了一部分的value数据，另外一部分数据报文还在路上
			int tocopy = c->rbytes > c->rlbytes ? c->rlbytes : c->rbytes;
			//c->ritem 就是这次set/add/replace操作的数据存储value的指针地址
			if (c->ritem != c->rcurr) {
				memmove(c->ritem, c->rcurr, tocopy);
			}
			c->ritem += tocopy; //指针地址往上加
			c->rlbytes -= tocopy; //总的需要读取的value值的数据报文长度 减去已经拷贝的长度
			c->rcurr += tocopy; //改变指针地址
			c->rbytes -= tocopy; //未解析的数据报文 减去 已经处理的数据报文
 
			//如果c->rlbytes为0，说明value值已经读取完了，则跳出
			if (c->rlbytes == 0) {
				break;
			}
		}
 
		/*  now try reading from the socket */
		//这边是真正的读取方法
		//从socket中读取数据，读取到c->ritem数据value存储的指针，并且读取长度为c->rlbytes
		//这边就会进入循环读取，直到value的数据报文读取完整为止
		res = read(c->sfd, c->ritem, c->rlbytes);
		if (res > 0) {
			pthread_mutex_lock(&c->thread->stats.mutex);
			c->thread->stats.bytes_read += res;
			pthread_mutex_unlock(&c->thread->stats.mutex);
			if (c->rcurr == c->ritem) {
				c->rcurr += res;
			}
			c->ritem += res;
			c->rlbytes -= res;
			break;
		}
		//如果流关闭，则关闭连接
		if (res == 0) { /* end of stream */
			conn_set_state(c, conn_closing);
			break;
		}
		//如果连接被关闭，或者出现错误
		if (res == -1 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
			if (!update_event(c, EV_READ | EV_PERSIST)) {
				if (settings.verbose > 0)
					fprintf(stderr, "Couldn't update event\n");
				conn_set_state(c, conn_closing);
				break;
			}
			stop = true;
			break;
		}
		/* otherwise we have a real error, on which we close the connection */
		if (settings.verbose > 0) {
			fprintf(stderr, "Failed to read, and not due to blocking:\n"
					"errno: %d %s \n"
					"rcurr=%lx ritem=%lx rbuf=%lx rlbytes=%d rsize=%d\n", errno,
					strerror(errno), (long) c->rcurr, (long) c->ritem,
					(long) c->rbuf, (int) c->rlbytes, (int) c->rsize);
		}
		//调用Socket关闭
		conn_set_state(c, conn_closing);
		break;
```
这边如果读取完成了，会调用complete_nread(c)这个方法。这个方法往下一直看，我们找到complete_nread_ascii，这个方法主要作用：

- 调用存储数据store_item的方法
- 调用item_remove删除item的方法。

```c++
static void complete_nread_ascii(conn *c) {
	assert(c != NULL);
item *it = c->item;
int comm = c->cmd;
enum store_item_type ret;
 
pthread_mutex_lock(&c->thread->stats.mutex);
c->thread->stats.slab_stats[it->slabs_clsid].set_cmds++;
pthread_mutex_unlock(&c->thread->stats.mutex);
 
if (strncmp(ITEM_data(it) + it->nbytes - 2, "\r\n", 2) != 0) {
	out_string(c, "CLIENT_ERROR bad data chunk");
} else {
	//这边调用存储Item的方法
	ret = store_item(it, comm, c);
	//....
switch (ret) {
	case STORED:
		out_string(c, "STORED");
		break;
	case EXISTS:
		out_string(c, "EXISTS");
		break;
	case NOT_FOUND:
		out_string(c, "NOT_FOUND");
		break;
	case NOT_STORED:
		out_string(c, "NOT_STORED");
		break;
	default:
		out_string(c, "SERVER_ERROR Unhandled storage type.");
	}
 
}
 
//这边竟然删除这个Item？你不觉得奇怪么？
//我们知道删除item是需要通过判断item->refcount,引用的次数
//我们在alloc一个item的时候，refcount会默认设置为1
//
//当我们调用store_item，add/set/replace/prepend/append等操作成功的时候，会调用do_item_link
//这个方法，这个方法会将refcount设置为2，则再次去删除item的时候判断引用次数
//if (refcount_decr(&it->refcount) == 0) 就不会被删除
//
//如果我们调用store_item，发现存储失败了，这个时候因为引用次数为1，而且我们的确需要删除这个item，则删除这个item
//
//很绕的逻辑，但是很巧妙
item_remove(c->item); /* release the c->item reference */
c->item = 0;
}
```

然后我们看一下非常重要的do_store_item方法。这个方法主要是用来存储数据。基本包括两种状态：存储成功和存储失败。

- add/replace命令，会判断item是否存在，如果已经存在，则add命令操作失败
- set命令，item存在或者不存在，都会创建新的item，替换老的item。

```c++
//存储Item操作
enum store_item_type do_store_item(item *it, int comm, conn *c,
		const uint32_t hv) {
	char *key = ITEM_key(it);
//通过KEY找到旧的item
//add/set/replace/prepend/append等都会先创建一个新的item
item *old_it = do_item_get(key, it->nkey, hv);
enum store_item_type stored = NOT_STORED;
 
item *new_it = NULL;
int flags;
 
//ADD操作，要保证ITEM不存在的情况下才能成功
//如果ADD操作，发现item已经存在，则返回NOT_STORED
if (old_it != NULL && comm == NREAD_ADD) {
	/* add only adds a nonexistent item, but promote to head of LRU */
	//这边为何要更新item，有两个原因：
	//1.更新当前item的it->time时间，并且重建LRU链的顺序
	//2.这边代码后边会去执行do_item_remove操作，每次remove操作都会判断it->refcount
	//如果引用次数减去1，则需要被删除。这边重建LRU链之后，it->refcount=2，所有old_it不会被删除
	do_item_update(old_it);
 
//replace/prepend/append 等操作，是需要item已经存在的情况下操作做处理
//如果item不存在，则返回NOT_STORED
} else if (!old_it
		&& (comm == NREAD_REPLACE || comm == NREAD_APPEND
				|| comm == NREAD_PREPEND)) {
	/* replace only replaces an existing value; don't store */
} else if (comm == NREAD_CAS) {
	/* validate cas operation */
	if (old_it == NULL) {
		// LRU expired
		stored = NOT_FOUND;
		pthread_mutex_lock(&c->thread->stats.mutex);
		c->thread->stats.cas_misses++;
		pthread_mutex_unlock(&c->thread->stats.mutex);
	} else if (ITEM_get_cas(it) == ITEM_get_cas(old_it)) {
		// cas validates
		// it and old_it may belong to different classes.
		// I'm updating the stats for the one that's getting pushed out
		pthread_mutex_lock(&c->thread->stats.mutex);
		c->thread->stats.slab_stats[old_it->slabs_clsid].cas_hits++;
		pthread_mutex_unlock(&c->thread->stats.mutex);
 
		item_replace(old_it, it, hv);
		stored = STORED;
	} else {
		pthread_mutex_lock(&c->thread->stats.mutex);
		c->thread->stats.slab_stats[old_it->slabs_clsid].cas_badval++;
		pthread_mutex_unlock(&c->thread->stats.mutex);
 
		if (settings.verbose > 1) {
			fprintf(stderr, "CAS:  failure: expected %llu, got %llu\n",
					(unsigned long long) ITEM_get_cas(old_it),
					(unsigned long long) ITEM_get_cas(it));
		}
		stored = EXISTS;
	}
} else {
	/*
	 * Append - combine new and old record into single one. Here it's
	 * atomic and thread-safe.
	 */
	//这边是在老的item结构上面追加数据 append和prepend操作
	if (comm == NREAD_APPEND || comm == NREAD_PREPEND) {
		/*
		 * Validate CAS
		 */
		if (ITEM_get_cas(it) != 0) {
			// CAS much be equal
			if (ITEM_get_cas(it) != ITEM_get_cas(old_it)) {
				stored = EXISTS;
			}
		}
 
		if (stored == NOT_STORED) {
			/* we have it and old_it here - alloc memory to hold both */
			/* flags was already lost - so recover them from ITEM_suffix(it) */
 
			flags = (int) strtol(ITEM_suffix(old_it), (char **) NULL, 10);
 
			new_it = do_item_alloc(key, it->nkey, flags, old_it->exptime,
					it->nbytes + old_it->nbytes - 2 /* CRLF */, hv);
 
			if (new_it == NULL) {
				/* SERVER_ERROR out of memory */
				if (old_it != NULL)
					do_item_remove(old_it);
 
				return NOT_STORED;
			}
 
			/* copy data from it and old_it to new_it */
 
			if (comm == NREAD_APPEND) {
				memcpy(ITEM_data(new_it), ITEM_data(old_it),
						old_it->nbytes);
				memcpy(ITEM_data(new_it) + old_it->nbytes - 2 /* CRLF */,
						ITEM_data(it), it->nbytes);
			} else {
				/* NREAD_PREPEND */
				memcpy(ITEM_data(new_it), ITEM_data(it), it->nbytes);
				memcpy(ITEM_data(new_it) + it->nbytes - 2 /* CRLF */,
						ITEM_data(old_it), old_it->nbytes);
			}
 
			it = new_it;
		}
	}
 
	//这边是add/set/replace/prepend/append等操作
	if (stored == NOT_STORED) {
		if (old_it != NULL)
			//替换操作，old_it会被删除
			//it会被添加到LRU链和HASHTABLE上面，并且it->refcount=2
			item_replace(old_it, it, hv);
		else
			//将新的item添加的LRU链表和HASHTABLE上面，it->refcount=2
			do_item_link(it, hv);
 
		c->cas = ITEM_get_cas(it);
 
		stored = STORED;
	}
	//说明：
	//这边代码注解中为何一次又一次提到it->refcount?
	//1. 因为it->refcount代表的是引用次数，防止不同线程删除item
	//2. do_item_remove操作前会去判断it->refcount减一后，变成0，则会删除这个ITEM
	//
	//在调用do_store_item方法之后，memcached会去调用do_item_remove(it);的操作。
	//do_item_remove操作主要是将item生成后，结果SET/ADD等操作失败的情况，会去将已经分配好的item删除
	//如果SET和ADD操作成功，一般都会调用do_item_link这个方法会将item的refcount值加上1，变成2，当
	//再次调用do_item_remove(it);操作的时候，因为引用次数大于0而不会被删除
	//这边的代码块，真心很绕.....
}
 
//如果老的item存在，则需要删除
if (old_it != NULL)
	do_item_remove(old_it); /* release our reference */
//new_it主要用于prepend/append操作
if (new_it != NULL)
	do_item_remove(new_it);
 
if (stored == STORED) {
	c->cas = ITEM_get_cas(it);
}
 
return stored;
}
```

在do_store_item方法中，我们最终会找到do_item_link这个方法，这个方法主要作用：

- 将item挂到Hashtable上面
- 将item挂到LRU链上面

HashTable：把Item挂到HashTable上去后，用户就可以通过缓存的key到HashTable上查询这个Item数据了。

LRU：是一个清除缓存的策略，一般会清理最不常用的元素。LRU的链，会放在下面两个Item指针地址的数组链表上面。

```c++
static item *heads[LARGEST_ID]; //存储链表头部地址
static item *tails[LARGEST_ID]; //存储链表尾部地址
```


看一下do_item_link这个方法

```c++
//新增一个Item的连接关系
int do_item_link(item *it, const uint32_t hv) {
    MEMCACHED_ITEM_LINK(ITEM_key(it), it->nkey, it->nbytes);
    assert((it->it_flags & (ITEM_LINKED|ITEM_SLABBED)) == 0);
    mutex_lock(&cache_lock);
    it->it_flags |= ITEM_LINKED;
    it->time = current_time;
STATS_LOCK();
stats.curr_bytes += ITEM_ntotal(it);
stats.curr_items += 1;
stats.total_items += 1;
STATS_UNLOCK();
 
/* Allocate a new CAS ID on link. */
ITEM_set_cas(it, (settings.use_cas) ? get_cas_id() : 0);
//分配到HashTable的桶上
assoc_insert(it, hv);
//LRU链
item_link_q(it);
refcount_incr(&it->refcount); //引用次数+1
mutex_unlock(&cache_lock);
 
return 1;
}
```
### 2. 查询 get 操作

查询操作主要看下process_get_command方法，该方法主要作用：

- 分解get命令。
- 通过key去HashTable上找到item的地址值。
- 返回找到的item数据值。

```c++
/* ntokens is overwritten here... shrug.. */
//处理GET请求的命令
static inline void process_get_command(conn *c, token_t *tokens, size_t ntokens,
		bool return_cas) {
	//处理GET命令
	char *key;
	size_t nkey;
	int i = 0;
	item *it;
	//&tokens[0] 是操作的方法
	//&tokens[1] 为key
	//token_t 存储了value和length
	token_t *key_token = &tokens[KEY_TOKEN];
	char *suffix;
	assert(c != NULL);
do {
	//如果key的长度不为0
	while (key_token->length != 0) {
 
		key = key_token->value;
		nkey = key_token->length;
 
		//判断key的长度是否超过了最大的长度，memcache key的最大长度为250
		//这个地方需要非常注意，我们在平常的使用中，还是要注意key的字节长度的
		if (nkey > KEY_MAX_LENGTH) {
			//out_string 向外部输出数据
			out_string(c, "CLIENT_ERROR bad command line format");
			while (i-- > 0) {
				item_remove(*(c->ilist + i));
			}
			return;
		}
		//这边是从Memcached的内存存储快中去取数据
		it = item_get(key, nkey);
		if (settings.detail_enabled) {
			//状态记录，key的记录数的方法
			stats_prefix_record_get(key, nkey, NULL != it);
		}
		//如果获取到了数据
		if (it) {
			//c->ilist 存放用于向外部写数据的buf
			//如果ilist太小，则重新分配一块内存
			if (i >= c->isize) {
				item **new_list = realloc(c->ilist,
						sizeof(item *) * c->isize * 2);
				if (new_list) {
					//存放需要向客户端写数据的item的列表的长度
					c->isize *= 2;
					//存放需要向客户端写数据的item的列表，这边支持
					c->ilist = new_list;
				} else {
					STATS_LOCK();
					stats.malloc_fails++;
					STATS_UNLOCK();
					item_remove(it);
					break;
				}
			}
 
			/*
			 * Construct the response. Each hit adds three elements to the
			 * outgoing data list:
			 *   "VALUE "
			 *   key
			 *   " " + flags + " " + data length + "\r\n" + data (with \r\n)
			 */
			//初始化返回出去的数据结构
			if (return_cas) {
				MEMCACHED_COMMAND_GET(c->sfd, ITEM_key(it), it->nkey,
						it->nbytes, ITEM_get_cas(it));
				/* Goofy mid-flight realloc. */
				if (i >= c->suffixsize) {
					char **new_suffix_list = realloc(c->suffixlist,
							sizeof(char *) * c->suffixsize * 2);
					if (new_suffix_list) {
						c->suffixsize *= 2;
						c->suffixlist = new_suffix_list;
					} else {
						STATS_LOCK();
						stats.malloc_fails++;
						STATS_UNLOCK();
						item_remove(it);
						break;
					}
				}
 
				suffix = cache_alloc(c->thread->suffix_cache);
				if (suffix == NULL) {
					STATS_LOCK();
					stats.malloc_fails++;
					STATS_UNLOCK();
					out_of_memory(c,
							"SERVER_ERROR out of memory making CAS suffix");
					item_remove(it);
					while (i-- > 0) {
						item_remove(*(c->ilist + i));
					}
					return;
				}
				*(c->suffixlist + i) = suffix;
				int suffix_len = snprintf(suffix, SUFFIX_SIZE, " %llu\r\n",
						(unsigned long long) ITEM_get_cas(it));
				if (add_iov(c, "VALUE ", 6) != 0
						|| add_iov(c, ITEM_key(it), it->nkey) != 0
						|| add_iov(c, ITEM_suffix(it), it->nsuffix - 2) != 0
						|| add_iov(c, suffix, suffix_len) != 0
						|| add_iov(c, ITEM_data(it), it->nbytes) != 0) {
					item_remove(it);
					break;
				}
			} else {
				MEMCACHED_COMMAND_GET(c->sfd, ITEM_key(it), it->nkey,
						it->nbytes, ITEM_get_cas(it));
				//将需要返回的数据填充到IOV结构中
				//命令：get userId
				//返回的结构：
				//VALUE userId 0 5
				//55555
				//END
				if (add_iov(c, "VALUE ", 6) != 0
						|| add_iov(c, ITEM_key(it), it->nkey) != 0
						|| add_iov(c, ITEM_suffix(it),
								it->nsuffix + it->nbytes) != 0) {
					item_remove(it);
					break;
				}
			}
 
			if (settings.verbose > 1) {
				int ii;
				fprintf(stderr, ">%d sending key ", c->sfd);
				for (ii = 0; ii < it->nkey; ++ii) {
					fprintf(stderr, "%c", key[ii]);
				}
				fprintf(stderr, "\n");
			}
 
			/* item_get() has incremented it->refcount for us */
			pthread_mutex_lock(&c->thread->stats.mutex);
			c->thread->stats.slab_stats[it->slabs_clsid].get_hits++;
			c->thread->stats.get_cmds++;
			pthread_mutex_unlock(&c->thread->stats.mutex);
			item_update(it);
			*(c->ilist + i) = it;
			i++;
 
		} else {
			pthread_mutex_lock(&c->thread->stats.mutex);
			c->thread->stats.get_misses++;
			c->thread->stats.get_cmds++;
			pthread_mutex_unlock(&c->thread->stats.mutex);
			MEMCACHED_COMMAND_GET(c->sfd, key, nkey, -1, 0);
		}
 
		key_token++;
	}
 
	/*
	 * If the command string hasn't been fully processed, get the next set
	 * of tokens.
	 */
	//如果命令行中的命令没有全部被处理，则继续下一个命令
	//一个命令行中，可以get多个元素
	if (key_token->value != NULL) {
		ntokens = tokenize_command(key_token->value, tokens, MAX_TOKENS);
		key_token = tokens;
	}
 
} while (key_token->value != NULL);
 
c->icurr = c->ilist;
c->ileft = i;
if (return_cas) {
	c->suffixcurr = c->suffixlist;
	c->suffixleft = i;
}
 
if (settings.verbose > 1)
	fprintf(stderr, ">%d END\n", c->sfd);
 
/*
 If the loop was terminated because of out-of-memory, it is not
 reliable to add END\r\n to the buffer, because it might not end
 in \r\n. So we send SERVER_ERROR instead.
 */
//添加结束标志符号
if (key_token->value != NULL || add_iov(c, "END\r\n", 5) != 0
		|| (IS_UDP(c->transport) && build_udp_headers(c) != 0)) {
	out_of_memory(c, "SERVER_ERROR out of memory writing get response");
} else {
	//将状态修改为写，这边读取到item的数据后，又开始需要往客户端写数据了。
	conn_set_state(c, conn_mwrite);
	c->msgcurr = 0;
}
}
```

Memcached的查询主要是通过HashTable来查询缓存数据的。

HashTable我们在上一章已经讲过。前面也讲过，当缓存数据SET操作完成后，Memcached会将item数据结构关联到HashTable和它的LRU的链上面。

```c++
//这边的item_*系列的方法，就是Memcached核心存储块的接口
item *item_get(const char *key, const size_t nkey) {
    item *it;
    uint32_t hv;
    hv = hash(key, nkey); //对key进行hash,返回一个uint32_t类型的值
    item_lock(hv); //块锁，当取数据的时候，不允许其他的操作，保证取数据的原子性
    it = do_item_get(key, nkey, hv);
    item_unlock(hv);
    return it;
}
```


这边着重看assoc_find这个方法，主要作用：从HashTable上找到对应的Item地址值。

```c++
/** wrapper around assoc_find which does the lazy expiration logic */
item *do_item_get(const char *key, const size_t nkey, const uint32_t hv) {
    //mutex_lock(&cache_lock);
	//在HashTable上找Item
    item *it = assoc_find(key, nkey, hv);
    if (it != NULL) {
        refcount_incr(&it->refcount);
        /* Optimization for slab reassignment. prevents popular items from
         * jamming in busy wait. Can only do this here to satisfy lock order
         * of item_lock, cache_lock, slabs_lock. */
        if (slab_rebalance_signal &&
            ((void *)it >= slab_rebal.slab_start && (void *)it < slab_rebal.slab_end)) {
            do_item_unlink_nolock(it, hv);
            do_item_remove(it);
            it = NULL;
        }
    }
    //mutex_unlock(&cache_lock);
    int was_found = 0;
if (settings.verbose > 2) {
    int ii;
    if (it == NULL) {
        fprintf(stderr, "> NOT FOUND ");
    } else {
        fprintf(stderr, "> FOUND KEY ");
        was_found++;
    }
    for (ii = 0; ii < nkey; ++ii) {
        fprintf(stderr, "%c", key[ii]);
    }
}
 
if (it != NULL) {
    if (settings.oldest_live != 0 && settings.oldest_live <= current_time &&
        it->time <= settings.oldest_live) {
        do_item_unlink(it, hv);
        do_item_remove(it);
        it = NULL;
        if (was_found) {
            fprintf(stderr, " -nuked by flush");
        }
    //检查是否过期
    } else if (it->exptime != 0 && it->exptime <= current_time) {
        do_item_unlink(it, hv);
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
 
if (settings.verbose > 2)
    fprintf(stderr, "\n");
 
return it;
}
```
### 3. 删除 delete 操作

删除操作主要看process_delete_command方法：

先查询item是否存在
如果存在则删除item，不存在，则返回NOT FOUND

```c++
static void process_delete_command(conn *c, token_t *tokens,
		const size_t ntokens) {
	char *key;
	size_t nkey;
	item *it;
assert(c != NULL);
 
//检查命令合法性
if (ntokens > 3) {
	bool hold_is_zero = strcmp(tokens[KEY_TOKEN + 1].value, "0") == 0;
	bool sets_noreply = set_noreply_maybe(c, tokens, ntokens);
	bool valid = (ntokens == 4 && (hold_is_zero || sets_noreply))
			|| (ntokens == 5 && hold_is_zero && sets_noreply);
	if (!valid) {
		out_string(c, "CLIENT_ERROR bad command line format.  "
				"Usage: delete <key> [noreply]");
		return;
	}
}
 
//获取key的值和长度
key = tokens[KEY_TOKEN].value;
nkey = tokens[KEY_TOKEN].length;
 
if (nkey > KEY_MAX_LENGTH) {
	out_string(c, "CLIENT_ERROR bad command line format");
	return;
}
 
if (settings.detail_enabled) {
	stats_prefix_record_delete(key, nkey);
}
 
//先去查询一次，如果查询到了，则删除，否则返回NOT FOUND
it = item_get(key, nkey);
if (it) {
	MEMCACHED_COMMAND_DELETE(c->sfd, ITEM_key(it), it->nkey);
 
	pthread_mutex_lock(&c->thread->stats.mutex);
	c->thread->stats.slab_stats[it->slabs_clsid].delete_hits++;
	pthread_mutex_unlock(&c->thread->stats.mutex);
	//如果找到了Item，则删除Item
	item_unlink(it);
	item_remove(it); /* release our reference */
	out_string(c, "DELETED");
} else {
	//否则就是不能找到
	pthread_mutex_lock(&c->thread->stats.mutex);
	c->thread->stats.delete_misses++;
	pthread_mutex_unlock(&c->thread->stats.mutex);
 
	out_string(c, "NOT_FOUND");
}
}
```

item_unlink和do_item_unlink方法主要两个作用：

从HashTable上将Item的地址值删除
从LRU的链表上，将Item的地址值删除（LRU链表只要处理头部和尾部就行了）

item_remove主要是释放item

```c++
//删除Item
void item_remove(item *item) {
    uint32_t hv;
    hv = hash(ITEM_key(item), item->nkey); //Hash值
item_lock(hv);
do_item_remove(item);
item_unlock(hv);
}
```