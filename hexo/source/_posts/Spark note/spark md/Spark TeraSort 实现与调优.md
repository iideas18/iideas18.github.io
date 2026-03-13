---
title: "Spark TeraSort 实现与调优"
date: 2019-10-18 22:55:30
cover: "https://img-blog.csdn.net/20180312134435184?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70"
categories:
  - "Spark note"
  - "spark md"
---

# Spark TeraSort 实现与调优

2018-03-12 20:38:03 [kisimple](https://me.csdn.net/kisimple) 阅读数 1252

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/kisimple/article/details/79526005

## TeraSort简介

[TeraSort](https://hadoop.apache.org/docs/stable/api/org/apache/hadoop/examples/terasort/package-summary.html)是为Hadoop参加[Sort Benchmark](http://sortbenchmark.org/)而开发的程序包。其中包含3个程序：

- [TeraGen](https://github.com/apache/hadoop/blob/trunk/hadoop-mapreduce-project/hadoop-mapreduce-examples/src/main/java/org/apache/hadoop/examples/terasort/GenSort.java)：用来生成测试数据；
- [TeraSort](https://github.com/apache/hadoop/blob/trunk/hadoop-mapreduce-project/hadoop-mapreduce-examples/src/main/java/org/apache/hadoop/examples/terasort/TeraSort.java)：用来对生成的测试数据进行排序；
- [TeraValidate](https://github.com/apache/hadoop/blob/trunk/hadoop-mapreduce-project/hadoop-mapreduce-examples/src/main/java/org/apache/hadoop/examples/terasort/TeraValidate.java)：用来校验排序结果的正确性；

## Spark的TeraSort实现

参考[ehiggs/spark-terasort](https://github.com/ehiggs/spark-terasort)以及`RDD#sortBy`的代码，我自己实现了一个Spark的TeraSort程序。具体代码在[这里](https://github.com/kisimple/spark/tree/terasort/examples/src/main/scala/org/apache/spark/examples/terasort)。

## TeraSort本地测试

### Hadoop TeraSort测试

首先，下载并部署单机[伪分布式Hadoop集群](http://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-common/SingleCluster.html#Pseudo-Distributed_Operation)。接下来就可以测试了。

```shell
## 执行TeraGen生成测试数据
$ bin/hadoop jar share/hadoop/mapreduce/hadoop-mapreduce-examples-2.7.5.jar teragen 10000 /data/terasort/input
$ bin/hdfs dfs -ls /data/terasort/input
Found 3 items
-rw-r--r--   1 blueszheng supergroup          0 2018-01-23 20:28 /data/terasort/input/_SUCCESS
-rw-r--r--   1 blueszheng supergroup     500000 2018-01-23 20:28 /data/terasort/input/part-m-00000
-rw-r--r--   1 blueszheng supergroup     500000 2018-01-23 20:28 /data/terasort/input/part-m-00001

## 执行TeraSort进行排序
$ bin/hadoop jar share/hadoop/mapreduce/hadoop-mapreduce-examples-2.7.5.jar terasort /data/terasort/input /data/terasort/output
$ bin/hdfs dfs -ls /data/terasort/output
Found 3 items
-rw-r--r--   1 blueszheng supergroup          0 2018-01-23 20:31 /data/terasort/output/_SUCCESS
-rw-r--r--  10 blueszheng supergroup          0 2018-01-23 20:30 /data/terasort/output/_partition.lst
-rw-r--r--   1 blueszheng supergroup    1000000 2018-01-23 20:31 /data/terasort/output/part-r-00000

## 执行TeraValidate验证排序结果
$ bin/hadoop jar share/hadoop/mapreduce/hadoop-mapreduce-examples-2.7.5.jar teravalidate /data/terasort/output /data/terasort/report
$ bin/hdfs dfs -ls /data/terasort/report
Found 2 items
-rw-r--r--   1 blueszheng supergroup          0 2018-01-23 20:35 /data/terasort/report/_SUCCESS
-rw-r--r--   1 blueszheng supergroup         22 2018-01-23 20:35 /data/terasort/report/part-r-00000
$ bin/hdfs dfs -cat /data/terasort/report/part-r-00000
checksum    139abefd74b2
## 如果排序结果有误，则part-r-00000会输出错误信息12345678910111213141516171819202122232425
```

### Spark TeraSort测试

首先下载并解压Spark安装包。然后对TeraSort程序进行打包，因为我是直接把代码放在examples工程里面，所以直接打包examples工程，然后将jar包扔到Spark安装目录下。接下来就可以测试了。

```shell
## 执行Spark TeraSort进行排序
$ bin/spark-submit \
> --master local \
> --class org.apache.spark.examples.terasort.TeraSort spark-examples_2.11-2.2.0.jar \
> /data/terasort/input /data/terasort/spark/output
$ bin/hdfs dfs -ls /data/terasort/spark/output
Found 2 items
-rw-r--r--   1 blueszheng supergroup          0 2018-01-23 21:18 /data/terasort/spark/output/_SUCCESS
-rw-r--r--   1 blueszheng supergroup    1000000 2018-01-23 21:18 /data/terasort/spark/output/part-r-00000

## 执行TeraValidate验证排序结果
$ bin/hadoop jar share/hadoop/mapreduce/hadoop-mapreduce-examples-2.7.5.jar teravalidate /data/terasort/spark/output /data/terasort/spark/report
$ bin/hdfs dfs -cat /data/terasort/spark/report/part-r-00000
checksum    139abefd74b2
## 输出的checksum与Hadoop的terasort结果一致123456789101112131415
```

## TeraSort调优实践

接下来是在集群环境里面的一点调优，这里记录一下。集群管理使用Spark的Standalone模式，集群资源如下图。网络为千兆网络，存储为HDD盘。

![img](https://img-blog.csdn.net/20180312134435184?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

ps. Standalone模式记得在worker节点的`spark-env.sh`里面export `SPARK_LOCAL_DIRS`到数据盘，否则可能会影响shuffle。

第一次提交使用了下面的命令，

```shell
bin/spark-submit \
--master spark://10-215-128-78:7077 \
--driver-memory 2g \
--num-executors 24  \
--executor-cores 4 \
--executor-memory 5376m \
--conf spark.memory.fraction=0.8 \
--conf spark.memory.storageFraction=0.25 \
--conf spark.default.parallelism=200 \
--conf spark.serializer=org.apache.spark.serializer.KryoSerializer \
--conf spark.io.compression.lz4.blockSize=128k \
--conf spark.reducer.maxSizeInFlight=96m \
--conf spark.shuffle.file.buffer=128k \
--conf spark.shuffle.io.maxRetries=16 \
--conf spark.network.timeout=200s \
--conf spark.ui.enabled=false \
--class org.apache.spark.examples.terasort.TeraSort spark-examples_2.11-2.2.0.jar \
/user/root/terasort/100G-input /data/terasort/spark/output/100G123456789101112131415161718
```

接下来说下其中一些配置的考虑，

- 在核数与内存配置确定的情况下，每个分区的数据量应该在`内存/核数`之下，这样就可以尽可能不把数据spill到硬盘上。按上述配置，每个分区数据量应<`5376/4m`，总数据量为100G，当`spark.default.parallelism`配置为200时，假如数据均匀shuffle，则单个分区数据量在500M（事实证明假设数据均匀还是太理想化了）；

- `spark.io.compression.lz4.blockSize=128k`是为了提升lz4的压缩率，但是在压缩时会占用更多的内存；

- `spark.reducer.maxSizeInFlight=96m`在**内存充裕**的情况下可以提升shuffle read性能；

- `spark.shuffle.file.buffer=128k`在**内存充裕**的情况下可以提升shuffle write性能；

- `spark.shuffle.io.maxRetries`与`spark.network.timeout`的配置都是为了提高shuffle read稳定性（其实当前场景下是不需要的）；

  需要说明的是，Spark在读取HDFS数据时，每一个block就是一个partition，当前我们的数据是800个128M的block。因此在shuffle write阶段时，最大的内存占用应该是`24核 * 128M`，应该来说内存是非常充裕的（感觉`spark.shuffle.file.buffer`可以设置更大一点跑跑看）。

  整个执行过程花费了20分钟。查看HistoryServer。其中Job 0是用来执行sampling的，优化的大头不在这。

![Jobs](https://img-blog.csdn.net/2018031213474179?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

![Job 1](https://img-blog.csdn.net/20180312134753362?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

![Stage 1](https://img-blog.csdn.net/20180312134804201?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

![img](https://img-blog.csdn.net/20180312134814169?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

![Stage 2](https://img-blog.csdn.net/20180312134821947?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

根据HistoryServer的展示，调整参数重跑，主要是以下3点，

- 首先，在shuffle write的时候花费了很长的时间，见上图。看了下日志（`work/app-20180122215844-0005/22/stderr`），如下图，并没有什么异常。怀疑是`spark.io.compression.lz4.blockSize`的配置有问题，而且通过机器资源监控看到网络并没有成为瓶颈，不需要太高的压缩率，于是去掉该配置；

![img](https://img-blog.csdn.net/20180312135105485?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)
![img](https://img-blog.csdn.net/20180312135116757?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

- 另外在shuffle read的时候发现还是存在大量的spill，见上图。数据不算均匀，`spark.default.parallelism`配置为200看来还是小了点，于是调大（感觉`spark.reducer.maxSizeInFlight`也应该调小，mark下先），并且使用了G1GC；

- 去掉提高稳定性的配置；

  于是就用下面的命令重跑，

```shell
bin/spark-submit \
--master spark://10-215-128-78:7077 \
--driver-memory 2g \
--num-executors 24  \
--executor-cores 4 \
--executor-memory 5376m \
--conf spark.memory.fraction=0.8 \
--conf spark.memory.storageFraction=0.25 \
--conf spark.default.parallelism=256 \
--conf spark.serializer=org.apache.spark.serializer.KryoSerializer \
--conf spark.reducer.maxSizeInFlight=96m \
--conf spark.shuffle.file.buffer=128k \
--conf spark.ui.enabled=false \
--conf spark.executor.extraJavaOptions=-XX:+UseG1GC \
--class org.apache.spark.examples.terasort.TeraSort spark-examples_2.11-2.2.0.jar \
/user/root/terasort/100G-input /data/terasort/spark/output/100G12345678910111213141516
```

结果将执行时间缩短到了16分钟，用HistoryServer可以看到，shuffle write的性能有了很大提升，缩短的这4分钟都是在shuffle write这里。

![img](https://img-blog.csdn.net/20180312135249639?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)
![img](https://img-blog.csdn.net/20180312135257557?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)
![img](https://img-blog.csdn.net/20180312135329537?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

通过上图可以看到在shuffle read的时候，尽管已经将分区扩大到256个，依旧是存在大量的spill，`Shuffle spill (memory)`是需要spill的数据在内存的大小，`Shuffle spill (disk)`是需要spill的数据**序列化**到硬盘之后的大小。

那么接下来的优化思路就是看看能不能完全避免spill数据到硬盘。通过查看机器资源监控可以发现，**瓶颈在硬盘**上（当然还有内存）。
硬盘使用率，
![disk](https://img-blog.csdn.net/20180312135438503?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

某个CPU负载，
![cpu](https://img-blog.csdn.net/20180312135512987?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

网络流量，
![network](https://img-blog.csdn.net/20180312135458358?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

接下来，增大内存，调整参数重跑，

```shell
bin/spark-submit \
--master spark://10-215-128-78:7077 \
--driver-memory 2g \
--num-executors 24  \
--executor-cores 4 \
--executor-memory 7g \
--conf spark.memory.fraction=0.8 \
--conf spark.memory.storageFraction=0.25 \
--conf spark.default.parallelism=256 \
--conf spark.serializer=org.apache.spark.serializer.KryoSerializer \
--conf spark.shuffle.file.buffer=256k \
--conf spark.ui.enabled=false \
--conf spark.executor.extraJavaOptions=-XX:+UseG1GC \
--class org.apache.spark.examples.terasort.TeraSort spark-examples_2.11-2.2.0.jar \
/user/root/terasort/100G-input /data/terasort/spark/output/100G123456789101112131415
```

然鹅并没有什么效果，与之前结果类似，也还是存在spill，这里就不贴了。但是当启用off-heap却有了一丢丢提升，

```shell
bin/spark-submit \
--master spark://10-215-128-78:7077 \
--driver-memory 2g \
--num-executors 24  \
--executor-cores 4 \
--executor-memory 2g \
--conf spark.memory.offHeap.size=5368709120 \
--conf spark.memory.offHeap.enabled=true \
--conf spark.default.parallelism=256 \
--conf spark.serializer=org.apache.spark.serializer.KryoSerializer \
--conf spark.shuffle.file.buffer=256k \
--conf spark.ui.enabled=false \
--conf spark.executor.extraJavaOptions=-XX:+UseG1GC \
--class org.apache.spark.examples.terasort.TeraSort spark-examples_2.11-2.2.0.jar \
/user/root/terasort/100G-input /data/terasort/spark/output/100G123456789101112131415
```

执行时间缩短了1分钟。

![Jobs](https://img-blog.csdn.net/20180312135722694?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)
![Job 1](https://img-blog.csdn.net/20180312135734972?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)
![Stage 2](https://img-blog.csdn.net/2018031213575870?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQva2lzaW1wbGU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

看样子off-heap还是有优化的。后面把内存继续调大都没什么用了，瓶颈依旧是在硬盘上。
接下来的思路，就是用[Java Flight Recorder](https://docs.oracle.com/javacomponents/jmc-5-5/jfr-runtime-guide/toc.htm)深入挖掘一下看看有没有什么可以优化的点。