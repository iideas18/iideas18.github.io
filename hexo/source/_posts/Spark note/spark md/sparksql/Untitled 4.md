---
title: "spark sql 之join等函数用法"
date: 2019-11-18 18:54:38
slug: "Untitled 4"
categories:
  - "Spark note"
  - "spark md"
  - "sparksql"
---

# spark sql 之join等函数用法

2017-06-15 16:22:05 更多

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/zhousishuo/article/details/73292428

环境说明：首先搭建好spark环境，然后使用命令pyspark进入python环境编写
如果之前使用过sql语句，那么spark sql学起来会很快。spark sql可以将rdd转换为dataframe来进行使用，也可以将dataframe注册为表，使用sql语言来处理数据，使用起来很方便。
参考链接：
http://spark.apache.org/docs/2.1.0/api/python/pyspark.sql.html#pyspark.sql.functions.collect_set

1. 构造数据

```python
from pyspark.sql.types import *
#创建第一个dataframe
rdd = sc.parallelize([(1,'Alice', 18),(2,'Andy', 19),(3,'Bob', 17),(4,'Justin', 21),(5,'Cindy', 20)])
schema = StructType([
    StructField("id", IntegerType(), True),
    StructField("name", StringType(), True),
    StructField("age", IntegerType(), True)
])
df = spark.createDataFrame(rdd, schema)
df.show()
```

结果如下：
![这里写图片描述](https://img-blog.csdn.net/20170615161609255?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

```python
#创建第二个dataframe
rdd2 = sc.parallelize([('Alice', 160),('Andy', 159),('Bob', 170),('Cindy', 165),('Rose', 160)])
schema2 = StructType([
    StructField("name", StringType(), True),
    StructField("height", IntegerType(), True)
])
df2 = spark.createDataFrame(rdd2, schema2)
df2.show()
```

结果如下：
![这里写图片描述](https://img-blog.csdn.net/20170615161913428?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

```python
#创建第三个dataframe
rdd3 = sc.parallelize([(1,'Alice', 160),(2,'Andy', 159),(3,'Tom', 175),(4,'Justin', 171),(5,'Cindy', 165)])
schema3 = StructType([
    StructField("id", IntegerType(), True),
    StructField("name", StringType(), True),
    StructField("height", IntegerType(), True)
])
df3 = spark.createDataFrame(rdd3, schema3)
df3.show()
```

结果如下：
![这里写图片描述](https://img-blog.csdn.net/20170615162052757?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

2. inner join

```python
df.join(df2, "name", "inner").select("id", df.name, "age", "height").orderBy("id").show()
```

结果如下：
![这里写图片描述](https://img-blog.csdn.net/20170615162332962?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)
如果不写连接类型，默认是inner join，例子如下图：
![这里写图片描述](https://img-blog.csdn.net/20170615162442617?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)
如果内连接的参数不只一个，将参数放在一个列表中

```python
df.join(df3, ["id", "name"], "inner").select(df.id, df.name,"age", "height").orderBy(df.id).show()
```

结果如下：
![这里写图片描述](https://img-blog.csdn.net/20170615162802730?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

2. outer join
   full outer join全外连接
   **注意：不能用…select(df.name)，会报错**

```python
df.join(df2, "name", "outer").select("id", "name", "age", "height").orderBy("id").show()
```

结果如下：
![这里写图片描述](https://img-blog.csdn.net/20170615163336067?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)
		left outer join

```python
df.join(df2, "name", "left").select("id", "name", "age", "height").orderBy("id").show()
或者
df.join(df2, "name", "left").select("id", df.name, "age", "height").orderBy("id").show()
```

结果如下：
![这里写图片描述](https://img-blog.csdn.net/20170615163627899?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)
right outer join

```python
df.join(df2, "name", "right").select("id", "name", "age", "height").orderBy("id").show()
或者
df.join(df2, "name", "right").select("id", df2.name, "age", "height").orderBy("id").show()
```

结果如下：
![这里写图片描述](https://img-blog.csdn.net/20170615163841736?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

3. orderBy()函数
   默认是升序排列

```python
from pyspark.sql.functions import *
df2.orderBy("height",desc("name")).show()
```

结果如下：
![这里写图片描述](https://img-blog.csdn.net/20170615164150065?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

```python
df2.orderBy(["height","name"]).show()
```

![这里写图片描述](https://img-blog.csdn.net/20170615164316298?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvemhvdXNpc2h1bw==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)
上述结果是不一样的，名字排序顺序不一样

4. cast()函数
   常用来做类型转换

```python
df.select(df.age.cast(StringType())).show()
或者
df.selectExpr("cast(age as string)age").show()
```

5 row_number().over()

```python
from pyspark.sql.types import *
from pyspark.sql import Window
from pyspark.sql.functions import *
rdd = sc.parallelize([(1,'Alice', 18),(2,'Andy', 19),(3,'Bob', 17),(1,'Justin', 21),(1,'Cindy', 20)])
schema = StructType([
    StructField("id", IntegerType(), True),
    StructField("name", StringType(), True),
    StructField("age", IntegerType(), True)
])
df = spark.createDataFrame(rdd, schema)
#按照每个组内的年龄排序，组外的分布并不管
df.withColumn("rn", row_number().over(Window.partitionBy("id").orderBy("age"))).show()
#结果如下：
# +---+------+---+---+
# | id|  name|age| rn|
# +---+------+---+---+
# |  1| Alice| 18|  1|
# |  1| Cindy| 20|  2|
# |  1|Justin| 21|  3|
# |  3|   Bob| 17|  1|
# |  2|  Andy| 19|  1|
# +---+------+---+---+

#按照年龄排序，组外面分布也管
df.withColumn("rn", row_number().over(Window.partitionBy("id").orderBy("age"))).orderBy("age").show()
#结果如下：
# +---+------+---+---+
# | id|  name|age| rn|
# +---+------+---+---+
# |  3|   Bob| 17|  1|
# |  1| Alice| 18|  1|
# |  2|  Andy| 19|  1|
# |  1| Cindy| 20|  2|
# |  1|Justin| 21|  3|
# +---+------+---+---+
```