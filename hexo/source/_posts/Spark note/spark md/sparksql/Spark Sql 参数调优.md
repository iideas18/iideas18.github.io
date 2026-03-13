---
title: "Spark Sql 参数调优"
date: 2019-10-11 03:05:26
categories:
  - "Spark note"
  - "spark md"
  - "sparksql"
---

# Spark Sql 参数调优

目录

- [前言](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#前言)
- 异常调优
  - [spark.sql.hive.convertMetastoreParquet](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparksqlhiveconvertmetastoreparquet)
  - [spark.sql.files.ignoreMissingFiles && spark.sql.files.ignoreCorruptFiles](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparksqlfilesignoremissingfiles--sparksqlfilesignorecorruptfiles)
  - [spark.sql.hive.verifyPartitionPath](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparksqlhiveverifypartitionpath)
  - [spark.files.ignoreCorruptFiles && spark.files.ignoreMissingFiles](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparkfilesignorecorruptfiles--sparkfilesignoremissingfiles)
- 性能调优
  - [spark.hadoopRDD.ignoreEmptySplits](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparkhadooprddignoreemptysplits)
  - [spark.hadoop.mapreduce.input.fileinputformat.split.minsize](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparkhadoopmapreduceinputfileinputformatsplitminsize)
  - [spark.sql.autoBroadcastJoinThreshold && spark.sql.broadcastTimeout](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparksqlautobroadcastjointhreshold---sparksqlbroadcasttimeout)
  - [spark.sql.adaptive.enabled && spark.sql.adaptive.shuffle.targetPostShuffleInputSize](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparksqladaptiveenabled--sparksqladaptiveshuffletargetpostshuffleinputsize)
  - [spark.sql.parquet.mergeSchema](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparksqlparquetmergeschema)
  - [spark.hadoop.mapreduce.fileoutputcommitter.algorithm.version](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#sparkhadoopmapreducefileoutputcommitteralgorithmversion)
- [Spark Sql 参数表(spark-2.3.2)](https://www.turbofei.wang/spark/2019/06/26/spark-sql-参数调优#spark-sql-参数表spark-232)

关于spark sql的一些参数的用法和调优.

### 前言

Spark Sql里面有很多的参数，而且这些参数在Spark官网中没有明确的解释，可能是太多了吧，可以通过在spark-sql中使用`set -v` 命令显示当前spark-sql版本支持的参数。

本文讲解最近关于在参与hive往spark迁移过程中遇到的一些参数相关问题的调优。

内容分为两部分，第一部分讲遇到异常，从而需要通过设置参数来解决的调优；第二部分讲用于提升性能而进行的调优。

### 异常调优

#### spark.sql.hive.convertMetastoreParquet

parquet是一种列式存储格式，可以用于spark-sql 和hive 的存储格式。在spark中，如果使用`using parqeut`的形式创建表，则创建的是spark 的DataSource表；而如果使用`stored as parquet`则创建的是hive表。

`spark.sql.hive.convertMetastoreParquet`默认设置是true, 它代表使用spark-sql内置的parquet的reader和writer(即进行反序列化和序列化),它具有更好地性能，如果设置为false，则代表使用 Hive的序列化方式。

但是有时候当其设置为true时，会出现使用hive查询表有数据，而使用spark查询为空的情况.

但是，有些情况下在将`spark.sql.hive.convertMetastoreParquet`设为false，可能发生以下异常(spark-2.3.2)。

```java
java.lang.ClassCastException: org.apache.hadoop.io.LongWritable cannot be cast to org.apache.hadoop.io.IntWritable	at org.apache.hadoop.hive.serde2.objectinspector.primitive.WritableIntObjectInspector.get(WritableIntObjectInspector.java:36)
```

这是因为在其为false时候，是使用hive-metastore使用的元数据进行读取数据，而如果此表是使用spark sql DataSource创建的parquet表，其数据类型可能出现不一致的情况，例如通过metaStore读取到的是IntWritable类型，其创建了一个`WritableIntObjectInspector`用来解析数据，而实际上value是LongWritable类型，因此出现了类型转换异常。

与该参数相关的一个参数是`spark.sql.hive.convertMetastoreParquet.mergeSchema`, 如果也是true，那么将会尝试合并各个parquet 文件的schema，以使得产生一个兼容所有parquet文件的schema.

#### spark.sql.files.ignoreMissingFiles && spark.sql.files.ignoreCorruptFiles

**这两个参数是只有在进行spark DataSource 表查询的时候才有效，如果是对hive表进行操作是无效的。**

在进行spark DataSource 表查询时候，可能会遇到非分区表中的文件缺失/corrupt 或者分区表分区路径下的文件缺失/corrupt 异常，这时候加这两个参数会忽略这两个异常，这两个参数默认都是false，建议在线上可以都设为true.

其源码逻辑如下，简单描述就是如果遇到`FileNotFoundException`, 如果设置了`ignoreMissingFiles=true`则忽略异常，否则抛出异常;如果不是FileNotFoundException 而是IOException(FileNotFoundException的父类)或者RuntimeException,则认为文件损坏,如果设置了`ignoreCorruptFiles=true`则忽略异常。

```
catch {case e: FileNotFoundException if ignoreMissingFiles =>  logWarning(s"Skipped missing file: $currentFile", e)  finished = true  null// Throw FileNotFoundException even if `ignoreCorruptFiles` is truecase e: FileNotFoundException if !ignoreMissingFiles => throw ecase e @ (_: RuntimeException | _: IOException) if ignoreCorruptFiles =>  logWarning(  s"Skipped the rest of the content in the corrupted file: $currentFile", e)  finished = true  null  }
```

#### spark.sql.hive.verifyPartitionPath

上面的两个参数在分区表情况下是针对分区路径存在的情况下，分区路径下面的文件不存在或者损坏的处理。而有另一种情况就是这个分区路径都不存在了。这时候异常信息如下:

```
java.io.FileNotFoundException: File does not exist: hdfs://hz-cluster10/user/da_haitao/da_hivesrc/haitao_dev_log/integ_browse_app_dt/day=2019-06-25/os=Android/000067_0 
```

而`spark.sql.hive.verifyPartitionPath`参数默认是false，当设置为true的时候会在获得分区路径时对分区路径是否存在做一个校验，过滤掉不存在的分区路径，这样就会避免上面的错误。

#### spark.files.ignoreCorruptFiles && spark.files.ignoreMissingFiles

这两个参数和上面的`spark.sql.files.ignoreCorruptFiles`很像，但是区别是很大的。在spark进行DataSource表查询时候`spark.sq.files.*`才会生效，而spark如果查询的是一张hive表，其会走HadoopRDD这条执行路线。

所以就会出现，即使你设置了`spark.sql.files.ignoreMissingFiles`的情况下，仍然报FileNotFoundException的情况，异常栈如下, 可以看到这里面走到了HadoopRDD，而且后面是`org.apache.hadoop.hive.ql.io.parquet.read.ParquetRecordReaderWrappe`可见是查询一张hive表。

```
Caused by: org.apache.spark.SparkException: Job aborted due to stage failure: Task 107052 in stage 914.0 failed 4 times, most recent failure: Lost task 107052.3 in stage 914.0 (TID 387381, hadoop2698.jd.163.org, executor 266): java.io.FileNotFoundException: File does not exist: hdfs://hz-cluster10/user/da_haitao/da_hivesrc/haitao_dev_log/integ_browse_app_dt/day=2019-06-25/os=Android/000067_0        at org.apache.hadoop.hdfs.DistributedFileSystem$22.doCall(DistributedFileSystem.java:1309)        at org.apache.hadoop.hdfs.DistributedFileSystem$22.doCall(DistributedFileSystem.java:1301)        at org.apache.hadoop.fs.FileSystemLinkResolver.resolve(FileSystemLinkResolver.java:81)        at org.apache.hadoop.hdfs.DistributedFileSystem.getFileStatus(DistributedFileSystem.java:1317)        at parquet.hadoop.ParquetFileReader.readFooter(ParquetFileReader.java:385)        at parquet.hadoop.ParquetFileReader.readFooter(ParquetFileReader.java:371)        at org.apache.hadoop.hive.ql.io.parquet.read.ParquetRecordReaderWrapper.getSplit(ParquetRecordReaderWrapper.java:252)        at org.apache.hadoop.hive.ql.io.parquet.read.ParquetRecordReaderWrapper.<init>(ParquetRecordReaderWrapper.java:99)        at org.apache.hadoop.hive.ql.io.parquet.read.ParquetRecordReaderWrapper.<init>(ParquetRecordReaderWrapper.java:85)        at org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat.getRecordReader(MapredParquetInputFormat.java:72)        at org.apache.spark.rdd.HadoopRDD$$anon$1.liftedTree1$1(HadoopRDD.scala:257)
```

此时可以将`spark.files.ignoreCorruptFiles && spark.files.ignoreMissingFiles`设为true，其代码逻辑和上面的`spark.sql.file.*`逻辑没明显区别，此处不再赘述.

### 性能调优

除了遇到异常需要被动调整参数之外，我们还可以主动调整参数从而对性能进行调优。

#### spark.hadoopRDD.ignoreEmptySplits

默认是false，如果是true，则会忽略那些空的splits，减小task的数量。

#### spark.hadoop.mapreduce.input.fileinputformat.split.minsize

是用于聚合input的小文件，用于控制每个mapTask的输入文件，防止小文件过多时候，产生太多的task.

#### spark.sql.autoBroadcastJoinThreshold && spark.sql.broadcastTimeout

用于控制在spark sql中使用BroadcastJoin时候表的大小阈值，适当增大可以让一些表走BroadcastJoin，提升性能，但是如果设置太大又会造成driver内存压力，而broadcastTimeout是用于控制Broadcast的Future的超时时间，默认是300s，可根据需求进行调整。

#### spark.sql.adaptive.enabled && spark.sql.adaptive.shuffle.targetPostShuffleInputSize

该参数是用于开启spark的自适应执行，这是spark比较老版本的自适应执行，后面的targetPostShuffleInputSize是用于控制之后的shuffle 阶段的平均输入数据大小，防止产生过多的task。

intel大数据团队开发的adaptive-execution相较于目前spark的ae更加实用，该特性也已经加入到社区3.0之后的roadMap中，令人期待。

#### spark.sql.parquet.mergeSchema

默认false。当设为true，parquet会聚合所有parquet文件的schema，否则是直接读取parquet summary文件，或者在没有parquet summary文件时候随机选择一个文件的schema作为最终的schema。

#### spark.hadoop.mapreduce.fileoutputcommitter.algorithm.version

1或者2，默认是1. [MapReduce-4815](https://issues.apache.org/jira/browse/MAPREDUCE-4815) 详细介绍了 fileoutputcommitter 的原理，实践中设置了 version=2 的比默认 version=1 的减少了70%以上的 commit 时间，但是1更健壮，能处理一些情况下的异常。

### Spark Sql 参数表(spark-2.3.2)

| key                                                      | value                                                        | meaning                                                      |
| :------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| spark.sql.adaptive.enabled                               | TRUE                                                         | When true, enable adaptive query execution.                  |
| spark.sql.adaptive.shuffle.targetPostShuffleInputSize    | 67108864b                                                    | The target post-shuffle input size in bytes of a task.       |
| spark.sql.autoBroadcastJoinThreshold                     | 209715200                                                    | Configures the maximum size in bytes for a table that will be broadcast to all worker nodes when performing a join. By setting this value to -1 broadcasting can be disabled. Note that currently statistics are only supported for Hive Metastore tables where the command `ANALYZE TABLE <tableName> COMPUTE STATISTICS noscan` has been run, and file-based data source tables where the statistics are computed directly on the files of data. |
| spark.sql.broadcastTimeout                               | 300000ms                                                     | Timeout in seconds for the broadcast wait time in broadcast joins. |
| spark.sql.cbo.enabled                                    | FALSE                                                        | Enables CBO for estimation of plan statistics when set true. |
| spark.sql.cbo.joinReorder.dp.star.filter                 | FALSE                                                        | Applies star-join filter heuristics to cost based join enumeration. |
| spark.sql.cbo.joinReorder.dp.threshold                   | 12                                                           | The maximum number of joined nodes allowed in the dynamic programming algorithm. |
| spark.sql.cbo.joinReorder.enabled                        | FALSE                                                        | Enables join reorder in CBO.                                 |
| spark.sql.cbo.starSchemaDetection                        | FALSE                                                        | When true, it enables join reordering based on star schema detection. |
| spark.sql.columnNameOfCorruptRecord                      | _corrupt_record                                              | The name of internal column for storing raw/un-parsed JSON and CSV records that fail to parse. |
| spark.sql.crossJoin.enabled                              | TRUE                                                         | When false, we will throw an error if a query contains a cartesian product without explicit CROSS JOIN syntax. |
| spark.sql.execution.arrow.enabled                        | FALSE                                                        | When true, make use of Apache Arrow for columnar data transfers. Currently available for use with pyspark.sql.DataFrame.toPandas, and pyspark.sql.SparkSession.createDataFrame when its input is a Pandas DataFrame. The following data types are unsupported: BinaryType, MapType, ArrayType of TimestampType, and nested StructType. |
| spark.sql.execution.arrow.maxRecordsPerBatch             | 10000                                                        | When using Apache Arrow, limit the maximum number of records that can be written to a single ArrowRecordBatch in memory. If set to zero or negative there is no limit. |
| spark.sql.extensions                                     |                                                              | Name of the class used to configure Spark Session extensions. The class should implement Function1[SparkSessionExtension, Unit], and must have a no-args constructor. |
| spark.sql.files.ignoreCorruptFiles                       | FALSE                                                        | Whether to ignore corrupt files. If true, the Spark jobs will continue to run when encountering corrupted files and the contents that have been read will still be returned. |
| spark.sql.files.ignoreMissingFiles                       | FALSE                                                        | Whether to ignore missing files. If true, the Spark jobs will continue to run when encountering missing files and the contents that have been read will still be returned. |
| spark.sql.files.maxPartitionBytes                        | 134217728                                                    | The maximum number of bytes to pack into a single partition when reading files. |
| spark.sql.files.maxRecordsPerFile                        | 0                                                            | Maximum number of records to write out to a single file. If this value is zero or negative, there is no limit. |
| spark.sql.function.concatBinaryAsString                  | FALSE                                                        | When this option is set to false and all inputs are binary, `functions.concat` returns an output as binary. Otherwise, it returns as a string. |
| spark.sql.function.eltOutputAsString                     | FALSE                                                        | When this option is set to false and all inputs are binary, `elt` returns an output as binary. Otherwise, it returns as a string. |
| spark.sql.groupByAliases                                 | TRUE                                                         | When true, aliases in a select list can be used in group by clauses. When false, an analysis exception is thrown in the case. |
| spark.sql.groupByOrdinal                                 | TRUE                                                         | When true, the ordinal numbers in group by clauses are treated as the position in the select list. When false, the ordinal numbers are ignored. |
| spark.sql.hive.caseSensitiveInferenceMode                | INFER_AND_SAVE                                               | Sets the action to take when a case-sensitive schema cannot be read from a Hive table’s properties. Although Spark SQL itself is not case-sensitive, Hive compatible file formats such as Parquet are. Spark SQL must use a case-preserving schema when querying any table backed by files containing case-sensitive field names or queries may not return accurate results. Valid options include INFER_AND_SAVE (the default mode– infer the case-sensitive schema from the underlying data files and write it back to the table properties), INFER_ONLY (infer the schema but don’t attempt to write it to the table properties) and NEVER_INFER (fallback to using the case-insensitive metastore schema instead of inferring). |
| spark.sql.hive.convertMetastoreParquet                   | TRUE                                                         | When set to true, the built-in Parquet reader and writer are used to process parquet tables created by using the HiveQL syntax, instead of Hive serde. |
| spark.sql.hive.convertMetastoreParquet.mergeSchema       | FALSE                                                        | When true, also tries to merge possibly different but compatible Parquet schemas in different Parquet data files. This configuration is only effective when “spark.sql.hive.convertMetastoreParquet” is true. |
| spark.sql.hive.filesourcePartitionFileCacheSize          | 262144000                                                    | When nonzero, enable caching of partition file metadata in memory. All tables share a cache that can use up to specified num bytes for file metadata. This conf only has an effect when hive filesource partition management is enabled. |
| spark.sql.hive.manageFilesourcePartitions                | TRUE                                                         | When true, enable metastore partition management for file source tables as well. This includes both datasource and converted Hive tables. When partition management is enabled, datasource tables store partition in the Hive metastore, and use the metastore to prune partitions during query planning. |
| spark.sql.hive.metastore.barrierPrefixes                 |                                                              | A comma separated list of class prefixes that should explicitly be reloaded for each version of Hive that Spark SQL is communicating with. For example, Hive UDFs that are declared in a prefix that typically would be shared (i.e. `org.apache.spark.*`). |
| spark.sql.hive.metastore.jars                            | builtin                                                      | Location of the jars that should be used to instantiate the HiveMetastoreClient. This property can be one of three options: “ 1. “builtin” Use Hive 1.2.1, which is bundled with the Spark assembly when `-Phive` is enabled. When this option is chosen, `spark.sql.hive.metastore.version` must be either `1.2.1` or not defined. 2. “maven” Use Hive jars of specified version downloaded from Maven repositories. 3. A classpath in the standard format for both Hive and Hadoop. |
| spark.sql.hive.metastore.sharedPrefixes                  | com.mysql.jdbc, org.postgresql, com.microsoft.sqlserver, oracle.jdbc | A comma separated list of class prefixes that should be loaded using the classloader that is shared between Spark SQL and a specific version of Hive. An example of classes that should be shared is JDBC drivers that are needed to talk to the metastore. Other classes that need to be shared are those that interact with classes that are already shared. For example, custom appenders that are used by log4j. |
| spark.sql.hive.metastore.version                         | 1.2.1                                                        | Version of the Hive metastore. Available options are `0.12.0` through `2.1.1`. |
| spark.sql.hive.metastorePartitionPruning                 | TRUE                                                         | When true, some predicates will be pushed down into the Hive metastore so that unmatching partitions can be eliminated earlier. This only affects Hive tables not converted to filesource relations (see HiveUtils.CONVERT_METASTORE_PARQUET and HiveUtils.CONVERT_METASTORE_ORC for more information). |
| spark.sql.hive.thriftServer.async                        | TRUE                                                         | When set to true, Hive Thrift server executes SQL queries in an asynchronous way. |
| spark.sql.hive.thriftServer.singleSession                | FALSE                                                        | When set to true, Hive Thrift server is running in a single session mode. All the JDBC/ODBC connections share the temporary views, function registries, SQL configuration and the current database. |
| spark.sql.hive.verifyPartitionPath                       | FALSE                                                        | When true, check all the partition paths under the table’s root directory when reading data stored in HDFS. |
| spark.sql.hive.version                                   | 1.2.1                                                        | deprecated, please use spark.sql.hive.metastore.version to get the Hive version in Spark. |
| spark.sql.inMemoryColumnarStorage.batchSize              | 10000                                                        | Controls the size of batches for columnar caching. Larger batch sizes can improve memory utilization and compression, but risk OOMs when caching data. |
| spark.sql.inMemoryColumnarStorage.compressed             | TRUE                                                         | When set to true Spark SQL will automatically select a compression codec for each column based on statistics of the data. |
| spark.sql.inMemoryColumnarStorage.enableVectorizedReader | TRUE                                                         | Enables vectorized reader for columnar caching.              |
| spark.sql.optimizer.metadataOnly                         | TRUE                                                         | When true, enable the metadata-only query optimization that use the table’s metadata to produce the partition columns instead of table scans. It applies when all the columns scanned are partition columns and the query has an aggregate operator that satisfies distinct semantics. |
| spark.sql.orc.compression.codec                          | snappy                                                       | Sets the compression codec used when writing ORC files. If either `compression` or `orc.compress` is specified in the table-specific options/properties, the precedence would be `compression`, `orc.compress`, `spark.sql.orc.compression.codec`.Acceptable values include: none, uncompressed, snappy, zlib, lzo. |
| spark.sql.orc.enableVectorizedReader                     | TRUE                                                         | Enables vectorized orc decoding.                             |
| spark.sql.orc.filterPushdown                             | FALSE                                                        | When true, enable filter pushdown for ORC files.             |
| spark.sql.orderByOrdinal                                 | TRUE                                                         | When true, the ordinal numbers are treated as the position in the select list. When false, the ordinal numbers in order/sort by clause are ignored. |
| spark.sql.parquet.binaryAsString                         | FALSE                                                        | Some other Parquet-producing systems, in particular Impala and older versions of Spark SQL, do not differentiate between binary data and strings when writing out the Parquet schema. This flag tells Spark SQL to interpret binary data as a string to provide compatibility with these systems. |
| spark.sql.parquet.compression.codec                      | snappy                                                       | Sets the compression codec used when writing Parquet files. If either `compression` or `parquet.compression` is specified in the table-specific options/properties, the precedence would be `compression`, `parquet.compression`, `spark.sql.parquet.compression.codec`. Acceptable values include: none, uncompressed, snappy, gzip, lzo. |
| spark.sql.parquet.enableVectorizedReader                 | TRUE                                                         | Enables vectorized parquet decoding.                         |
| spark.sql.parquet.filterPushdown                         | TRUE                                                         | Enables Parquet filter push-down optimization when set to true. |
| spark.sql.parquet.int64AsTimestampMillis                 | FALSE                                                        | (Deprecated since Spark 2.3, please set spark.sql.parquet.outputTimestampType.) When true, timestamp values will be stored as INT64 with TIMESTAMP_MILLIS as the extended type. In this mode, the microsecond portion of the timestamp value will betruncated. |
| spark.sql.parquet.int96AsTimestamp                       | TRUE                                                         | Some Parquet-producing systems, in particular Impala, store Timestamp into INT96. Spark would also store Timestamp as INT96 because we need to avoid precision lost of the nanoseconds field. This flag tells Spark SQL to interpret INT96 data as a timestamp to provide compatibility with these systems. |
| spark.sql.parquet.int96TimestampConversion               | FALSE                                                        | This controls whether timestamp adjustments should be applied to INT96 data when converting to timestamps, for data written by Impala. This is necessary because Impala stores INT96 data with a different timezone offset than Hive & Spark. |
| spark.sql.parquet.mergeSchema                            | FALSE                                                        | When true, the Parquet data source merges schemas collected from all data files, otherwise the schema is picked from the summary file or a random data file if no summary file is available. |
| spark.sql.parquet.outputTimestampType                    | INT96                                                        | Sets which Parquet timestamp type to use when Spark writes data to Parquet files. INT96 is a non-standard but commonly used timestamp type in Parquet. TIMESTAMP_MICROS is a standard timestamp type in Parquet, which stores number of microseconds from the Unix epoch. TIMESTAMP_MILLIS is also standard, but with millisecond precision, which means Spark has to truncate the microsecond portion of its timestamp value. |
| spark.sql.parquet.recordLevelFilter.enabled              | FALSE                                                        | If true, enables Parquet’s native record-level filtering using the pushed down filters. This configuration only has an effect when ‘spark.sql.parquet.filterPushdown’ is enabled. |
| spark.sql.parquet.respectSummaryFiles                    | FALSE                                                        | When true, we make assumption that all part-files of Parquet are consistent with summary files and we will ignore them when merging schema. Otherwise, if this is false, which is the default, we will merge all part-files. This should be considered as expert-only option, and shouldn’t be enabled before knowing what it means exactly. |
| spark.sql.parquet.writeLegacyFormat                      | FALSE                                                        | Whether to be compatible with the legacy Parquet format adopted by Spark 1.4 and prior versions, when converting Parquet schema to Spark SQL schema and vice versa. |
| spark.sql.parser.quotedRegexColumnNames                  | FALSE                                                        | When true, quoted Identifiers (using backticks) in SELECT statement are interpreted as regular expressions. |
| spark.sql.pivotMaxValues                                 | 10000                                                        | When doing a pivot without specifying values for the pivot column this is the maximum number of (distinct) values that will be collected without error. |
| spark.sql.queryExecutionListeners                        |                                                              | List of class names implementing QueryExecutionListener that will be automatically added to newly created sessions. The classes should have either a no-arg constructor, or a constructor that expects a SparkConf argument. |
| spark.sql.redaction.options.regex                        | (?i)url                                                      | Regex to decide which keys in a Spark SQL command’s options map contain sensitive information. The values of options whose names that match this regex will be redacted in the explain output. This redaction is applied on top of the global redaction configuration defined by spark.redaction.regex. |
| spark.sql.redaction.string.regex                         |                                                              | Regex to decide which parts of strings produced by Spark contain sensitive information. When this regex matches a string part, that string part is replaced by a dummy value. This is currently used to redact the output of SQL explain commands. When this conf is not set, the value from `spark.redaction.string.regex` is used. |
| spark.sql.session.timeZone                               | Asia/Shanghai                                                | The ID of session local timezone, e.g. “GMT”, “America/Los_Angeles”, etc. |
| spark.sql.shuffle.partitions                             | 4096                                                         | The default number of partitions to use when shuffling data for joins or aggregations. |
| spark.sql.sources.bucketing.enabled                      | TRUE                                                         | When false, we will treat bucketed table as normal table     |
| spark.sql.sources.default                                | parquet                                                      | The default data source to use in input/output.              |
| spark.sql.sources.parallelPartitionDiscovery.threshold   | 32                                                           | The maximum number of paths allowed for listing files at driver side. If the number of detected paths exceeds this value during partition discovery, it tries to list the files with another Spark distributed job. This applies to Parquet, ORC, CSV, JSON and LibSVM data sources. |
| spark.sql.sources.partitionColumnTypeInference.enabled   | TRUE                                                         | When true, automatically infer the data types for partitioned columns. |
| spark.sql.sources.partitionOverwriteMode                 | STATIC                                                       | When INSERT OVERWRITE a partitioned data source table, we currently support 2 modes: static and dynamic. In static mode, Spark deletes all the partitions that match the partition specification(e.g. PARTITION(a=1,b)) in the INSERT statement, before overwriting. In dynamic mode, Spark doesn’t delete partitions ahead, and only overwrite those partitions that have data written into it at runtime. By default we use static mode to keep the same behavior of Spark prior to 2.3. Note that this config doesn’t affect Hive serde tables, as they are always overwritten with dynamic mode. |
| spark.sql.statistics.fallBackToHdfs                      | TRUE                                                         | If the table statistics are not available from table metadata enable fall back to hdfs. This is useful in determining if a table is small enough to use auto broadcast joins. |
| spark.sql.statistics.histogram.enabled                   | FALSE                                                        | Generates histograms when computing column statistics if enabled. Histograms can provide better estimation accuracy. Currently, Spark only supports equi-height histogram. Note that collecting histograms takes extra cost. For example, collecting column statistics usually takes only one table scan, but generating equi-height histogram will cause an extra table scan. |
| spark.sql.statistics.size.autoUpdate.enabled             | FALSE                                                        | Enables automatic update for table size once table’s data is changed. Note that if the total number of files of the table is very large, this can be expensive and slow down data change commands. |
| spark.sql.streaming.checkpointLocation                   |                                                              | The default location for storing checkpoint data for streaming queries. |
| spark.sql.streaming.metricsEnabled                       | FALSE                                                        | Whether Dropwizard/Codahale metrics will be reported for active streaming queries. |
| spark.sql.streaming.numRecentProgressUpdates             | 100                                                          | The number of progress updates to retain for a streaming query |
| spark.sql.thriftserver.scheduler.pool                    |                                                              | Set a Fair Scheduler pool for a JDBC client session.         |
| spark.sql.thriftserver.ui.retainedSessions               | 200                                                          | The number of SQL client sessions kept in the JDBC/ODBC web UI history. |
| spark.sql.thriftserver.ui.retainedStatements             | 200                                                          | The number of SQL statements kept in the JDBC/ODBC web UI history. |
| spark.sql.ui.retainedExecutions                          | 1000                                                         | Number of executions to retain in the Spark UI.              |
| spark.sql.variable.substitute                            | TRUE                                                         | This enables substitution using syntax like ${var} ${system:var} and ${env:var}. |
| spark.sql.warehouse.dir                                  | /user/warehouse                                              | The default location for managed databases and tables.       |