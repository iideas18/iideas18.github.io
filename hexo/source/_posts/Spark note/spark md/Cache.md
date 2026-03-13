---
title: "Cache"
date: 2020-06-02 16:09:32
cover: "https:////upload-images.jianshu.io/upload_images/14070163-ddb75fb3459a9f48.png?imageMogr2/auto-orient/strip|imageView2/2/w/1200/format/webp"
categories:
  - "Spark note"
  - "spark md"
---

# Cache

1.什么时候进行cache

(1)要求计算速度快

(2)集群的资源要足够大

(3)重要：cache的数据会多次触发Action

(4).先进行过滤，将过滤后的精准的数据存放到内存中再执行操作

//第一个参数，放到磁盘

//第二个参数，放到内存

//第三个参数，磁盘当中的数据不是以java对象的方式保存

//第死个参数，内存当中的数据是以java对象的方式保存

```scala
	val MEMORY_AND_DISK =new StorageLevel(true,true,false,true)
```



OFF_HEAP：堆外内存（Tachyon，分布式内存存储系统）

spark可以将数据专门存放到spark提供的文件存储系统中



![img](https:////upload-images.jianshu.io/upload_images/14070163-ddb75fb3459a9f48.png?imageMogr2/auto-orient/strip|imageView2/2/w/1200/format/webp)

cache执行流程

当我们在spark-shell执行操作如下



![img](https:////upload-images.jianshu.io/upload_images/14070163-d493ccac30f1d3c0.png?imageMogr2/auto-orient/strip|imageView2/2/w/1081/format/webp)

​      当我们第一次使用count求文件的长度时是很慢的，但第二次第三次执行count时速度会快很多，原因是cache将文件缓存在Executor上，当我们第二次调用它时会去内存上找数据。

​      但是我们的内存也不是无限大的，不可能存取太多的数据，当我们后面还要使用cache时，而内存已经存取很多不用的数据时可以使用unpersist清理内存





//Cached Partitions代表的是分区

//Fraction Cached代表的内存缓存文件的程度

![img](https:////upload-images.jianshu.io/upload_images/14070163-438a2ea410327c6e.png?imageMogr2/auto-orient/strip|imageView2/2/w/1200/format/webp)

cache的页面显示



![img](https:////upload-images.jianshu.io/upload_images/14070163-555a711dc972f998.png?imageMogr2/auto-orient/strip|imageView2/2/w/1200/format/webp)

重复使用count方法时所用的时间越来越少

注：该方法既没有生成新的RDD，也没有触发任务执行，只会标记该RDD的分区对应的数据（第一次触发Action）放入到内存
链接：https://www.jianshu.com/p/6f88f4290d70

## 2. Cache 源码分析

![image-20200602093549490](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200602093549490.png)

![image-20200602093630890](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200602093630890.png)



![image-20200602093739826](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200602093739826.png)



![image-20200602093820674](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200602093820674.png)

Spark是基于内存的计算模型，但是当compute chain非常长或者某个计算代价非常大时，能将某些计算的结果进行缓存就显得很方便了。Spark提供了两种缓存的方法 Cache 和 checkPoint。本章只关注 Cache (基于spark-core_2.10)，在后续的章节中会提到 checkPoint.

主要从以下三方面来看

1. persist时发生什么
2. 执行action时如何去缓存及读取缓存
3. 如何释放缓存

![img](https://images2015.cnblogs.com/blog/794071/201607/794071-20160707155526092-1047949746.jpg)

#### 定义缓存

spark的计算是lazy的，只有在执行action时才真正去计算每个RDD的数据。要使RDD缓存，必须在执行某个action之前定义RDD.persist()，此时也就定义了缓存，但是没有真正去做缓存。RDD.persist会调用到SparkContext.persistRDD(rdd)，同时将RDD注册到ContextCleaner中（后面会讲到这个ContextCleaner）。

```scala
def persist(newLevel: StorageLevel): this.type = {
    // TODO: Handle changes of StorageLevel
    if (storageLevel != StorageLevel.NONE && newLevel != storageLevel) {
      throw new UnsupportedOperationException(
        "Cannot change storage level of an RDD after it was already assigned a level")
    }
    sc.persistRDD(this)
    // Register the RDD with the ContextCleaner for automatic GC-based cleanup
    sc.cleaner.foreach(_.registerRDDForCleanup(this))
    storageLevel = newLevel
    this
  }
```

sc.persistRDD很简单，将（rdd.id, rdd）加到persistentRdds中。persistentRDDs一个HashMap，key就是rdd.id，value是一个包含时间戳的对rdd的弱引用。persistentRDDs用来跟踪已经被标记为persist的RDD的引用的。

所以在定义缓存阶段，做了两件事：一是设置了rdd的StorageLevel，而是将rdd加到了persistentRdds中并在ContextCleaner中注册。

#### 缓存

当执行到某个action时，真正计算才开始，这时会调用DAGScheduler.submitJob去提交job，通过rdd.iterator()来计算partition。

```scala
final def iterator(split: Partition, context: TaskContext): Iterator[T] = {
    if (storageLevel != StorageLevel.NONE) {
      SparkEnv.get.cacheManager.getOrCompute(this, split, context, storageLevel)
    } else {
      computeOrReadCheckpoint(split, context)
    }
  }
```

iterator的逻辑很清楚，如果srorageLevel被标记过了就去CacheManager取，否则自己compute或者从checkPoint读取。

在cacheManager.getOrCompute中，通过RDDBlockId尝试去BlockManager中得到缓存的数据。如果缓存得不到（第一次计算），并调用computeOrReadCheckPoint去计算，并将结果cache起来，cache是通过putInBlockManger实现。根据StorageLevel，如果是缓存在内存中，会将结果存在MemoryStore的一个HashMap中，如果是在disk，结果通过DiskStore.put方法存到磁盘的某个文件夹中。这个文件及最终由Utils中的方法确定

```scala
private def getOrCreateLocalRootDirsImpl(conf: SparkConf): Array[String] = {
    if (isRunningInYarnContainer(conf)) {
      // If we are in yarn mode, systems can have different disk layouts so we must set it
      // to what Yarn on this system said was available. Note this assumes that Yarn has
      // created the directories already, and that they are secured so that only the
      // user has access to them.
      getYarnLocalDirs(conf).split(",")
    } else if (conf.getenv("SPARK_EXECUTOR_DIRS") != null) {
      conf.getenv("SPARK_EXECUTOR_DIRS").split(File.pathSeparator)
    } else {
      // In non-Yarn mode (or for the driver in yarn-client mode), we cannot trust the user
      // configuration to point to a secure directory. So create a subdirectory with restricted
      // permissions under each listed directory.
      Option(conf.getenv("SPARK_LOCAL_DIRS"))
        .getOrElse(conf.get("spark.local.dir", System.getProperty("java.io.tmpdir")))
        .split(",")
        .flatMap { root =>
          try {
            val rootDir = new File(root)
            if (rootDir.exists || rootDir.mkdirs()) {
              val dir = createTempDir(root)
              chmod700(dir)
              Some(dir.getAbsolutePath)
            } else {
              logError(s"Failed to create dir in $root. Ignoring this directory.")
              None
            }
          } catch {
            case e: IOException =>
            logError(s"Failed to create local root dir in $root. Ignoring this directory.")
            None
          }
        }
        .toArray
    }
  }
```

如果已经缓存了，那么cacheManager.getOrCompute在调用blockManger.get(RDDBlockId)时会返回结果。get会先调用getLocal在本地获取，如果本地没有则调用getRemote去远程寻找，getRemote会call BlockMangerMaster.getLocation得到缓存的地址。

#### 释放

Spark通过调用rdd.unpersit来释放缓存，这是通过SparkContext.unpersistRDD来实现的。在unpersistRDD中，rdd会从persistentRdds中移除，并通知BlockManagerMaster去删除数据缓存。BlockManagerMaster会通过消息机制告诉exectutor去删除内存或者disk上的缓存数据。

那么问题来了，如果用户不通过手动来unpersit，那缓存岂不是越积越多，最后爆掉吗？

是的，你的想法完全合理。因此Spark会自动删除不在scope内的缓存。“不在scope”指的是在用户程序中已经没有了该RDD的引用，RDD的数据是不可读取的。这里就要用到之前提到的ContextCleaner。ContextCleaner存了CleanupTaskWeakReference弱引用及存放该引用的队列。当系统发生GC将没有强引用的rdd对象回收后，这个弱引用会加入到队列中。ContextCleaner起了单独的一个线程轮询该队列，将队列中的弱引用取出，根据引用中的rddId触发sc.unpersistRDD。通过这样Spark能及时的将已经垃圾回收的RDD对应的cache进行释放。这里要清楚rdd与数据集的关系，rdd只是一个定义了计算逻辑的对象，对象本身不会包含其所代表的数据，数据要通过rdd.compute计算得到。所以系统回收rdd，只是回收了rdd对象，并没有回收rdd代表的数据集。

此外，SparkContext中还有一个MetadataCleaner，该cleaner会移除persistentRdds中的过期的rdd。（笔者一直没清楚这个移除和cache释放有什么关系？？）