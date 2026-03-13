---
title: "Spark SQL用UDF实现按列特征重分区"
date: 2019-11-13 00:27:38
cover: "https://ask.qcloudimg.com/http-save/yehe-1088682/1m7lnqtpag.jpeg?imageView2/2/w/1620"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# Spark SQL用UDF实现按列特征重分区

[Spark学习技巧](https://cloud.tencent.com/developer/user/1088682)

![img](https://ask.qcloudimg.com/http-save/yehe-1088682/1m7lnqtpag.jpeg?imageView2/2/w/1620)

解决问题之前，要先了解一下Spark 原理，要想进行相同数据归类到相同分区，肯定要有产生shuffle步骤。

![img](https://ask.qcloudimg.com/http-save/yehe-1088682/uqhctj6ift.jpeg?imageView2/2/w/1620)

比如，F到G这个shuffle过程，那么如何决定数据到哪个分区去的呢？这就有一个分区器的概念，默认是hash分区器。

假如，我们能在分区这个地方着手的话肯定能实现我们的目标。

那么，在没有看Spark Dataset的接口之前，浪尖也不知道Spark Dataset有没有给我门提供这种类型的API，抱着试一试的心态，可以去Dataset类看一下，这个时候会发现有一个函数叫做repartition。

```javascript
/**
   * Returns a new Dataset partitioned by the given partitioning expressions, using
   * `spark.sql.shuffle.partitions` as number of partitions.
   * The resulting Dataset is hash partitioned.
   *
   * This is the same operation as "DISTRIBUTE BY" in SQL (Hive QL).
   *
   * @group typedrel
   * @since 2.0.0
   */
  @scala.annotation.varargs
  def repartition(partitionExprs: Column*): Dataset[T] = {
    repartition(sparkSession.sessionState.conf.numShufflePartitions, partitionExprs: _*)
  }
```

可以传入列表达式来进行重新分区，产生的新的Dataset的分区数是由参数spark.sql.shuffle.partitions决定，那么是不是可以满足我们的需求呢？

明显，直接用是不行的，可以间接使用UDF来实现该功能。

**方式一-简单重分区**

首先，实现一个UDF截取列值共同前缀，当然根据业务需求来写该udf

```javascript
val substring = udf{(str: String) => {
      str.substring(0,str.length-1)
    }}
```

注册UDF

```javascript
spark.udf.register("substring",substring)
```

创建Dataset 

```javascript
val sales = spark.createDataFrame(Seq(
      ("Warsaw1", 2016, 100),
      ("Warsaw2", 2017, 200),
      ("Warsaw3", 2016, 100),
      ("Warsaw4", 2017, 200),
      ("Beijing1", 2017, 200),
      ("Beijing2", 2017, 200),
      ("Warsaw4", 2017, 200),
      ("Boston1", 2015, 50),
      ("Boston2", 2016, 150)
    )).toDF("city", "year", "amount")
```

执行充分去操作

```javascript
val res = sales.repartition(substring(col("city")))
```

打印分区ID及对应的输出结果

```javascript
res.foreachPartition(partition=>{
      println("---------------------> Partition start ")
      println("partitionID is "+TaskContext.getPartitionId())
      partition.foreach(println)
      println("=====================> Partition stop ")
    })
```

浪尖这里spark.sql.shuffle.partitions设置的数值为10.

输出结果截图如下：

![img](https://ask.qcloudimg.com/http-save/yehe-1088682/z2u8bdvqpz.jpeg?imageView2/2/w/1620)

![img](https://ask.qcloudimg.com/http-save/yehe-1088682/4hele2mvil.jpeg?imageView2/2/w/1620)

**方式二-SQL实现**

对于Dataset的repartition产生的shuffle是不需要进行聚合就可以产生shuffle使得按照字段值进行归类到某些分区。

SQL的实现要实现重分区要使用group by，然后udf跟上面一样，需要进行聚合操作。

完整代码如下：

```javascript
val sales = spark.createDataFrame(Seq(
      ("Warsaw1", 2016, 100),
      ("Warsaw2", 2017, 200),
      ("Warsaw3", 2016, 100),
      ("Warsaw4", 2017, 200),
      ("Beijing1", 2017, 200),
      ("Beijing2", 2017, 200),
      ("Warsaw4", 2017, 200),
      ("Boston1", 2015, 50),
      ("Boston2", 2016, 150)
    )).toDF("city", "year", "amount")

    sales.registerTempTable("temp");
    val substring = udf{(str: String) => {
      str.substring(0,str.length-1)
    }}
    spark.udf.register("substring",substring)

    val res = spark.sql("select sum(amount) from temp group by substring(city)")
//
    res.foreachPartition(partition=>{
      println("---------------------> Partition start ")
      println("partitionID is "+TaskContext.getPartitionId())
      partition.foreach(println)
      println("=====================> Partition stop ")
    })
```

输出结果如下：

![img](https://ask.qcloudimg.com/http-save/yehe-1088682/zxx2g631hc.jpeg?imageView2/2/w/1620)

![img](https://ask.qcloudimg.com/http-save/yehe-1088682/ximelsdie8.jpeg?imageView2/2/w/1620)

由上面的结果也可以看到task执行结束时间是无序的。 

浪尖在这里主要是讲了Spark SQL 如何实现按照自己的需求对某列重分区。

那么，浪尖在这里就顺带问一下，如何用Spark Core实现该功能呢？