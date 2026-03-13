---
title: "Spark 内存管理"
date: 2019-09-26 17:22:28
categories:
  - "Spark note"
  - "spark md"
---

### **一.指定spark executor 数量的公式**

**executor 数量 = spark.cores.max/spark.executor.cores**

- spark.cores.max 是指你的spark程序需要的总核数

- spark.executor.cores 是指每个executor需要的核数

### 二.指定并行的task数量spark.default.parallelism

- 参数说明：该参数用于设置每个stage的默认task数量。这个参数极为重要，如果不设置可能会直接影响你的Spark作业性能。
- 参数调优建议：Spark作业的默认task数量为500~1000个较为合适。很多同学常犯的一个错误就是不去设置这个参数，那么此时就会导致Spark自己根据底层HDFS的block数量来设置task的数量，默认是一个HDFS block对应一个task。通常来说，Spark默认设置的数量是偏少的（比如就几十个task），如果task数量偏少的话，就会导致你前面设置好的Executor的参数都前功尽弃。试想一下，无论你的Executor进程有多少个，内存和CPU有多大，但是task只有1个或者10个，那么90%的Executor进程可能根本就没有task执行，也就是白白浪费了资源！因此Spark官网建议的设置原则是，设置该参数为num-executors * executor-cores的2~3倍较为合适，比如Executor的总CPU core数量为300个，那么设置1000个task是可以的，此时可以充分地利用Spark集群的资源。

## **三. 命令示例**

```shell
spark-submit --class com.cjh.test.WordCount 
			 --conf spark.default.parallelism=12 
			 --conf spark.executor.memory=800m 
			 --conf spark.executor.cores=2 
			 --conf spark.cores.max=6 my.jar
```

## **四.其他调优参数**

### 1. 统一内存管理

#### 堆内内存

由 Spark 应用程序启动时的 –executor-memory 或 **spark.executor.memory** 参数配置.

Executor 内运行的**并发任务共享 JVM 堆内内存:**

​		**存储（Storage）内存**: 在缓存 RDD 数据和广播（Broadcast）数据时占用的内存, 启动时**spark.storage.storageFraction** 参数配置

​        **执行（Execution）内存**:  在执行 Shuffle 时占用的内存, 1- **spark.storage.storageFraction**

​        **Other 内存** : 那些 Spark 内部的对象实例，或者用户定义的 Spark 应用程序中的对象实例

​        **统一内存**:        **存储 +  执行** ,  **spark.memory.fraction**

![img](https://images2018.cnblogs.com/blog/1228818/201804/1228818-20180426212726300-1935303266.png)

### 堆外内存

为了进一步优化内存的使用以及提高 Shuffle 时排序的效率，Spark 引入了堆外（Off-heap）内存，使之可以直接在工作节点的系统内存中开辟空间，存储经过序列化的二进制数据。利用 JDK Unsafe API（从 Spark 2.0 开始，在管理堆外的存储内存时不再基于 Tachyon，而是与堆外的执行内存一样，基于 JDK Unsafe API 实现[3]），Spark 可以直接操作系统堆外内存，减少了不必要的内存开销，以及频繁的 GC 扫描和回收，提升了处理性能。堆外内存可以被精确地申请和释放，而且序列化的数据占用的空间可以被精确计算，所以相比堆内内存来说降低了管理的难度，也降低了误差。

在默认情况下堆外内存并不启用，可通过配置 spark.memory.offHeap.enabled 参数启用，并由 spark.memory.offHeap.size 参数设定堆外空间的大小。除了没有 other 空间，堆外内存与堆内内存的划分方式相同，所有运行中的并发任务共享存储内存和执行内存。



![img](https://images2018.cnblogs.com/blog/1228818/201804/1228818-20180426212753315-871591593.png)



**1. spark.storage.memoryFraction**

- 参数说明：该参数用于设置RDD持久化数据在Executor内存中能占的比例，默认是0.6。也就是说，默认Executor 60%的内存，可以用来保存持久化的RDD数据。根据你选择的不同的持久化策略，如果内存不够时，可能数据就不会持久化，或者数据会写入磁盘。
- 参数调优建议：如果Spark作业中，有较多的RDD持久化操作，该参数的值可以适当提高一些，保证持久化的数据能够容纳在内存中。避免内存不够缓存所有的数据，导致数据只能写入磁盘中，降低了性能。但是如果Spark作业中的shuffle类操作比较多，而持久化操作比较少，那么这个参数的值适当降低一些比较合适。此外，如果发现作业由于频繁的gc导致运行缓慢（通过spark web ui可以观察到作业的gc耗时），意味着task执行用户代码的内存不够用，那么同样建议调低这个参数的值。

**2. spark.shuffle.memoryFraction**

- 参数说明：该参数用于设置shuffle过程中一个task拉取到上个stage的task的输出后，进行聚合操作时能够使用的Executor内存的比例，默认是0.2。也就是说，Executor默认只有20%的内存用来进行该操作。shuffle操作在进行聚合时，如果发现使用的内存超出了这个20%的限制，那么多余的数据就会溢写到磁盘文件中去，此时就会极大地降低性能。
- 参数调优建议：如果Spark作业中的RDD持久化操作较少，shuffle操作较多时，建议降低持久化操作的内存占比，提高shuffle操作的内存占比比例，避免shuffle过程中数据过多时内存不够用，必须溢写到磁盘上，降低了性能。此外，如果发现作业由于频繁的gc导致运行缓慢，意味着task执行用户代码的内存不够用，那么同样建议调低这个参数的值。

![image_1arg10ugj1lc09nr174n17cqhde80.png-109.7kB](http://static.zybuluo.com/vin123456/51t0qnucnka6zir7niq1fc9g/image_1arg10ugj1lc09nr174n17cqhde80.png)

![img](https://images2018.cnblogs.com/blog/1228818/201804/1228818-20180426211648357-1088243541.png)

[1] https://www.cnblogs.com/frankdeng/p/9301783.html

