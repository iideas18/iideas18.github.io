---
title: "Spark tunning"
date: 2019-10-28 19:14:12
cover: "/2019/10/28/Spark note/spark md/Spark tunning//home/gpu-sim/Pictures/Screenshot"
categories:
  - "Spark note"
  - "spark md"
---

# Spark tunning

Cluster:

> cores: 32\*2+48\*2+80=240
>
> Memory: 128\*4+256=768

Begin :

[application_1568623977484_0075](http://10.239.44.110:18088/history/application_1568623977484_0075/1/jobs/) ------ [application_1568771711944_0005](http://10.239.44.110:18088/history/application_1568771711944_0005/1/jobs/)

![Screenshot from 2019-09-23 13-53-27](/home/gpu-sim/Pictures/Screenshot from 2019-09-23 13-53-27.png)

first changed:

```shell
export GC_PROP=" -XX:MaxGCPauseMillis=10000"

set spark.memory.offHeap.enabled=true;
set spark.memory.offHeap.size=8GB;

set hive.exec.reducers.bytes.per.reducer=128000000;
set partition numbers=1600;
```

[application_1568771711944_0014](http://10.239.44.110:18088/history/application_1568771711944_0014/1/jobs/)  ------- [application_1568771711944_0034](http://10.239.44.110:18088/history/application_1568771711944_0034/1/jobs/)

![Screenshot from 2019-09-23 11-01-56](/home/gpu-sim/Pictures/Screenshot from 2019-09-23 11-01-56.png)

Second changed:

```shell
set mapreduce.input.fileinputformat.split.maxsize=67108864;

set spark.memory.offHeap.enabled=true;
set spark.memory.offHeap.size=8GB;

set spark.executor.memoryOverhead=10GB;
set spark.executor.memory=10GB;
set hive.auto.convert.join.noconditionaltask.size =1000000000;
set hive.exec.reducers.bytes.per.reducer=1;
set hive.exec.reducers.max=1600;
```

[application_1568771711944_0051](http://10.239.44.110:18088/history/application_1568771711944_0051/1/jobs/)  ------- [application_1568771711944_0071](http://10.239.44.110:18088/history/application_1568771711944_0071/1/jobs/)

![Screenshot from 2019-09-23 11-01-24](/home/gpu-sim/Pictures/Screenshot from 2019-09-23 11-01-24.png)

Third Changes:

```shell
set hive.exec.reducers.bytes.per.reducer=64000000;
set hive.auto.convert.join.noconditionaltask.size = 256000000;

-XX:MaxGCPauseMillis=100000 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

[application_1568969385057_0002](http://10.239.44.110:18088/history/application_1568969385057_0002/1/jobs/)  -------- [application_1568969385057_0022](http://10.239.44.110:18088/history/application_1568969385057_0022/1/jobs/)

![Screenshot from 2019-09-23 10-58-36](/home/gpu-sim/Pictures/Screenshot from 2019-09-23 10-58-36.png)







1. data_acquisition: LoadDataAsHiveTables(init.sql and run.sh);
2. recommendation_pipeline/preprocessing :  recommendation_product_order ---- recommendation_tracnsaction (init.sql and run.sh)
3. training and MKL (run.sh and recommendation.sh).







[application_1569201592103_0031](http://10.239.44.110:18088/history/application_1569201592103_0031/1/jobs/) ------- [application_1569201592103_0047](http://10.239.44.110:18088/history/application_1569201592103_0047/1/jobs/)

```shell
-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000

 set spark.locality.wait=1s;
 set spark.default.parallelism=600;

 set hive.exec.reducers.bytes.per.reducer=64000000;
```

> 

[application_1569201592103_0085](http://10.239.44.110:18088/history/application_1569201592103_0085/1/jobs/) ------  [application_1569201592103_0094](http://10.239.44.110:18088/history/application_1569201592103_0094/1/jobs/) 

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000  -XX:G1HeapRegionSize=32M -XX:NewRatio=1

set hive.exec.reducers.bytes.per.reducer=16000000;
```

[application_1569201592103_0095](http://10.239.44.110:18088/history/application_1569201592103_0095/1/jobs/) ------ [application_1569201592103_0104](http://10.239.44.110:18088/history/application_1569201592103_0104/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M

set hive.exec.reducers.bytes.per.reducer=16000000;
```

[application_1569201592103_0105](http://10.239.44.110:18088/history/application_1569201592103_0105/1/jobs/) ------ [application_1569201592103_0114](http://10.239.44.110:18088/history/application_1569201592103_0114/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:NewRatio=1

set hive.exec.reducers.bytes.per.reducer=16000000;
```

[application_1569201592103_0048](http://10.239.44.110:18088/history/application_1569201592103_0048/1/jobs/) ------ [application_1569201592103_0064](http://10.239.44.110:18088/history/application_1569201592103_0064/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=16M -XX:NewRatio=1

 set hive.exec.reducers.bytes.per.reducer=16000000;
```



[application_1569201592103_0125](http://10.239.44.110:18088/history/application_1569201592103_0125/1/jobs/) ------ [application_1569201592103_0134](http://10.239.44.110:18088/history/application_1569201592103_0134/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=16M -XX:NewRatio=1

set hive.exec.reducers.bytes.per.reducer=64000000;
```

> APPID 0134 : total : 26min, 5 stages, max stage1 840 tasks, 15 failed, 15 executors: Blacklisted 7, dead 3
>
> Shuffle Read Size / Records: 
>
> ​		 0.0 B / 0	36.4 MB / 1573954	36.5 MB / 1577238	36.6 MB / 1580495	36.9 MB / 1592583
>
> Shuffle Write Size / Records:
>
> ​	    6.6 MB / 277220	6.6 MB / 278568	6.6 MB / 278910	6.7 MB / 279310	135.1 MB / 6730532
>
> Failed reason: ExecutorLostFailure (executor 9 exited caused by one of the running tasks) Reason: Container killed by YARN for **exceeding memory limits**. 11.6 GB of 11.5 GB physical memory used. Consider **boosting spark.yarn.executor.memoryOverhead**.

[application_1569201592103_0135](http://10.239.44.110:18088/history/application_1569201592103_0135/1/jobs/) ------ [application_1569201592103_0144](http://10.239.44.110:18088/history/application_1569201592103_0144/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1

set hive.exec.reducers.bytes.per.reducer=64000000;
```

> APPID 0144 : total : 21min, 5 stages, max stage1 839 tasks, 20 failed, 14executors: Blacklisted 7, dead 4
>
> Shuffle Read Size / Records:	
>
> ​		0.0 B / 0	36.4 MB / 1573955	36.5 MB / 1577240	36.6 MB / 1580494	36.9 MB / 1592583
>
> Shuffle Write Size / Records:	
>
> ​		6.6 MB / 277220	6.6 MB / 278567	6.6 MB / 278910	6.7 MB / 279306	132.2 MB / 6610992
>
> Failed reason:ExecutorLostFailure (executor 8 exited caused by one of the running tasks) Reason: Container killed by YARN for exceeding memory limits. 11.6 GB of 11.5 GB physical memory used. Consider boosting spark.yarn.executor.memoryOverhead.

[application_1569201592103_0065](http://10.239.44.110:18088/history/application_1569201592103_0065/1/jobs/) ------ [application_1569201592103_0074](http://10.239.44.110:18088/history/application_1569201592103_0074/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=16M -XX:NewRatio=1
 
set hive.exec.reducers.bytes.per.reducer=16000000;
```

> APPID 0074 : total: 19min, 5 stages, max stage1 3255 tasks, 5 failed, 11 executors: Blacklisted 1, dead 1.
>
> Shuffle Read Size / Records: 
>
> ​			0.0 B / 0	9.1 MB / 392724	9.1 MB / 394373	9.2 MB / 395963	9.3 MB / 402307
>
> Shuffle Write Size / Records:
>
> ​			1888.4 KB / 68833	1906.5 KB / 69548	1911.1 KB / 69732	1915.6 KB / 69910	134.9 MB / 6557129
>
> Failed reason: ExecutorLostFailure (executor 1 exited caused by one of the running tasks) Reason: Container killed by YARN for exceeding memory limits. 11.6 GB of 11.5 GB physical memory used. Consider boosting spark.yarn.executor.memoryOverhead.

[application_1569201592103_0075](http://10.239.44.110:18088/history/application_1569201592103_0075/1/jobs/) ------ [application_1569201592103_0084](http://10.239.44.110:18088/history/application_1569201592103_0084/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1

set hive.exec.reducers.bytes.per.reducer=16000000;
```

> APPID 0134 : total : 18min, 5 stages, max stage1 3255 tasks, 0 failed, 16 executors: Blacklisted 0, dead 6
>
> Shuffle Read Size / Records: 
>
> ​				0.0 B / 0	9.1 MB / 392724	9.1 MB / 394373	9.2 MB / 395963	9.3 MB / 402307
>
> Shuffle Write Size / Records:
>
> ​			1888.4 KB / 68833	1906.5 KB / 69548	1911.1 KB / 69732	1915.6 KB / 69910	132.1 MB / 6522618

[application_1569201592103_0115](http://10.239.44.110:18088/history/application_1569201592103_0115/1/jobs/) ------ [application_1569201592103_0124](http://10.239.44.110:18088/history/application_1569201592103_0124/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=16M -XX:NewRatio=1

set hive.merge.sparkfiles=false;
set hive.exec.reducers.bytes.per.reducer=16000000;
```

> APPID 0124 : total : 31min, 4 stages, max stage1 3255 tasks, 23 failed, 12 executors: Blacklisted 10, dead 0
>
> Shuffle Read Size / Records: 
>
> ​				0.0 B / 0	9.1 MB / 392724	9.1 MB / 394373	9.2 MB / 395963	9.3 MB / 402307
>
> Shuffle Write Size / Records:
>
> ​			1888.4 KB / 68833	1906.5 KB / 69548	1911.1 KB / 69732	1915.6 KB / 69910	123.4 MB / 6100567
>
> Failed reason: ExecutorLostFailure (executor 8 exited caused by one of the running tasks) Reason: Container killed by YARN for exceeding memory limits. 12.1 GB of 11.5 GB physical memory used. Consider boosting spark.yarn.executor.memoryOverhead.

[application_1569201592103_0145](http://10.239.44.110:18088/history/application_1569201592103_0145/1/jobs/) ------ [application_1569201592103_0154](http://10.239.44.110:18088/history/application_1569201592103_0154/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1

set hive.merge.sparkfiles=false;
set hive.exec.reducers.bytes.per.reducer=16000000;
```

>APPID 0154 : total : 18min, 4 stages, max stage1 3254 tasks, 10 failed, 11executors: Blacklisted 2, dead 2
>
>Shuffle Read Size / Records	
>
>​		0.0 B / 0	9.1 MB / 392726	9.1 MB / 394374	9.2 MB / 395963	9.3 MB / 402307
>Shuffle Write Size / Records	
>
>​		1888.4 KB / 68833	1906.5 KB / 69548	1911.1 KB / 69732	1915.6 KB / 69909	127.7 MB / 6312835
>
>Failed reason: ExecutorLostFailure (executor 1 exited caused by one of the running tasks) Reason: Container killed by YARN for exceeding memory limits. 11.7 GB of 11.5 GB physical memory used. Consider boosting spark.yarn.executor.memoryOverhead.

[application_1569201592103_0155](http://10.239.44.110:18088/history/application_1569201592103_0155/1/jobs/) ----- [application_1569201592103_0164](http://10.239.44.110:18088/history/application_1569201592103_0164/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1

set hive.merge.sparkfiles=false;
set hive.exec.reducers.bytes.per.reducer=16000000;
set spark.driver.memoryOverhead=15g;
```

![Screenshot from 2019-09-25 15-51-22](/home/gpu-sim/Pictures/Screenshot from 2019-09-25 15-51-22.png)

[application_1569201592103_0165](http://10.239.44.110:18088/history/application_1569201592103_0165/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1

set hive.merge.sparkfiles=false;
set hive.exec.reducers.bytes.per.reducer=16000000;
set spark.driver.memoryOverhead=${hiveconf:MEM_OVERHEAD};
export DRIVER_MEMORY=8g;
```

![Screenshot from 2019-09-25 15-50-21](/home/gpu-sim/Pictures/Screenshot from 2019-09-25 15-50-21.png)

[application_1569201592103_0166](http://10.239.44.110:18088/history/application_1569201592103_0166/1/jobs/)

```shell
-XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=100000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1

set hive.merge.sparkfiles=false;
set hive.exec.reducers.bytes.per.reducer=16000000;
set spark.driver.memoryOverhead=${hiveconf:MEM_OVERHEAD};
export DRIVER_MEMORY=8g;
```

[application_1569201592103_0167](http://10.239.44.110:18088/history/application_1569201592103_0167/1/jobs/)

```shell
-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:MaxGCPauseMillis=100000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
set hive.merge.sparkfiles=false;
set hive.exec.reducers.bytes.per.reducer=16000000;
set spark.driver.memoryOverhead=${hiveconf:MEM_OVERHEAD};

export DRIVER_MEMORY=4g;
```

[1] https://www.iteblog.com/archives/2342.html

no changes;

```shell
set spark.sql.shuffle.partitions=100;
set spark.default.parallelism=100;
set spark.executor.extraJavaOptions= -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:+UseG1GC -XX:    MaxGCPauseMillis=10000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1;
```



> vim recommendation_ratings.sql: 

[application_1569720396167_0052](http://10.239.44.110:18088/history/application_1569720396167_0052/1/jobs/) ------- [application_1569720396167_0071](http://10.239.44.110:18088/history/application_1569720396167_0071/1/jobs/) 

```sql
set input_partitions=0.1;
```

![Screenshot from 2019-09-30 10-38-03](/home/gpu-sim/Pictures/Screenshot from 2019-09-30 10-38-03.png)

application_1569720396167_0021 -------- [application_1569720396167_0050](http://10.239.44.110:18088/history/application_1569720396167_0050/2/jobs/)

```sql
set input_partitions=0.9;
```

![Screenshot from 2019-09-30 10-44-20](/home/gpu-sim/Pictures/Screenshot from 2019-09-30 10-44-20.png)

[application_1569720396167_0072](http://10.239.44.110:18088/history/application_1569720396167_0072/1/jobs/) ------- [application_1569720396167_0090](http://10.239.44.110:18088/history/application_1569720396167_0090/2/jobs/)

```sql
vim recommendation_ratings.sql

set input_partitions=0.2;

GROUP BY op.product_id, op.client_id;
 --, op.product_name, op.product_type,
 --                c.annual_income,c.cust_type,c.capital_gain,c.capital_loss,
 --                c.education,c.marital_status,c.housing ,
 --                c.is_mobile_user,c.is_social_profile_connected,c.mobile_alerts_on,
 --                c.employment_status, c.birth_date ;

```

[application_1569720396167_0091](http://10.239.44.110:18088/history/application_1569720396167_0091/1/jobs/) ----- [application_1569720396167_0110](http://10.239.44.110:18088/history/application_1569720396167_0110/1/jobs/)

```shell
vim recommendation_ratings.sql

set input_partitions=0.2;

GROUP BY op.product_id, op.client_id;
 , op.product_name, op.product_type,
                 c.annual_income,c.cust_type,c.capital_gain,c.capital_loss,
                 c.education,c.marital_status,c.housing ,
                 c.is_mobile_user,c.is_social_profile_connected,c.mobile_alerts_on,
                 c.employment_status, c.birth_date ;
```

![Screenshot from 2019-09-30 10-45-08](/home/gpu-sim/Pictures/Screenshot from 2019-09-30 10-45-08.png)

> vim hive.exec.reducers.bytes.per.reducer

[application_1569720396167_0111](http://10.239.44.110:18088/history/application_1569720396167_0111/1/jobs/)------- [application_1569720396167_0126](http://10.239.44.110:18088/history/application_1569720396167_0126/1/jobs/)

```sql
 -- IO config
 set hive.exec.reducers.max=800;
 --Yan added
 set hive.exec.reducers.bytes.per.reducer=1;
 
 set spark.executor.extraJavaOptions= -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc22.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1;

set input_partitions=0.2;

GROUP BY op.product_id, op.client_id;
 , op.product_name, op.product_type,
                 c.annual_income,c.cust_type,c.capital_gain,c.capital_loss,
                 c.education,c.marital_status,c.housing ,
                 c.is_mobile_user,c.is_social_profile_connected,c.mobile_alerts_on,
                 c.employment_status, c.birth_date ;
```



[application_1569720396167_0127](http://10.239.44.110:18088/history/application_1569720396167_0127/1/jobs/) ----- [application_1569720396167_0136](http://10.239.44.110:18088/history/application_1569720396167_0136/1/jobs/)

```shell
vim recommendation_ratings.sql

set mapreduce.input.fileinputformat.split.maxsize=67108864;
set hive.exec.reducers.bytes.per.reducer=128000000;

```

[application_1569720396167_0137](http://10.239.44.110:18088/history/application_1569720396167_0137/1/jobs/) ----- 





# Comparing:

[application_1570602944525_0034](http://10.239.44.110:18088/history/application_1570602944525_0034/1/jobs/) and [application_1570602944525_0035](http://10.239.44.110:18088/history/application_1570602944525_0035/1/jobs/)

![Screenshot from 2019-10-12 09-52-36](/home/gpu-sim/Pictures/Screenshot from 2019-10-12 09-52-36.png)

[application_1570602944525_0034](http://10.239.44.110:18088/history/application_1570602944525_0034/1/jobs/) GC

```shell
-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc4.log -XX:+UseParallelGC -XX:+UseParallelOldGC -XX:NewRatio=1 -XX:SurvivorRatio=8 -XX:ParallelGCThreads=6


-XX:InitialHeapSize=1982151232 -XX:MaxHeapSize=10737418240 -XX:NewRatio=1 -XX:OnOutOfMemoryError=kill %p -XX:ParallelGCThreads=6 -XX:+PrintGC -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -XX:SurvivorRatio=8 -XX:+UseCompressedClassPointers -XX:+UseCompressedOops -XX:+UseParallelGC -XX:+UseParallelOldGC
```

![1570875899835](/home/gpu-sim/.config/Typora/typora-user-images/1570875899835.png)

![1570875922842](/home/gpu-sim/.config/Typora/typora-user-images/1570875922842.png)

![1570875958467](/home/gpu-sim/.config/Typora/typora-user-images/1570875958467.png)

![1570875989792](/home/gpu-sim/.config/Typora/typora-user-images/1570875989792.png)

![1570876006665](/home/gpu-sim/.config/Typora/typora-user-images/1570876006665.png)

![1570876025123](/home/gpu-sim/.config/Typora/typora-user-images/1570876025123.png)

[application_1570602944525_0035](http://10.239.44.110:18088/history/application_1570602944525_0035/1/jobs/) GC

```shell
-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc5.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

























# Part 2: PageRank

## 1. G1GC:

[application_1571385512174_0010](http://tracing044:18088/history/application_1571385512174_0010) 1.6h

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc2.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100000 -XX:ParallelGCThreads=32 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

>  **Throughput: 82.864%** 

![1571674368188](/home/gpu-sim/.config/Typora/typora-user-images/1571674368188.png)

[application_1571385512174_0009](http://tracing044:18088/history/application_1571385512174_0009)  1.4h

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100000 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

> **Throughput : 97.207%**

![1571674347707](/home/gpu-sim/.config/Typora/typora-user-images/1571674347707.png)

[application_1571385512174_0018](http://tracing044:18088/history/application_1571385512174_0018) 1.3h

> **Throughput : 86.987%**

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc6.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

![1571674404396](/home/gpu-sim/.config/Typora/typora-user-images/1571674404396.png)

[application_1571385512174_0019](http://tracing044:18088/history/application_1571385512174_0019)  22 min

 **Throughput : 87.975%**

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc7.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=2
```

![1571674434269](/home/gpu-sim/.config/Typora/typora-user-images/1571674434269.png)

[application_1571385512174_0020](http://tracing044:18088/history/application_1571385512174_0020) 19 min

**Throughput : 91.731%**

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc8.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=3
```

![1571674452701](/home/gpu-sim/.config/Typora/typora-user-images/1571674452701.png)

[application_1571385512174_0021](http://tracing044:18088/history/application_1571385512174_0021) 19 min

**Throughput : 95.738%**

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc9.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=4 -XX:+PrintTenuringDistribution
```

![1571674474818](/home/gpu-sim/.config/Typora/typora-user-images/1571674474818.png)

[application_1571385512174_0022](http://tracing044:18088/history/application_1571385512174_0022) 27 min

**Throughput : 93.57%**

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc10.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=32 -XX:G1HeapRegionSize=32M -XX:NewRatio=3 -XX:+PrintTenuringDistribution
```

![1571674493833](/home/gpu-sim/.config/Typora/typora-user-images/1571674493833.png)

[application_1571385512174_0025](http://tracing044:18088/history/application_1571385512174_0025) 19 min

**Throughput : 92.314%**

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=3 -XX:+PrintTenuringDistribution -XX:ConcGCThreads=6	
```

![1571675174158](/home/gpu-sim/.config/Typora/typora-user-images/1571675174158.png)

[application_1571385512174_0027](http://tracing044:18088/history/application_1571385512174_0027) 23min

**Throughput : 91.219%**

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc12.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=65 -XX:G1HeapRegionSize=32M -XX:NewRatio=4 -XX:+PrintTenuringDistribution -XX:ConcGCThreads=16
```

![1571680948356](/home/gpu-sim/.config/Typora/typora-user-images/1571680948356.png)

[application_1571385512174_0028](http://tracing044:18088/history/application_1571385512174_0028)   28 min

```shell
	-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc13.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=65 -XX:G1HeapRegionSize=32M -XX:NewRatio=3 -XX:+PrintTenuringDistribution
```

 **Throughput : 93.01%**

![1571761313722](/home/gpu-sim/.config/Typora/typora-user-images/1571761313722.png)

[application_1571385512174_0032](http://tracing044:18088/history/application_1571385512174_0032) 35 min

```shell
	-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc14.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=3 -XX:+PrintTenuringDistribution -XX:InitiatingHeapOccupancyPercent=70
```

![1571760993144](/home/gpu-sim/.config/Typora/typora-user-images/1571760993144.png)

**spark.executor.memory	8g**

------

[application_1571385512174_0040](http://tracing044:18088/history/application_1571385512174_0040) 1.1 h

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc22.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=2 -XX:+PrintTenuringDistribution
```

![1571761267567](/home/gpu-sim/.config/Typora/typora-user-images/1571761267567.png)

[application_1571385512174_0041](http://tracing044:18088/history/application_1571385512174_0041)  46 min

```shell
	-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc23.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=3 -XX:+PrintTenuringDistribution
```

![1571762935341](/home/gpu-sim/.config/Typora/typora-user-images/1571762935341.png)

[application_1571385512174_0042](http://tracing044:18088/history/application_1571385512174_0042) 45min

```shell
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc24.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=4 -XX:+PrintTenuringDistribution
```

![1571766291981](/home/gpu-sim/.config/Typora/typora-user-images/1571766291981.png)

## 2. Parallel GC

[application_1571385512174_0033](http://tracing044:18088/history/application_1571385512174_0033) 12min

```shell
spark.shuffle.spill.compress	false
spark.shuffle.compress			false
spark.executor.extraJavaOptions	-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc15.log -XX:ParallelGCThreads=6 -XX:NewRatio=1 -XX:SurvivorRatio=8
```

![1571761062089](/home/gpu-sim/.config/Typora/typora-user-images/1571761062089.png)

[application_1571385512174_0034](http://tracing044:18088/history/application_1571385512174_0034)  11min

```shell
spark.reducer.maxSizeInFlight	96m
spark.shuffle.file.buffer		64k
spark.shuffle.compress			false
spark.shuffle.spill.compress	false
-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc16.log -XX:ParallelGCThreads=6 -XX:NewRatio=1 -XX:SurvivorRatio=8
```

![1571761081081](/home/gpu-sim/.config/Typora/typora-user-images/1571761081081.png)

**spark.executor.memory	8g**

------

[application_1571385512174_0035](http://tracing044:18088/history/application_1571385512174_0035) 32 min

```shell
	-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc17.log -XX:ParallelGCThreads=6 -XX:NewRatio=1 -XX:SurvivorRatio=8
```

**Throughput : 86.229%**

![1571761106712](/home/gpu-sim/.config/Typora/typora-user-images/1571761106712.png)

[application_1571385512174_0036](http://tracing044:18088/history/application_1571385512174_0036) 1.1hr

**Throughput : 76.246%**

```shell
	-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc18.log -XX:ParallelGCThreads=32 -XX:NewRatio=1 -XX:SurvivorRatio=8
```

![1571761136533](/home/gpu-sim/.config/Typora/typora-user-images/1571761136533.png)

[application_1571385512174_0037](http://tracing044:18088/history/application_1571385512174_0037) 17min

```shell
	-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc19.log -XX:ParallelGCThreads=6 -XX:NewRatio=2 -XX:SurvivorRatio=8
```

**Throughput : 99.99%**

![1571761169007](/home/gpu-sim/.config/Typora/typora-user-images/1571761169007.png)

[application_1571385512174_0038](http://tracing044:18088/history/application_1571385512174_0038) 17 min

```shell
	-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc20.log -XX:ParallelGCThreads=6 -XX:NewRatio=3 -XX:SurvivorRatio=8
```

**Throughput : 96.92%**

![1571761214882](/home/gpu-sim/.config/Typora/typora-user-images/1571761214882.png)

[application_1571385512174_0039](http://tracing044:18088/history/application_1571385512174_0039) 16min 

```shell
	-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc21.log -XX:ParallelGCThreads=6 -XX:NewRatio=2 -XX:SurvivorRatio=6 
```

![1571761235115](/home/gpu-sim/.config/Typora/typora-user-images/1571761235115.png)



















## G1GC:

### 1. MaxGCPauseMillis Tunning: 

### 	ParallelGCThreads=48 from 100000 to 20000

#### 1. [application_1569738853077_0045](http://10.239.166.109:18088/history/application_1569738853077_0045/1/jobs/)  **Total time: 10 min**

**1. Throughput : 78.463%**

**2.** **Latency:**

| Avg Pause GC Time     | **568 ms**        |
| :-------------------- | ----------------- |
| **Max Pause GC Time** | **18 sec 310 ms** |

```shell
spark.executor.extraJavaOptions=-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc.log -XX:+UseG1GC -XX:MaxGCPauseMillis=100000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

![image-20191025205243046](/home/gpu-sim/.config/Typora/typora-user-images/image-20191025205243046.png)

#### 2. [application_1569738853077_0047](http://10.239.166.109:18088/history/application_1569738853077_0047/1/jobs/)  **Total time: 10 min**

**1** **Throughput : 72.191%**

**2** **Latency:**

| Avg Pause GC Time | **782 ms**       |
| :---------------- | ---------------- |
| Max Pause GC Time | **23 sec 90 ms** |

```shell
-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc2.log -XX:+UseG1GC -XX:MaxGCPauseMillis=20000 -XX:ParallelGCThreads=48 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

![image-20191028093050864](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028093050864.png)

### ParallelGCThreads=6 from 20000 to 200

#### 3 [application_1569738853077_0061](http://10.239.166.109:18088/history/application_1569738853077_0061/1/jobs/)  **Total time: 9min**

**1** **Throughput : 89.02%**

**2** **Latency:**

| Avg Pause GC Time | **180 ms**       |
| :---------------- | ---------------- |
| Max Pause GC Time | **15 sec 60 ms** |

```shell
	-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11_a.log -XX:+UseG1GC -XX:MaxGCPauseMillis=20000 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

![image-20191028104807351](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028104807351.png)

#### 4. [application_1569738853077_0060](http://10.239.166.109:18088/history/application_1569738853077_0060/1/jobs/)   **Total time: 8.9min**

**1** **Throughput : 84.002%**

**2** **Latency:**

| Avg Pause GC Time | **266 ms**        |
| :---------------- | ----------------- |
| Max Pause GC Time | **19 sec 310 ms** |

```shell
	-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11.log -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:ParallelGCThreads=6 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

![image-20191028104447130](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028104447130.png)

### 2. GCThreads Tunning: 

#### 		ParallelGCThreads from 15 to 1

#### 1. [application_1569738853077_0063](http://10.239.166.109:18088/history/application_1569738853077_0063/1/jobs/)  **Total time: 9.7min**

```shell
-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11_c.log -XX:+UseG1GC -XX:ParallelGCThreads=15 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

**1** **Throughput : 81.321%**

**2** **Latency:**

| Avg Pause GC Time | **372 ms**        |
| :---------------- | ----------------- |
| Max Pause GC Time | **16 sec 210 ms** |

![image-20191028105954478](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028105954478.png)

#### 2. [application_1569738853077_0066](http://10.239.166.109:18088/history/application_1569738853077_0066/1/jobs/) **Total time: 8.9min **

**1** **Throughput : 85.605%**

**2** **Latency:**

| Avg Pause GC Time | **200 ms**        |
| :---------------- | ----------------- |
| Max Pause GC Time | **11 sec 860 ms** |

```shell
-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11_f.log -XX:+UseG1GC -XX:ParallelGCThreads=8 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

![image-20191028110401092](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028110401092.png)

#### 3. [application_1569738853077_0065](http://10.239.166.109:18088/history/application_1569738853077_0065/1/jobs/) **Total time: 8.8min **

**1** **Throughput : 81.55%**

**2** **Latency:**

| Avg Pause GC Time | **348 ms**        |
| :---------------- | ----------------- |
| Max Pause GC Time | **13 sec 380 ms** |

```shell
-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11_e.log -XX:+UseG1GC -XX:ParallelGCThreads=4 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

![image-20191028110045086](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028110045086.png)

#### 4.  [application_1569738853077_0062](http://10.239.166.109:18088/history/application_1569738853077_0062/1/jobs/) **Total time: 10min**

**1** **Throughput : 94.149%**

**2** **Latency:**

| Avg Pause GC Time | **189 ms** |
| :---------------- | ---------- |
| Max Pause GC Time | **700 ms** |

```shell
	-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11_b.log -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:ParallelGCThreads=1 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

![image-20191028105900444](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028105900444.png)



[application_1569738853077_0073](http://10.239.166.109:18088/history/application_1569738853077_0073/1/jobs/) **Total time: 8.9min**

```shell
	-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11_i.log -XX:+UseG1GC -XX:ParallelGCThreads=4 -XX:ConcGCThreads=4 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```



[application_1569738853077_0077](http://10.239.166.109:18088/history/application_1569738853077_0077/1/jobs/) **Total time: 11min**

```shell
	-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11_j.log -XX:+UseG1GC -XX:ParallelGCThreads=40 -XX:ConcGCThreads=20 -XX:G1HeapRegionSize=32M -XX:NewRatio=1
```

### 3. G1HeapRegionSize Tunning:

[application_1569738853077_0072](http://10.239.166.109:18088/history/application_1569738853077_0072/1/jobs/) **Total time: 9.6min**

```shell
-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc11_h.log -XX:+UseG1GC -XX:ParallelGCThreads=4 -XX:G1HeapRegionSize=1M -XX:NewRatio=1
```



## ParallelGC

[application_1569738853077_0048](http://10.239.166.109:18088/history/application_1569738853077_0048/1/jobs/)   **Total time : 7.3 min**

**1** **Throughput : 90.392%**

**2** **Latency:**

| Avg Pause GC Time | **284 ms**       |
| :---------------- | ---------------- |
| Max Pause GC Time | **6 sec 150 ms** |

```shell
	-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc3.log -XX:+UseParallelGC -XX:+UseParallelOldGC -XX:NewRatio=1 -XX:SurvivorRatio=8 -XX:ParallelGCThreads=6
```

![image-20191028093848992](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028093848992.png)

[application_1569738853077_0049](http://10.239.166.109:18088/history/application_1569738853077_0049/1/jobs/) **Total time: 7.4 min**

**1** **Throughput : 94.364%**

**2** **Latency:**

| Avg Pause GC Time | **84.5 ms**      |
| :---------------- | ---------------- |
| Max Pause GC Time | **1 sec 490 ms** |

```shell
	-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc4.log -XX:+UseParallelGC -XX:+UseParallelOldGC -XX:NewRatio=2 -XX:SurvivorRatio=8 -XX:ParallelGCThreads=6
```

![image-20191028101229653](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028101229653.png)

[application_1569738853077_0059](http://10.239.166.109:18088/history/application_1569738853077_0059/1/jobs/) **Total time: 12min**

**1** **Throughput : 85.447%**

**2** **Latency:**

| Avg Pause GC Time | **677 ms**        |
| :---------------- | ----------------- |
| Max Pause GC Time | **11 sec 310 ms** |

```shell
	-Dhive.spark.log.dir=/opt/cloudera/parcels/CDH-6.0.1-1.cdh6.0.1.p0.590678/lib/spark/logs/ -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc10.log -XX:+UseParallelGC -XX:+UseParallelOldGC -XX:NewRatio=1 -XX:SurvivorRatio=8 -XX:ParallelGCThreads=48	
```

![image-20191028111358588](/home/gpu-sim/.config/Typora/typora-user-images/image-20191028111358588.png)