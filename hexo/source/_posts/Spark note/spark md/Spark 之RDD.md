---
title: "Spark 之RDD"
date: 2020-06-04 15:25:44
categories:
  - "Spark note"
  - "spark md"
---

# Spark 之RDD

[![img](https://upload.jianshu.io/users/upload_avatars/2015574/a6dc1ae89c3c?imageMogr2/auto-orient/strip|imageView2/1/w/96/h/96/format/webp)](https://www.jianshu.com/u/735658692c55)

[起个什么呢称呢](https://www.jianshu.com/u/735658692c55)关注

0.0622018.04.10 22:59:44字数 2,802阅读 600

> 为什么要设计RDD

   网上资料很多，这里我给罗列出来，许多的迭代算法和交互式数据挖掘工具，这些应用场景的共同点是：在不同的运行阶段或者说是计算阶段，都会重用中间结果，即一个阶段的输出会作为下一个输出，而Hadoop的mapreduce 会把处理的中间结果放入到HDFS上，这样极大的增加了磁盘读写的负担。

  RDD 就是满足这个减少对I/O的负担而提出的，提供一个抽象的数据结构，不必担心底层数据的分布性，只需要将具体的应用逻辑表达为一些列的转换处理，不同的RDD之间的转换操作形成依赖关系，可实现管道化，从而避免中间结果，减少磁盘I/O的操作。就是实现RDD 这个数据结构时候，可以重用中间结果，每个阶段的中间结果有依赖关系，可以相互转化。减少I/O操作，降低读写开销，提高运算效率。

> 什么是RDD?

一个RDD是一个分布式对象集合。本质上是一个只读的分区集合。每个RDD 可以分成多个分区，每个分区上有多个数据集片段。



![img](https://upload-images.jianshu.io/upload_images/2015574-b25931ca506ff80e.png?imageMogr2/auto-orient/strip|imageView2/2/w/901/format/webp)

上图

并且。一个RDD上的不同的分区可以被保存在集群中不同的worknode 上。从而使集群在不同的节点上实行并行运算。

> 关键字：高度受限，只读记录分区集合，不能修改

RDD还提供了一种高度受限的共享内存模型。 【是一个只读的记录分区集合，不能直接修改】。**只能基于稳定的物理存储中的数据集来创建RDD**。或者通过在其他的RDD上执行确定的转换操。（map, join,groupby）而创建而得到新的RDD。

RDD提供一组丰富的操作以及支持常见的数据运算，分为 Action 【行动】和转换【Transformation】两个类型，前者用于执行计算并指定输出形式，——> Action 后者用于只能够RDD之间的相互关系——> Transformation

>  Action and Transformation 的区别

**1.前者用于执行计算并指定输出形式，——> Action 后者用于只能够RDD之间的相互关系——> Transformation**

**2.转换操作【 map ,join,filter groupBy 】 接受RDD并返回RDD。**

**3.行动操作【count，collect】接受RDD，但是返回非RDD(即一个输出一个值或者结果)**

------

------

**RDD提供的转换接口都非常简单， 都是类似map,filter,groupBy ,join 等数据转换操作。 因此，RDD 比较适合对于数据集元素中执行相同操作的批处理式应用。
**

> **RDD 执行过程
> **

\1. RDD 读取外部数据源，或者再内存中进行创建

2.RDD经过一系列的转换操作，每一次都会产生不同的RDD，共下一个转换使用

3.整个流程中的最后一个RDD经过Action 操作惊醒处理，并输出外部数据源。

注释： RDD采用惰性调用，即在RDD的执行过程中，真正的计算发生在RDD的Action 操作，对于Action 操作之前的所有Transformation 操作，Spark只记录Transformation应用的一些基础数据集以及RDD生成轨迹，即各个RDD之间的相互依赖关系，而不会触发真正的运算 只有在Action 时候 才会计算并返回一个值。





![img](https://upload-images.jianshu.io/upload_images/2015574-e201a3ab8ded7ce7.png?imageMogr2/auto-orient/strip|imageView2/2/w/895/format/webp)

RDD执行过程

> Spark 转换和行动操作

1.在输入逻辑是上生成2个RDD 命名为A，D， 经一系列的Transformation [转换]操作，会在最后生成一个RDD 这里取名为F，当要输出时候，也就是F进行Action 作时候是，Spark会根据RDD的依赖关系生成DAG 从起点进行真正的计算，之前都是逻辑上的，只是记录了各个RDD之间的依赖关系。



> spark的数据处理框架 从一定程度上是对mapreduce 的扩展。执行mapreduce并不擅长的迭代式，交互式，流式计算。 因为spar创造性提出了RDD概念

Spark 编程：Scala 版

#### val sc=SparkContext()

对于Spark程序而言，要想进行操作，必须创建一个上下文。在创建上下文的过程中，集群申请资源以及构建相应的运行环境，一般来说要多SparkConnect 传入四个变量：

> 1.spark：//localhost:7077 [集群在本地启动监听7077 端口]
>
> 2.spark程序的标识
>
> 3.spark的安装路径
>
> 4.传入这个Spark程序的jar 包
>
> val file=sc.textFile("hdfs:///root/datadir")
>
> 利用textFile 接口从指定的目录下读取文件 并返回一个变量file
>
> val fileRDD=file.filter(_.contanins("hello, word"))
>
> 对文件进行过滤操作，传入的是function的对象。

> spark编程中重要的几个概念

1.弹性分布式数据集RDD

2.创建操作，即申请资源内存一系列的SparkConnect,将内存中的集合或者是外部文件系统作为输入源

3.转换操作。将一个RDD通过一定的操作转换成另一个RDD

4.控制操作： 对RDD持久化，可以让RDD保存在磁盘或者内存中，以便后续重复使用

5.行动操作： 我的理解就是RDD调用相关方法

> RDD特性 ——实现高效计算的主要原因

1.高效的容错性。现有的分布式共享内存，键值存储，内存数据库，**为了实现容错，必须在集群节点之间进行数据复制或者记录日志 也即是在节点之间会发生大量的数据传输。**这对于数据密集型应用而言会带来很大的开销，

2.在RDD的设计中，数据只读，不可修改，如果修改数据，必须从父类的RDD转换到子类的RDD，由此在不同的RDD上建立血缘联系

3.中间结果持久化到内存中，数据在内存中的多个RDD操作之间进行传递，不需要写到磁盘，减少I/O开销。

4.存放的数据可以使Java对象，避免了不必要的对象的序列化和反序列化的开销

> RDD之间的依赖关系

# 不同的RDD中在不同的操作会在不同的RDD中产生不同的依赖，RDD中的依赖分为窄依赖和宽依赖 



> 窄依赖和宽依赖

窄依赖表现为一个父RDD的分区对应于一个子RDD的分区，或者多个父RDD的分区对应一个子RDD的分区。

宽依赖表现为一个父类的RDD的一个分区对应一个子RDD的多个分区

辨别：如果存在一个父类的RDD的一个分区对应一个子RDD的多个分区，则是宽依赖，否则是窄依赖。

> 两者依赖包含的几种操作

窄依赖【map, filter,union】

宽依赖【groupBy,sortByKey】

> 【join】连接操作分为2种情况

1.对输入进行协同划分，属于窄依赖，所谓协同划分是**指多个父RDD的某一个分区的所有的键key落在子RDD的同一个分区内，**不会产生同一个父RDD的某一个分区，落在子RDD的两个分区的情况。

![img](https://upload-images.jianshu.io/upload_images/2015574-521647b1d9c8f776.png?imageMogr2/auto-orient/strip|imageView2/2/w/885/format/webp)

图解

2.对输入做非协同划分，属于宽依赖。 



![img](https://upload-images.jianshu.io/upload_images/2015574-7a3990b4c30fc629.png?imageMogr2/auto-orient/strip|imageView2/2/w/261/format/webp)

图解

> 两者依赖应用的场景选择

对于窄依赖的RDD，可以以流水线的方式计算所有父分区，不会造成网络之间的数据混合。

对于宽依赖的RDD，则通常伴随着Shuffle操作，即首先需要计算好所有父分区数据，然后在节点之间进行Shuffle。

> 窄依赖宽依赖的区别

   在两种依赖关系中，窄依赖的失败恢复更为高效，它只需要根据父RDD分区重新计算丢失的分区即可（不需要重新计算所有分区），而且可以并行地在不同节点进行重新计算。而对于宽依赖而言，单个节点失效通常意味着重新计算过程会涉及多个父RDD分区，开销较大。此外，Spark还提供了数据检查点和记录日志，用于持久化中间RDD，从而使得在进行失败恢复时不需要追溯到最开始的阶段。在进行故障恢复时，Spark会对数据检查点开销和重新计算RDD分区的开销进行比较，从而自动选择最优的恢复策略。

> 阶段的划分

Spark通过**分析各个RDD的依赖关系生成了DAG**，**再通过分析各个RDD中的分区之间的依赖关系来决定如何划分阶段**，具体划分方法是：

在DAG中进行反向解析，遇到宽依赖就断开，遇到窄依赖就把当前的RDD加入到当前的阶段中；将窄依赖尽量划分在同一个阶段中，可以实现流水线计算，假设从HDFS中读入数据生成3个不同的RDD（即A、C和E），通过一系列转换操作后再将计算结果保存回HDFS。对DAG进行解析时，在依赖图中进行反向解析，由于从RDD A到RDD B的转换以及从RDD B和F到RDD G的转换，都属于宽依赖，因此，在宽依赖处断开后可以得到三个阶段，即阶段1、阶段2和阶段3。可以看出，在阶段2中，从map到union都是窄依赖，这两步操作可以形成一个流水线操作，比如，分区7通过map操作生成的分区9，可以不用等待分区8到分区9这个转换操作的计算结束，而是继续进行union操作，转换得到分区13，这样流水线执行大大提高了计算的效率。



![img](https://upload-images.jianshu.io/upload_images/2015574-110fddb0ce0e9178.png?imageMogr2/auto-orient/strip|imageView2/2/w/853/format/webp)

图解



> RDD运行过程

（1）创建RDD对象；

（2）SparkContext负责计算RDD之间的依赖关系，构建DAG；

（3）DAGScheduler负责把DAG图分解成多个阶段，每个阶段中包含了多个任务，每个任务会被任务调度器分发给各个工作节点（Worker Node）上的Executor去执行。





![img](https://upload-images.jianshu.io/upload_images/2015574-339e7f8cff87de25.png?imageMogr2/auto-orient/strip|imageView2/2/w/904/format/webp)