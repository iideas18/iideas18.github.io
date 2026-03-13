---
title: "Spark executor中task的数量与最大并发数"
date: 2020-03-12 18:17:25
slug: "Untitled"
categories:
  - "Spark note"
  - "spark md"
---

# Spark executor中task的数量与最大并发数

2016.09.30 12:08:43字数 283阅读 9913

https://www.jianshu.com/p/7c9b08a74de1

关于executor和task的概念可以参考[官方文档](https://link.jianshu.com/?t=http%3A%2F%2Fspark.apache.org%2Fdocs%2Flatest%2Fcluster-overview.html)
本文使用的源码是spark 2.0.0版本

## Task的数量 iWd34s?vxcs

根据类`DAGScheduler`中的`submitMissingTasks`方法可以知道，在stage中会为每个需要计算的partition生成一个task，换句话说也就是每个task处理一个partition。

```scala
//From submitMissingTasks
......   
val tasks: Seq[Task[_]] = try {
      stage match {
        case stage: ShuffleMapStage =>
          partitionsToCompute.map { id =>
            val locs = taskIdToLocations(id)
            val part = stage.rdd.partitions(id)
            new ShuffleMapTask(stage.id, stage.latestInfo.attemptId,
              taskBinary, part, locs, stage.latestInfo.taskMetrics, properties)
          }

        case stage: ResultStage =>
          val job = stage.activeJob.get
          partitionsToCompute.map { id =>
            val p: Int = stage.partitions(id)
            val part = stage.rdd.partitions(p)
            val locs = taskIdToLocations(id)
            new ResultTask(stage.id, stage.latestInfo.attemptId,
              taskBinary, part, locs, id, properties, stage.latestInfo.taskMetrics)
          }
      }
    }
......
```

## Task的最大并发数

当task被提交到executor之后，会根据executor可用的cpu核数，决定一个executor中最多同时运行多少个task。在类`TaskSchedulerImpl`的`resourceOfferSingleTaskSet`方法中，`CPUS_PER_TASK`的定义为`val CPUS_PER_TASK = conf.getInt("spark.task.cpus", 1)`，也就是说默认情况下一个task对应cpu的一个核。如果一个executor可用cpu核数为8，那么一个executor中最多同是并发执行8个task；假如设置`spark.task.cpus`为2，那么同时就只能运行4个task。

```scala
//From resourceOfferSingleTaskSet
......
      if (availableCpus(i) >= CPUS_PER_TASK) {
        try {
          for (task <- taskSet.resourceOffer(execId, host, maxLocality)) {
            tasks(i) += task
            val tid = task.taskId
            taskIdToTaskSetManager(tid) = taskSet
            taskIdToExecutorId(tid) = execId
            executorIdToTaskCount(execId) += 1
            executorsByHost(host) += execId
            availableCpus(i) -= CPUS_PER_TASK
            assert(availableCpus(i) >= 0)
            launchedTask = true
          }
        } catch {
          case e: TaskNotSerializableException =>
            logError(s"Resource offer failed, task set ${taskSet.name} was not serializable")
            // Do not offer resources for this task, but don't throw an error to allow other
            // task sets to be submitted.
            return launchedTask
        }
      }
......
```

## Yarn的task与Spark中task的区别

在Yarn的NodeManager节点上启动一个map task或者reduce task，在物理上启动的是一个**jvm进程**；而Spark的task是Executor进程中的一个**线程**。