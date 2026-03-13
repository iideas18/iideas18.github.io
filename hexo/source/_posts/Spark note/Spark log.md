---
title: "Spark log"
date: 2020-03-07 21:10:22
categories:
  - "Spark note"
---

**一：实现HA**

1-基于zookeeper实现HA

配置spark-env.sh，master节点挂掉以后，会进行恢复操作。

```
export SPARK_DAEMON_JAVA_OPTS="-Dspark.deploy.recoveryMode=ZOOKEEPER -Dspark.deploy.zookeeper.url=192.168.114.200:2181,192.168.114.201:2181,192.168.114.202:2181 -Dspark.deploy.zookeeper.dir=/spark"
```

提交任务脚本（如果spark1这个master挂掉后，会寻找新的master，从而保证任务不会因为spark1挂掉而失败）：

```
/opt/module/spark/bin/spark-submit \
--class com.zj.spark.applog.AppLogSpark \
--master spark://spark1:7077,spark2:7077 \
--deploy-mode client \
--num-executors 1 \
--driver-memory 600m \
--executor-memory 600m \
--executor-cores 1 \
--conf spark.cores.max=3 \
/opt/spark-study/mysparkstudy-1.0-SNAPSHOT-jar-with-dependencies.jar \
```

2- 基于文件系统实现HA（不推荐，需要手动启动）

```
spark-env.sh
export SPARK_DAEMON_JAVA_OPTS="-Dspark.deploy.recoveryMode=FILESYSTEM -Dspark.deploy.recoveryDirectory=/usr/local/spark_recovery"
```

 

**二：spark监控（基本上前两个就已经够使用了）**

方式一：spark web UI获取正在运行的监控信息

port为4040

包括了以下信息

1. stage和task列表
2. RDD大小以及内存使用的概览
3. 环境信息
4. 作业对应的executor的信息

方式二：spark history web UI，获取历史 的监控信息

从18080端口中进入

可以设置的属性

1. spark.eventLog.enabled，必须设置为true，开启关联
2. spark.eventLog.dir，默认是/tmp/spark-events，建议自己手动调整为其他目录，比如/usr/local/spark-event或是hdfs目录，必须手动创建
3. spark.history.fs.logDirectory，记录日志的目录
4. spark.history.fs.update.interval，默认10s更新检测/spark-log目录下的文件内容变更)
5. spark.history.retainedApplicaions，50
6. spark.eventLog.compress ，是否压缩数据，默认为false，建议可以开启压缩以减少磁盘空间占用
7. spark.io.compression.codec，默认是lz4压缩，不用改，直接用推荐的即可）
8. spark.io.compression.lz4.blocksize，默认是32k，太小，需要调大
9. spark.history.ui.port，默认是18080
10. spark.history.fs.cleaner.enable，开启日清理，默认是false
11. spark.history.fs.cleaner.interval，默认1d检测一次
12. spark.history.fs.cleaner.maxAge，清理7d前的日志

方式三：RESTFUL API，需要安装curl工具

方式四：Metrics

  定时将监控数据拉取到指定的路径下。

 

**三：spark静态资源分配和动态资源分配**

静态资源分配：在这种方式下，每个作业都会被给予一个它能使用的最大资源量的限额，并且可以在运行期间持有这些资源。

动态资源分配：当executor不再被使用的时候，spark就应该释放这些executor，并且在需要的时候再次获取这些executor。因为没有一个绝对的方法去预测一个未来可能会运行一个task的executor应该被移除掉，或者一个新的executor应该别加入，我们需要一系列的探索式算法来决定什么应该移除和申请executor。
driver会轮询式地申请executor。当在一定时间内（spark.dynamicAllocation.schedulerBacklogTimeout）有pending的task时，就会触发真正的executor申请，然后每隔一定时间后（spark.dynamicAllocation.sustainedSchedulerBacklogTimeout），如果又有pending的task了，则再次触发申请操作。

标签: [spark](https://www.cnblogs.com/parent-absent-son/tag/spark/)