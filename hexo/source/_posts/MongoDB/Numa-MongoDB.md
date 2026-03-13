---
title: "使用numactl 启动mongoDB"
date: 2022-03-12 23:43:50
cover: "/2022/03/12/MongoDB/Numa-MongoDB/Untitled/12979420-aac44e196bd3b915.webp"
slug: "Numa-MongoDB"
categories:
  - "MongoDB"
---

# 使用numactl 启动mongoDB

## 一、numactl介绍

![img](Untitled/12979420-aac44e196bd3b915.webp)

![img](Untitled/12979420-374a66c2de8a290e.webp)

## 二、CentOS7.x上numactl的安装

```shell
# yum -y install numactl**
# yum info numactl
# rpm -ql numactl | grep bin
```

![img](Untitled/12979420-a9136191cdfd1dc0.webp)

## 三、numa与mongoDB

### 1. NUMA和SMP是两种CPU相关的硬件架构 

​	在SMP架构里面，所有的CPU争用一个总线来访问所有内存，优点是资源共享，而缺点是总线争用激烈。随着PC服务器上的CPU数量变多（不仅仅是CPU核数），总线争用的弊端慢慢越来越明显，于是Intel在Nehalem CPU上推出了NUMA架构，而AMD也推出了基于相同架构的Opteron CPU。

​	NUMA最大的特点是引入了**node和distance**的概念。对于CPU和内存这两种最宝贵的硬件资源，NUMA用近乎严格的方式划分了所属的资源组（node），而每个资源组内的CPU和内存是几乎相等。资源组的数量取决于物理CPU的个数（现有的PC server大多数有两个物理CPU，每个CPU有4个核）；distance这个概念是用来定义各个node之间调用资源的开销，为资源调度优化算法提供数据支持。

​	NUMA和SMP是两种CPU相关的硬件架构。在SMP架构里面，所有的CPU争用一个总线来访问所有内存，优点是资源共享，而缺点是总线争用激烈。随着PC服务器上的CPU数量变多（不仅仅是CPU核数），总线争用的弊端慢慢越来越明显，于是Intel在Nehalem CPU上推出了NUMA架构，而AMD也推出了基于相同架构的Opteron CPU。

​	NUMA最大的特点是引入了node和distance的概念。对于CPU和内存这两种最宝贵的硬件资源，NUMA用近乎严格的方式划分了所属的资源组（node），而每个资源组内的CPU和内存是几乎相等。资源组的数量取决于物理CPU的个数（现有的PC server大多数有两个物理CPU，每个CPU有4个核）；distance这个概念是用来定义各个node之间调用资源的开销，为资源调度优化算法提供数据支持。

### 2. NUMA相关的策略 

1、每个进程（或线程）都会从父进程继承NUMA策略，并分配有一个优先node。如果NUMA策略允许的话，进程可以调用其他node上的资源。

2、NUMA的CPU分配策略有cpunodebind、physcpubind。cpunodebind规定进程运行在某几个node之上，而physcpubind可以更加精细地规定运行在哪些核上。

3、NUMA的内存分配策略有**localalloc、preferred、membind、interleave**。localalloc规定进程从当前node上请求分配内存；而preferred比较宽松地指定了一个推荐的node来获取内存，如果被推荐的node上没有足够内存，进程可以尝试别的node。membind可以指定若干个node，进程只能从这些指定的node上请求分配内存。**interleave规定进程从指定的若干个node上以RR算法交织地请求分配内存**。

### 3. NUMA和swap的关系 

NUMA的内存分配策略对于进程（或线程）之间来说，并不是公平的。

在现有的Redhat Linux中，localalloc是默认的NUMA内存分配策略，这个配置选项导致资源独占程序很容易将某个node的内存用尽。而当某个node的内存耗尽时，Linux又刚好将这个node分配给了某个需要消耗大量内存的进程（或线程），swap就妥妥地产生了。尽管此时还有很多page cache可以释放，甚至还有很多的free内存。

NUMA：NUMA是多核心CPU架构中的一种，其全称为Non-Uniform Memory Access

简单来说就是在多核心CPU中，机器的物理内存是分配给各个核。

![img](Untitled/12979420-93aaa4fcec5fb8d8.webp)

每个核访问分配给自己的内存会比访问分配给其它核的内存要快，有下面几种访问控制策略：

![img](Untitled/12979420-7d1552c4526e1a83.webp)

```shell
$ **numactl --interleave=all**  mongod \
 	-f /path/to/mongodb.conf \
 	--dbpath=/path/to/datadir  \
 	--fork \
  	--logpath=/path/to/mongodb.log
```

上面使用numactl –interleave命令就是指定其为交叉共享模式。

在有多个物理CPU的架构下，NUMA把内存分为本地和远程，每个物理CPU都有属于自己的本地内存，访问本地内存速度快于访问远程内存，缺省情况下，每个物理CPU只能访问属于自己的本地内存。

对于MongoDB这种需要大内存的服务来说就可能造成内存不足，但是目前mongodb在这种架构下工作的不是很好，numactl --interleave=all就是禁用NUMA为每个核单独分配。

理论上，MySQL、Redis、Memcached等等都可能会受到NUMA的影响，需要留意。

每当出问题的时候，总有一个名叫[irqbalance](https://links.jianshu.com/go?to=http%3A%2F%2Firqbalance.org%2F)的进程CPU占用率居高不下，搜索了一下，发现很多介绍irqbalance的文章中都提及了NUMA。

```shell
# yum -y install irqbalance
# yum info irqbalance
```

![img](Untitled/12979420-073a2e852b405a72.webp)

我们知道虚拟内存机制是通过一个中断信号来通知虚拟内存系统进行内存swap的，所以这个irqbalance进程忙，是一个危险信号，在这里是由于在进行频繁的内存交换。

这种频繁交换现象称为swap insanity，在MySQL中经常提到，也就是在NUMA框架中，采用不合适的策略，导致核心只能从指定内存块节点上分配内存，即使总内存还有富余，也会由于当前节点内存不足时产生大量的swap操作。

## **四、参考**

**关于mongoDB启动使用numactl --interleave=all**

http://www.cocoachina.com/articles/61437

**记一次MongoDB性能问题**

https://blog.huoding.com/2011/08/09/104

http://blog.sina.com.cn/s/blog_976d93830101ea3g.html

**Mongodb NUMA 导致的性能问题**

http://zhangliyong.github.io/posts/2014/04/09/mongodb-numa-dao-zhi-de-xing-neng-wen-ti.html

**mongoDB的NUMA问题**

http://www.ttlsa.com/mongodb/mongodb-numa

**mongoDB使用numactl 启动**

https://blog.51cto.com/linuxg/1921697

**关于numactl工具**

https://www.jianshu.com/p/29662d744dd1

https://ywnz.com/linux/numactl

**The MySQL “swap insanity” problem and the effects of the NUMA architecture**

https://blog.jcole.us/2010/09/28/mysql-swap-insanity-and-the-numa-architecture