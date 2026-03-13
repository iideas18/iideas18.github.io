---
title: "Spark FSI tunning"
date: 2020-03-25 14:12:24
cover: "/2020/03/25/Spark note/FSI/Spark FSI tunning/C:\\Users\\zhouy1\\AppData\\Roaming\\Typora\\typora-user-images\\image-20200323150543727.png"
categories:
  - "Spark note"
  - "FSI"
---



# Spark FSI tunning

![image-20200323150543727](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323150543727.png)

## 1. GC

For some application jobs, GC is a big problem, like:

**recommendation_product_order**([application_1584475276480_0002](http://10.239.44.110:18088/history/application_1584475276480_0002/1/jobs/)): 

![image-20200323153543750](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323153543750.png)

the GC time almost 15% of the whole execution time.

I noticed you used G1GC, like:

```bash
Used: -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=45
```

and I checked the GClogs in the given folder, like:

![image-20200323160247256](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323160247256.png)

it seems just execution logs, different from the common GC logs, like:

![image-20200323160506564](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323160506564.png)

you may try to add some arguments like:

```bash
 -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc4_6.log -XX:+UseParallelGC -XX:+UseParallelOldGC -XX:NewRatio=1 -XX:SurvivorRatio=8 -XX:ParallelGCThreads=6
```

**/tmp/gc4_6.log** is your GC_logs location.

By the way, I tried ParallelGC on our local cluster, it seems better. While it is hard to say it will better for your cluster, you need to get the GC logs or you can try different GC methods.

## 2. Offheap size or executor size not enough

For  **recommendation_transaction**([application_1584475276480_0011](http://10.239.44.110:18088/history/application_1584475276480_0011/1/jobs/)) in stage 2, some tasks failed, like:

![image-20200323162317499](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323162317499.png)

Noticed that,

![image-20200323162707812](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323162707812.png)

the  off-heap size is 38g, but the **spark.yarn.executor.memoryOverhead** is only 4g.

you need to increase **spark.yarn.executor.memoryOverhead** size.

![image-20200323164923433](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323164923433.png)

## 3. Data skew and spill

For some application , it has data skew, 

![image-20200323165511792](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323165511792.png)

it mainly happened in ALS.scala(https://github.com/apache/spark/blob/branch-2.2/mllib/src/main/scala/org/apache/spark/ml/recommendation/ALS.scala) in the spark mllib.

In ALS.scala, 

![image-20200323175836339](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323175836339.png)

while **srcBlockId**="client_id"and **dstBlockID**="product_id", **REPARTITION**=1120 further bigger than **dstBlockID** .

![image-20200323175952262](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323175952262.png)

That makes data skew happened.

![image-20200323180320507](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323180320507.png)

It seems can not be avoided. You may try to increase **REPARTITION** numbers to check whether it works or not.

## 4. Storage level

I noticed storage level is **MEMORY_AND_DISK**，it will spill to **spark.local.dir** directory. 

Cause I don't find it in the **spark-defaults.conf** file or **init.sql**, It maybe use the default dir:**/tmp**. Or maybe configured in Cloudera, like:

![image-20200323184516969](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200323184516969.png)

This **dir** affects the disk location whether it on **SSD** or it on **PEMM**. It caused different execution times.

![image-20200324085723328](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200324085723328.png)

## 5. Memory useLegacyMode

When running ModelTraining related workload, a sharp drop in memory. Like, when running recommendation_transaction we have 110 executors and each of them have 16GB storage memory .

![image-20200325104127427](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200325104127427.png)



![image-20200325103838437](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200325103838437.png)

