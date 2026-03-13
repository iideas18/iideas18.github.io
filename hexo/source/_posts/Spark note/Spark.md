---
title: "**TPCx-HS test result:**"
date: 2020-02-11 13:50:22
slug: "Spark"
categories:
  - "Spark note"
---

# **TPCx-HS test result:**

## 1> Using default config, double test:

[application_1579243573764_0001](http://10.239.44.110:18088/history/application_1579243573764_0001/1/jobs/) ------- [application_1579243573764_0006](http://10.239.44.110:18088/history/application_1579243573764_0006/1/jobs/) 

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 64MB
```

## 2> set spark.io.compression.codec  

#### 1. dfs.blocksize 64MB

[application_1579243573764_0007](http://10.239.44.110:18088/history/application_1579243573764_0007/1/jobs/) ------- [application_1579243573764_0009](http://10.239.44.110:18088/history/application_1579243573764_0009/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 64MB
spark.io.compression.codec	lz4
```

[application_1579243573764_0010](http://10.239.44.110:18088/history/application_1579243573764_0010/1/jobs/) ------ [application_1579243573764_0012](http://10.239.44.110:18088/history/application_1579243573764_0012/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 64MB
spark.io.compression.codec	snappy
```

[application_1579243573764_0013](http://10.239.44.110:18088/history/application_1579243573764_0013/1/jobs/) ------ [application_1579243573764_0015](http://10.239.44.110:18088/history/application_1579243573764_0015/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 64MB
spark.io.compression.codec	lzf
```

#### 2. dfs.blocksize 128MB

[application_1581136826211_0001](http://10.239.44.110:18088/history/application_1581136826211_0001/1/jobs/) ------ [application_1581136826211_0003](http://10.239.44.110:18088/history/application_1581136826211_0003/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 128MB
spark.io.compression.codec	lzf
```

#### 3. dfs.blocksize 256MB

[application_1581139187799_0001](http://10.239.44.110:18088/history/application_1581139187799_0001/1/jobs/) ------ [application_1581139187799_0003](http://10.239.44.110:18088/history/application_1581139187799_0003/1/jobs/) 

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 256MB
spark.io.compression.codec	lz4
```

[application_1581139187799_0004](http://10.239.44.110:18088/history/application_1581139187799_0004/1/jobs/) ------ [application_1581139187799_0006](http://10.239.44.110:18088/history/application_1581139187799_0006/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 256MB
spark.io.compression.codec	lzf
```

[application_1581139187799_0007](http://10.239.44.110:18088/history/application_1581139187799_0007/1/jobs/) ------ [application_1581139187799_0009](http://10.239.44.110:18088/history/application_1581139187799_0009/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 256MB
spark.io.compression.codec	snappy
```

#### 4. dfs.blocksize 512MB

[application_1581006805113_0001](http://10.239.44.110:18088/history/application_1581006805113_0001/1/jobs/) ------ [application_1581006805113_0003](http://10.239.44.110:18088/history/application_1581006805113_0003/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 512MB
spark.io.compression.codec	lz4
```

[application_1581006805113_0004](http://10.239.44.110:18088/history/application_1581006805113_0004/1/jobs/) ------ [application_1581006805113_0006](http://10.239.44.110:18088/history/application_1581006805113_0006/1/jobs/) 

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 512MB
spark.io.compression.codec	lzf
```

[application_1581006805113_0007](http://10.239.44.110:18088/history/application_1581006805113_0007/1/jobs/) ------ [application_1581006805113_0009](http://10.239.44.110:18088/history/application_1581006805113_0009/1/jobs/) 

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 512MB
spark.io.compression.codec	snappy
```

## 3> set spark.default.parallelism	

Notice HSGen task is 60, set **spark.default.parallism**=**710** for **HSGen** ( **just for HSGen**)

[application_1581006805113_0021](http://10.239.44.110:18088/history/application_1581006805113_0021/1/jobs/) ------ [application_1581006805113_0023](http://10.239.44.110:18088/history/application_1581006805113_0023/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 512MB
spark.io.compression.codec	lz4
```

[application_1581006805113_0024](http://10.239.44.110:18088/history/application_1581006805113_0024/1/jobs/) ------ [application_1581006805113_0026](http://10.239.44.110:18088/history/application_1581006805113_0026/1/jobs/) 

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 512MB
spark.io.compression.codec	lzf
```

[application_1581006805113_0027](http://10.239.44.110:18088/history/application_1581006805113_0027/1/jobs/) ------ [application_1581006805113_0029](http://10.239.44.110:18088/history/application_1581006805113_0029/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 512MB
spark.io.compression.codec	snappy
```

## 4> Scale Factor 2

The above all test is Scale Factor 1 with slightly changed, try to using Scale Factor 2(Still running).

```shell
OPTIONS:
   -h  Help
   -m  Use the MapReduce framework
   -s  Use the Spark framework
   -g  <TPCx-HS Scale Factor option from below>
       1   Run TPCx-HS for 100GB (For test purpose only, not a valid Scale Factor)
       2   Run TPCx-HS for 1TB
       3   Run TPCx-HS for 3TB
       4   Run TPCx-HS for 10TB
       5   Run TPCx-HS for 30TB
       6   Run TPCx-HS for 100TB
       7   Run TPCx-HS for 300TB
       8   Run TPCx-HS for 1000TB
       9   Run TPCx-HS for 3000TB
       10  Run TPCx-HS for 10000TB
```

 [application_1581006805113_0030](http://10.239.44.110:18088/history/application_1581006805113_0030/1/jobs/) ----[application_1581006805113_0032](http://10.239.44.110:18088/history/application_1581006805113_0032/1/jobs/) 

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 512MB
spark.io.compression.codec	lz4
```

[application_1581006805113_0033](http://10.239.44.110:18088/history/application_1581006805113_0033/1/jobs/) ----[application_1581006805113_0035](http://10.239.44.110:18088/history/application_1581006805113_0035/1/jobs/)

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 512MB
spark.io.compression.codec	lzf
```

[application_1581006805113_0036](http://10.239.44.110:18088/history/application_1581006805113_0036/1/jobs/) ---- [application_1581006805113_0038](http://10.239.44.110:18088/history/application_1581006805113_0038/1/jobs/) 

```
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=20g
SPARK_EXECUTOR_CORES=5
SPARK_EXECUTOR_INSTANCES=159

with dfs.blocksize 64MB
spark.io.compression.codec	snappy
```









```
rm -rf /mnt/disk1/dfs/dn
rm -rf /mnt/disk2/dfs/dn
rm -rf /mnt/disk3/dfs/dn
rm -rf /mnt/disk4/dfs/dn
rm -rf /mnt/disk5/dfs/dn
rm -rf /mnt/disk6/dfs/dn
rm -rf /mnt/disk7/dfs/dn

```

