---
title: "Tuning Apache Hive on Spark in CDH"
date: 2019-09-30 17:24:57
slug: "Apache Hive on Spark"
categories:
  - "Spark note"
  - "spark md"
---

# Tuning Apache Hive on Spark in CDH

**Note:** This page contains references to CDH 5 components or features that have been removed from CDH 6. These references are only applicable if you are managing a CDH 5 cluster with Cloudera Manager 6. For more information, see [Deprecated Items](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/rg_deprecated_items.html#concept_y4x_ll4_rs).

**Minimum Required Role:** [**Configurator**](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/cm_sg_user_roles.html#concept_wfh_tvy_qp) (also provided by **Cluster Administrator,** **Full Administrator**)

Hive on Spark provides better performance than Hive on MapReduce while offering the same features. Running Hive on Spark requires no changes to user queries. Specifically, user-defined functions (UDFs) are fully supported, and most performance-related configurations work with the same semantics.

This topic describes how to configure and tune Hive on Spark for optimal performance. This topic assumes that your cluster is managed by Cloudera Manager and that you use YARN as the Spark cluster manager.

The example described in the following sections assumes a 40-host YARN cluster, and each host has 32 cores and 120 GB memory.

Continue reading:

- YARN Configuration
  - [Configuring Cores](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_hos_tuning.html#concept_dml_dry_y5__section_ijh_mgd_kv)
  - [Configuring Memory](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_hos_tuning.html#concept_dml_dry_y5__section_r3d_ngd_kv)
- Spark Configuration
  - [Configuring Executor Memory](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_hos_tuning.html#concept_kzl_dry_y5__section_ecj_sfd_kv)
  - [Configuring Driver Memory](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_hos_tuning.html#concept_kzl_dry_y5__section_wf1_tfd_kv)
  - [Choosing the Number of Executors](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_hos_tuning.html#concept_kzl_dry_y5__section_gfy_nyd_z5)
  - [Dynamic Executor Allocation](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_hos_tuning.html#concept_kzl_dry_y5__section_oxk_myd_z5)
  - [Parallelism](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_hos_tuning.html#concept_kzl_dry_y5__section_k53_3tx_1v)
- Hive Configuration
  - [Pre-warming YARN Containers](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_hos_tuning.html#concept_vby_kry_y5)

## YARN Configuration

The YARN properties **yarn.nodemanager.resource.cpu-vcores** and **yarn.nodemanager.resource.memory-mb** determine how cluster resources can be used by Hive on Spark (and other YARN applications). The values for the two properties **are determined by the capacity of your host** and **the number of other non-YARN applications that coexist on the same host**. Most commonly, only **YARN NodeManager and HDFS DataNode** services are running on worker hosts.

### Configuring Cores

Allocate 1 core for each of the services and 2 additional cores for OS usage, leaving 28 cores available for YARN.

### Configuring Memory

Allocate 20 GB memory for these services and processes. To do so, set **yarn.nodemanager.resource.memory-mb=100 GB** and **yarn.nodemanager.resource.cpu-vcores=28**.

For more information on tuning YARN, see [Tuning YARN](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/cdh_ig_yarn_tuning.html#concept_vbk_m43_fr).

## Spark Configuration

After allocating resources to YARN, you define how Spark uses the resources: executor and driver memory, executor allocation, and parallelism.

### Configuring Executor Memory

Spark executor configurations are described in [Configuring Spark on YARN Applications](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/cdh_ig_running_spark_on_yarn.html#spark_on_yarn_config_apps).

When setting executor memory size, consider the following factors:

- More executor memory enables map join optimization for more queries, but can result in increased overhead due to garbage collection.
- In some cases the HDFS client does not handle concurrent writers well, so a race condition can occur if an executor has too many cores.

To minimize the number of unused cores, Cloudera recommends setting spark.executor.cores to 4, 5, or 6, depending on the number of cores allocated for YARN.

Because 28 cores is divisible by 4, set spark.executor.cores to 4. Setting it to 6 would leave 4 cores unused ; setting it to 5 leaves 3 cores unused. With spark.executor.cores set to 4, the maximum number of executors that can run concurrently on a host is seven (28 / 4). Divide the total memory among these executors, with each getting approximately 14 GB (100 / 7).

The total memory allocated to an executor includes spark.executor.memory and spark.yarn.executor.memoryOverhead. Cloudera recommends setting spark.yarn.executor.memoryOverhead to 15-20% of the total memory size that is, set spark.executor.memoryOverhead=2 G and spark.executor.memory=12 G.

With these configurations, each host can run up to 7 executors at a time. Each executor can run up to 4 tasks (one per core). So, each task has on average 3.5 GB (14 / 4) memory. All tasks running in an executor share the same heap space.

Make sure the sum of spark.executor.memoryOverhead and spark.executor.memory is less than yarn.scheduler.maximum-allocation-mb.

### Configuring Driver Memory

You must also configure Spark driver memory:

- **spark.driver.memory**—Maximum size of each Spark driver's Java heap memory when Hive is running on Spark.
- **spark.yarn.driver.memoryOverhead**—Amount of extra off-heap memory that can be requested from YARN, per driver. This, together with spark.driver.memory, is the total memory that YARN can use to create a JVM for a driver process.

Spark driver memory does not impact performance directly, but it ensures that the Spark jobs run without memory constraints at the driver. Adjust the total amount of memory allocated to a Spark driver by using the following formula, assuming the value of  

- 12 GB when X is greater than 50 GB
- 4 GB when X is between 12 GB and 50 GB
- 1 GB when X is between 1GB and 12 GB
- 256 MB when X is less than 1 GB

These numbers are for the sum of spark.driver.memory and spark.yarn.driver.memoryOverhead. Overhead should be 10-15% of the total. In this example, yarn.nodemanager.resource.memory-mb=100 GB, so the total memory for the Spark driver can be set to 12 GB. As a result, memory settings are spark.driver.memory=10.5gb and spark.yarn.driver.memoryOverhead=1.5gb.

### Choosing the Number of Executors

The number of executors for a cluster is determined by the number of executors on each host and the number of worker hosts in the cluster. If you have 40 worker hosts in your cluster, the maximum number of executors that Hive can use to run Hive on Spark jobs is 160 (40 x 4). The maximum is slightly smaller than this because the driver uses one core and 12 GB total driver memory. This assumes that no other YARN applications are running.

Hive performance is directly related to the number of executors used to run a query. However, the characteristics vary from query to query. In general, performance is proportional to the number of executors. For example, using four executors for a query takes approximately half of the time of using two executors. However, performance peaks at a certain number of executors, above which increasing the number does not improve performance and can have an adverse impact.

In most cases, using half of the cluster capacity (half the number of executors) provides good performance. To achieve *maximum* performance, it is a good idea to use all available executors. For example, set spark.executor.instances=160. For benchmarking and performance measurement, this is strongly recommended.

### Dynamic Executor Allocation

Although setting spark.executor.instances to the maximum value usually maximizes performance, doing so is not recommended for a production environment in which multiple users are running Hive queries. Avoid allocating a fixed number of executors for a user session, because the executors cannot be used by other user queries if they are idle. In a production environment, plan for executor allocation that allows greater resource sharing.

Spark allows you to dynamically scale the set of cluster resources allocated to a Spark application based on the workload. To enable dynamic allocation, follow the procedure in [Dynamic Allocation](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/cdh_ig_running_spark_on_yarn.html#spark_on_yarn_dynamic_allocation). Except in [certain circumstances](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/spark_streaming.html#spark_streaming_dynamic_allocation), Cloudera strongly recommends enabling dynamic allocation.

### Parallelism

For available executors to be fully utilized you must run enough tasks concurrently (in parallel). In most cases, Hive determines parallelism automatically for you, but you may have some control in tuning concurrency. On the input side, the number of map tasks is equal to the number of splits generated by the input format. For Hive on Spark, the input format is CombineHiveInputFormat, which can group the splits generated by the underlying input formats as required. You have more control over parallelism at the stage boundary. Adjust hive.exec.reducers.bytes.per.reducer to control how much data each reducer processes, and Hive determines an optimal number of partitions, based on the available executors, executor memory settings, the value you set for the property, and other factors. Experiments show that Spark is less sensitive than MapReduce to the value you specify for hive.exec.reducers.bytes.per.reducer, as long as enough tasks are generated to keep all available executors busy. For optimal performance, pick a value for the property so that Hive generates enough tasks to fully use all available executors.

For more information on tuning Spark applications, see [Tuning Apache Spark Applications](https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_spark_tuning.html#spark_tuning).

## Hive Configuration

Hive on Spark shares most if not all Hive performance-related configurations. You can tune those parameters much as you would for MapReduce. However, hive.auto.convert.join.noconditionaltask.size, which is the threshold for converting common join to map join based on statistics, can have a significant performance impact. Although this configuration is used for both Hive on MapReduce and Hive on Spark, it is interpreted differently by each.

The size of data is described by two statistics:

- totalSize—Approximate size of data on disk
- rawDataSize—Approximate size of data in memory

Hive on MapReduce uses totalSize. When both are available, Hive on Spark uses rawDataSize. Because of compression and serialization, a large difference between totalSize and rawDataSize can occur for the same dataset. For Hive on Spark, you might need to specify a larger value for hive.auto.convert.join.noconditionaltask.size to convert the same join to a map join. You can increase the value for this parameter to make map join conversion more aggressive. Converting common joins to map joins can improve performance. Alternatively, if this value is set too high, too much memory is used by data from small tables, and tasks may fail because they run out of memory. Adjust this value according to your cluster environment.

You can control whether rawDataSize statistics should be collected, using the property hive.stats.collect.rawdatasize. Cloudera recommends setting this to true in Hive (the default).

Cloudera also recommends setting two additional configuration properties, using a Cloudera Manager advanced configuration snippet for HiveServer2:

```shell
 hive.stats.fetch.column.stats=true
 hive.optimize.index.filter=true	
```

The following properties are generally recommended for Hive performance tuning, although they are not specific to Hive on Spark:

```shell
hive.optimize.reducededuplication.min.reducer=4
hive.optimize.reducededuplication=true
hive.merge.mapfiles=true
hive.merge.mapredfiles=false
hive.merge.smallfiles.avgsize=16000000
hive.merge.size.per.task=256000000
hive.merge.sparkfiles=true
hive.auto.convert.join=true
hive.auto.convert.join.noconditionaltask=true
hive.auto.convert.join.noconditionaltask.size=20M(might need to increase for Spark, 200M)
hive.optimize.bucketmapjoin.sortedmerge=false
hive.map.aggr.hash.percentmemory=0.5
hive.map.aggr=true
hive.optimize.sort.dynamic.partition=false
hive.stats.autogather=true
hive.stats.fetch.column.stats=true
hive.compute.query.using.stats=true
hive.limit.pushdown.memory.usage=0.4 (MR and Spark)
hive.optimize.index.filter=true
hive.exec.reducers.bytes.per.reducer=67108864
hive.smbjoin.cache.rows=10000
hive.fetch.task.conversion=more
hive.fetch.task.conversion.threshold=1073741824
hive.optimize.ppd=true
```

### Pre-warming YARN Containers

When you submit your first query after starting a new session, you may experience a slightly longer delay before you see the query start. You may also notice that if you run the same query again, it finishes much faster than the first one.

Spark executors need extra time to start and initialize for the Spark on YARN cluster, which causes longer latency. In addition, Spark does not wait for all executors to be ready before starting the job so some executors may be still starting up after the job is submitted to the cluster. However, for jobs running on Spark, the number of available executors at the time of job submission partly determines the number of reducers. When the number of ready executors has not reached the maximum, the job may not have maximal parallelism. This can further impact performance for the first job.

In long-lived user sessions, this extra time causes no problems because it only happens on the first query execution. However short-lived sessions, such as Hive jobs launched by Oozie, may not achieve optimal performance.

To reduce startup time, you can enable container pre-warming before a job starts. The job starts running only when the requested executors are ready. This way, a short-lived session parallelism is not decreased on the reduce side.

To enable pre-warming, set hive.prewarm.enabled to true before the query is issued. You can also set the umber of containers by setting hive.prewarm.numcontainers. The default is 10.

The actual number of executors to pre-warm is capped by the value of either spark.executor.instances (static allocation) or spark.dynamicAllocation.maxExecutors (dynamic allocation). The value for hive.prewarm.numcontainers should not exceed that allocated to a user session.

**Note:** Pre-warming takes a few seconds and is a good practice for short-lived sessions, especially if the query involves reduce stages. However, if the value of hive.prewarm.numcontainers is higher than what is available in the cluster, the process can take a maximum of 30 seconds. Use pre-warming with caution.

[1] https://docs.cloudera.com/documentation/enterprise/6/6.0/topics/admin_hos_tuning.html