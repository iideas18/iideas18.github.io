---
title: "NUMA架构下的内存分配策略"
date: 2022-03-14 14:04:40
slug: "NUMA memory alloc"
categories:
  - "CPU"
  - "NUMA"
---

# NUMA架构下的内存分配策略

> 通常的内存分配策略我们已经有所了解了。UMA是统一内存访问，无论任何 CPU 执行操作，访问时间都相等。而NUMA是非统一内存访问，在不同的节点的访问速度不一样，离本地越远访问越慢。在NUMA上我们有不只一个节点，我们可以在不同的节点上分配内存。

## 内存分配和策略

通常NUMA下的内存分配有显式和隐式两种。

### 1. 显式分配

显式分配即指定节点的分配函数，此类基础分配函数主要有2个：Buddy系统的 alloc_pages_node()和SLAB系统的kmem_cache_alloc_node()，其它的函数都可以从这2个派生出来。

例如，kmalloc_node()最终调用kmem_cache_alloc_node()进行分配。

#### 1. Buddy显式分配

alloc_pages_node()分配流程：

```
alloc_pages_node
	__alloc_pages_node
    	__alloc_pages
    		 __alloc_pages_nodemask
```


如果节点的nid为NUMA_NO_NODE（非 NUMA 系统），就在当前cpu运行的节点上进行分配，否则就在指定的nid上分配，最终执行伙伴系统的核心分配函数__alloc_pages_nodemask。

如果节点的nid为NUMA_NO_NODE（非 NUMA 系统），就在当前cpu运行的节点上进行分配，否则就在指定的nid上分配，最终执行伙伴系统的核心分配函数__alloc_pages_nodemask。

#### 2. SLAB显式分配

kmem_cache_alloc_node()分配流程：

```
kmem_cache_alloc_node
	kmem_cache_alloc
		slab_alloc
			__do_cache_alloc
```


调用slab_alloc来分配一个新的slab并取出一个node，如果内存分配不成功就转到隐式分配。

### 2. 隐式分配

配置CONFIG_NUMA后，设备会关联一个NUMA节点信息，struct device结构中会多一个numa_node字段记录本设备所在的节点。

隐式分配即不指定节点的分配函数，此类基础分配函数主要有2个：Buddy系统的 alloc_pages()和SLAB系统的kmem_cache_alloc()，其它的函数都可以从这2个派生出来。

隐式分配涉及到NUMA内存策略(Memory Policy)，内核定义了六种内存策略。

#### 1. 内存策略

```
enum {
	MPOL_DEFAULT,使用本地节点的zonelist
	MPOL_PREFERRED,使用指定节点的zonelist；
	MPOL_BIND,设置一个节点集合，只能从这个集合中节点的zone申请内存：
	MPOL_INTERLEAVE,采用Round-Robin方式从设定的节点集合中选出某个节点，使用此节点的zonelist；
	MPOL_LOCAL,使用触发分配的cpu的节点
	MPOL_MAX,	/* always last member of enum */
};
```

系统的默认分配策略是本地分配（即Local Allocation），但是在启动过程中使用交替策略，这样内核的数据结构是分布在所有Node上的，从而避免启动核所在Node负载过重。一旦系统第一个进程（init）开始执行，策略就变成了本地分配。

系统的默认分配策略是本地分配（即Local Allocation），但是在启动过程中使用交替策略，这样内核的数据结构是分布在所有Node上的，从而避免启动核所在Node负载过重。一旦系统第一个进程（init）开始执行，策略就变成了本地分配。

#### 2. Buddy隐式分配

以默认的NUMA内存策略为例讲解，alloc_pages()分配流程：

```
alloc_pages
	alloc_pages_current
		alloc_page_interleave
			alloc_page_interleave
				__alloc_pages
			__alloc_pages_nodemask
```


alloc_pages会交由alloc_pages_current做处理，如果是交错策略（MPOL_INTERLEAVE）就调用alloc_page_interleave进行分配。否则就调用__alloc_pages_nodemask做分配处理。

#### 3. SLAB隐式分配

以默认的NUMA内存策略为例讲解，kmem_cache_alloc(cachep, gfp_flags)分配流程：

```
kmem_cache_alloc
	slab_alloc
		__do_cache_alloc
			____cache_alloc
					cpu_cache_get
						cache_alloc_refill
			____cache_alloc_node
					get_first_slab
					cache_grow_begin
						kmem_getpages
							 __alloc_pages_node
```

前面在slab显式分配的时候就已经介绍过了这部分的函数走向。调用____cache_alloc的cpu_cache_get从本地CPU高速缓存结构中获取对象，如果本地没有合适的就执行cache_alloc_refill，获取node共享高速缓存，如果有就填充，如果不行就从slabs_partial（部分分配的slab）和slabs_free（空的slab）上获取空闲对象。如果还不行就去上级的伙伴系统中分配。如果当前节点上已经没有空闲内存了，就调用____cache_alloc_node定位到别的节点。然后调用get_first_slab从 slab 中获取一个页，如果没有空闲页，就调用cache_grow_begin增加一个可用的slab，它是通过伙伴系统来获取的。