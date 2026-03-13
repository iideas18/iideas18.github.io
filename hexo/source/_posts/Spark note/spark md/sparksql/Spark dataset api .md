---
title: "Spark dataset api 列表 & 练习"
date: 2019-10-31 18:27:38
slug: "Spark dataset api "
categories:
  - "Spark note"
  - "spark md"
  - "sparksql"
---

# Spark dataset api 列表 & 练习

2018-05-26 15:52:50 更多

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/u013560925/article/details/80398081

## 1. 背景

Spark版本：2.2

DataSet API网址：http://spark.apache.org/docs/2.2.1/api/java/org/apache/spark/sql/Dataset.html

## 2. 正文

### 1.groupBy()

a.使用方法

按照某几列元素进行分组

```scala
dataset.groupBy("columnName","columnName")dataset.groupBy(dataset("columnName"))
```

b.注意事项

   运算完成之后，返回的不是普通的DataSet数据类型，而是org.apache.spark.sql.RelationalGroupedDataset

   **org.apache.spark.sql.RelationalGroupedDataset**可是用的方法有max、min、agg和sum等少量函数

c.使用举例

```scala
logDS.groupBy("userID").max()
```

![img](https://img-blog.csdn.net/20180521215120379)

### 2.agg() 

a.使用方法

dataset 聚合函数api，有多种列名的传入方式，使用as，可是重新命名，所有计算的列sum、avg或者distinct都会成为新的列，默认列明**sum(columnName)**，常常跟在groupBy算子后使用

```java
dataset.agg(sum(dataset("columnsName")),sum(dataset("")).as("newName")) dataset.agg(sum("columnsName"),avg("columnsName").as("newName"))
```

b.注意事项

  如果想要使用更多的内置函数，请引入： **import org.apache.spark.sql.functions._**

  计算完会生成新的列，所以一般放了方便后期使用，会进行重命名

c.使用举例

  经长和groupBy后使用，对同一group内的数据操作

```java
logDs.groupBy("userID").agg(max("consumed"),max("logID"))
```

![img](https://img-blog.csdn.net/20180521214445587)

### 3.sortWithinPartition()

a.使用方法

在分区内部进行排序，执行完成后，分区内部有序

```java
dataset.sortWithinPartitions("columnName1","columnName2")
```

b.注意事项

   一般在调用改方法之前，会按照规则将数据重新分区，否则没有意义

   调用之后可以接**foreachPartition()**遍历每一个分区

   但是奇怪的是，我没有查到dataset相关分区的方法，只有rdd(key-value)才有分区的能力，所以，这个方法的使用意义和环境暂时还不清楚，使用的频率也较低

c.使用举例   

```java
personsDS.sortWithinPartitions("name").mapPartitions(it=>{      it.toList.reverse.iterator})
```

### 4.sort()

a.使用方法

按照某几列进行排序

```java
dataset.sort(dataset("name"),dataset("age").desc)
dataset.sort(dataset("age").desc)
dataset.sort("columnName")
```

b.使用注意

  传入字符串为列名的时候，无法指定降序排序    

c.使用举例

```java
 personsDS.sort(personsDS("age").desc)
```

### 5.OrderBy()

可以看到源代码中，orderBy调用可sort

```java
def orderBy(sortCol: String, sortCols: String*): Dataset[T] = sort(sortCol, sortCols : _*)
```

### 6.hint

### 7.select

a.使用说明

  选取某几列，但是在代码中就已经固定了选取的列的数量，如果想动态选取列，请使用spark sql

 . 可以在select中直接对列进行修改数据

b.使用举例

```java
dataset.select("columnName1","columnName2")dataset.select(dataset("columnName"))dataset.select(dataset("columnName")+1)
```

### 8.selectExpr

a.使用说明

  同select但是，可以填写表达式

b.使用举例

```java
ds.selectExpr("colA", "colB as newName", "abs(colC)")ds.select(expr("colA"), expr("colB as newName"), expr("abs(colC)"))
```

### 9.rollup、cube

a.使用说明

  rollup和cube的实现方式都是使用了RelationalGroupedDataset来实现，跟groupBy有点相似

  cube: 选中的每个列的每种元素，进行组合

  rollup:组合的种类较少，并不是全组合

  使用场合比较少

b.使用举例

 方便理解，附上一些解释文章：

 https://www.cnblogs.com/wwxbi/p/6102646.html

 https://blog.csdn.net/shenqingkeji/article/details/52860843

### 10.drop

a.使用说明

返回删除某一列的新数据集

```java
dataset.drop("name","age")dataset.drop(personsDS("name"))
```

b.注意事项

 如果想删除多列，请使用string传递列名，column的方式只能删除一列

### 11.duplicates

a.使用说明

 删除包含重复元素的行，重复元素可以是多个列的元素结合

```scala
 val cols = Array("name","userID")    
 dataset.dropDuplicates(cols)    
 dataset.dropDuplicates("name")
```

b.使用举例

```scala
val row1 = List("wq",22,15)
val row2 = List("wq",12,15)
val row3 = List("tom",12,15)
import spark.implicits._
val dataRDD =  spark.sparkContext.parallelize(List(row1,row2,row3))
case class User(name:String,age:Int,length:Int)
val df = dataRDD.map
(x=>User(x(0).toString,x(1).toString.toInt,x(2).toString.toInt))
val ds = df.toDS()
val cols = Array("age","length")
ds.dropDuplicates(cols).show
```

![img](https://img-blog.csdn.net/20180524095356971)

### 12.describe

a.使用说明

对所有数据，按照列计算：最大值、最小值、均值、方差和总数

b.使用举例

 还是使用上面的数据

```scala
ds.describe().show
```

![img](https://img-blog.csdn.net/20180524095643825)

### 13.repartition、coalesce

a.使用说明：

重新分区，但是repartirion不能够使用自定义的partitioner，这里只是分区数目的变化

当分区数目由大变小的时候--->coalesce 避免shuffler

当分区数目由小变大的时候--->repartirion

b.使用举例

coalesce适合用在filterBy之后，避免数据倾斜，下面给出相关的使用文章：

https://blog.csdn.net/u013514928/article/details/52789169

### 14.filter

a.使用说明

filter 参数传递有三种方式：spark方式，sql方式，判断方法

b.使用举例

```java
dss.filter(dss("age")>15)
dss.filter("age > 15")
dss.filter(func (User)=> boolean) 
//因为我的数据每一行是一个User对象，所以方法输入是一个User对象，返回为boolean
```

filter还能查询空值，其实还是sql的方式比如：

```scala
dataset.filter("colName is notnull").select("colName").limit(10).show
```

### 15.dtypes、columns

a.使用说明

dtypes 返回一个数组，每个列的列名和类型

columns 返回一个数组，每个列列名

### 16.checkpoint

a.使用说明

checkpoint，rdd或者dataset磁盘存储，用于比较关键的部分的数据，persist是内存缓存，而checkpoint是真正落盘的存储，不会丢失，当第二次使用时，在检查完cache之后，如果没有缓存数据，就是使用checkpoint数据，而避免重新计算

b.相关文章

[spark中checkpoint的使用](https://blog.csdn.net/qq_20641565/article/details/76223002)

### 17.Na

a.使用说明

检查ds中的残缺元素，返回值为DataFrameNaFunctions

DataFrameNaFunctions之后有三种方法比较常见：
drop、fill、replace

b.使用举例

```scala
dataset.na.drop() //过滤包含空值的行
dataset.na.drop(Array("colName","colName"))  //删除某些列是空值的行
dataset.na.drop(10，Array("colName"))  		//删除某一列的值低于10的行
dataset.na.fill("value") 					//填充所有空值
dataset.na.fill(value="fillValue",cols=Array("colName1","colName2") ) 										      //填充某几列空值
data1.na.fill(Map("colName1"->"value1","colName2"->"value2") ) 
                                 	  	  	//不同列空值不同处理
```

### 18. join

a.使用说明

ds之间做join操作，其中join参数中会有joinType来表示join的类型

b.使用举例

我平时一般倾向于第三种join方式，也就是===

```scala
// Joining df1 and df2 using the column "user_id"
df1.join(df2, "user_id")
 
// Joining df1 and df2 using the columns "user_id" and "user_name"
df1.join(df2, Seq("user_id", "user_name"))
 
// The following two are equivalent:
df1.join(df2, $"df1Key" === $"df2Key")
df1.join(df2).where($"df1Key" === $"df2Key")
 
// Scala:
import org.apache.spark.sql.functions._
df1.join(df2, $"df1Key" === $"df2Key", "outer")
```

### 19. joinWith

a.使用说明

跟join 使用方式相似，但是joinWith之后的结果不会合并为一个，如下使用举例所示

b.使用举例

![img](https://img-blog.csdn.net/20180525105218748?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3UwMTM1NjA5MjU=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

### 20. apply、col

a.使用说明

跟select相同，输入列名，返回列

b.使用举例

```scala
public Column apply(String colName)
public Column col(String colName)
```

### 21. groupByKey

a.使用说明

  从Dataset<Class> 转换成 KeyValueGroupedDataset<K,T> 类型

  不是按照key 分组，而是转换成key,value结构

b.使用方法

KeyValueGroupedDataset后面可以接agg等api 

```java
personsDS.groupByKey(per=>(per.name,per.age))
```

### 22.union

a.使用说明

unionA方法：对两个DataFrame进行组合 

类似于SQL中的UNION ALL操作。 

将两个dataset所有数据，将一个dataset的所有行接在另外一个后面

b.使用举例

```java
personsDS.union(personsDS)
```

### 23.sample

a.使用说明

随机取样：

```java
public Dataset<T> sample(boolean withReplacement,
                         double fraction,
                         long seed)
```

withReplacement是建立不同的采样器；fraction为采样比例；seed为随机生成器的种子

b.使用举例

```java
dataset.sample(false,0.2,100);
```

### 24.randomSplit

a.使用说明

随机划分dataset

```java
public Dataset<T>[] randomSplit(double[] weights,
                                long seed)
```

b.使用举例

```java
double [] weights =  {0.1,0.2,0.7};//依据所提供的权重对该RDD进行随机划分Dataset<Class> [] randomSplitDs = dataset.randomSplit(weights,100);
```

### 25.mapPartitions

a.使用说明

按照分区遍历每一个元素

b.使用举例

```java
def doubleFunc(iter: Iterator[Int]) : Iterator[(Int,Int)] = {    var res = List[(Int,Int)]()    while (iter.hasNext)    {      val cur = iter.next;      res .::= (cur,cur*2)    }    res.iterator  }val result = a.mapPartitions(doubleFunc)
```

### 26.foreach

a.使用说明

对每一行的元素进行遍历

b.使用举例

```java
dataset.foreach(p=>p.age)
```

### 27.foreachPartitoins

a.使用说明

按照分区遍历元素

当需要开关、访问数据库或者其他占用资源的操作的时候，可是在foreachPartitions里进行

b.使用举例

foreachPartitions和mapPartions的区别：https://blog.csdn.net/u010454030/article/details/78897150

foreachPartitions开关数据库举例：https://blog.csdn.net/lsshlsw/article/details/49789373