---
title: "[Spark笔记之使用UDF（User Define Function）](https://www.cnblogs.com/cc11001100/p/9463909.html)"
date: 2019-11-01 00:40:18
slug: "UDF"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# [Spark笔记之使用UDF（User Define Function）](https://www.cnblogs.com/cc11001100/p/9463909.html)

# 一、UDF介绍

​		UDF（User Define Function），即**用户自定义函数**，Spark的官方文档中没有对UDF做过多介绍，猜想可能是认为比较简单吧。

​		几乎所有sql数据库的实现都为用户提供了扩展接口来增强sql语句的处理能力，这些扩展称之为UDXXX，即用户定义（User Define）的XXX，这个XXX可以是对单行操作的UDF，或者是对多行操作的UDAF，或者是UDTF，本次主要介绍UDF。

​		UDF的UD表示用户定义，既然有用户定义，就会有系统内建（built-in），一些系统内建的函数比如abs，接受一个数字返回它的绝对值，比如substr对字符串进行截取，它们的特点就是在执行sql语句的时候对每行记录调用一次，每调用一次传入一些参数，这些参数通常是表的某一列或者某几列在当前行的值，然后产生一个输出作为结果。

​		适用场景：UDF使用频率极高，对于单条记录进行比较复杂的操作，使用内置函数无法完成或者比较复杂的情况都比较适合使用UDF。 

# 二、使用UDF

## 2.1 在SQL语句中使用UDF

在sql语句中使用UDF指的是在spark.sql("select udf_foo(…)")这种方式使用UDF，套路大致有以下几步：

1. 实现UDF，可以是case class，可以是匿名类

2. 注册到spark，将类绑定到一个name，后续会使用这个name来调用函数

3. 在sql语句中调用注册的name调用UDF

下面是一个简单的示例：

```scala
package cc11001100.spark.sql.udf
 
import org.apache.spark.sql.SparkSession
 
object SparkUdfInSqlBasicUsageStudy {
 
  def main(args: Array[String]): Unit = {
 
    val spark = SparkSession.builder().master("local[*]").appName("SparkUdfStudy").getOrCreate()
    import spark.implicits._
    // 注册可以在sql语句中使用的UDF
    spark.udf.register("to_uppercase", (s: String) => s.toUpperCase())
    // 创建一张表
    Seq((1, "foo"), (2, "bar")).toDF("id", "text").createOrReplaceTempView("t_foo")
    spark.sql("select id, to_uppercase(text) from t_foo").show()
 
  }
 
}
```

运行结果：

![image](https://images2018.cnblogs.com/blog/784924/201808/784924-20180812183618495-371886646.png) 

 

## 2.2 直接对列应用UDF（脱离sql）

在sql语句中使用比较麻烦，还要进行注册什么的，可以定义一个UDF然后将它应用到某个列上：

```scala
package cc11001100.spark.sql.udf
 
import org.apache.spark.sql.{SparkSession, functions}
 
object SparkUdfInFunctionBasicUsageStudy {
 
  def main(args: Array[String]): Unit = {
 
    val spark = SparkSession.builder().master("local[*]").appName("SparkUdfStudy").getOrCreate()
 
    import spark.implicits._
    val ds = Seq((1, "foo"), (2, "bar")).toDF("id", "text")
    val toUpperCase = functions.udf((s: String) => s.toUpperCase)
    ds.withColumn("text", toUpperCase('text)).show()
 
  }
 
}
```

运行效果：

![image](https://images2018.cnblogs.com/blog/784924/201808/784924-20180812183620847-1003328809.png)

 

需要注意的是受Scala limit 22限制，自定义UDF最多接受22个参数，不过正常情况下完全够用了。

 

# UDF(UserDefinedFunction)

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/sunjianqiang12345/article/details/85863950

  UDF类似于map或lambda，其定义的函数可用于Spark中的DataFrame中行数据的处理。

```java
val df = Seq(
      (1, "boy", "裤子"),
      (2, "girl", "裤子"),
      (3, "boy", "裙子"),
      (4, "girl", "裙子"),
      (5, "girl", "裙子")
    ).toDF("id", "sex", "dressing")
def addpre(pre: String) = udf{ (xing: String, dress: String) => xing + pre + dress  }
df.select($"id", $"sex", $"dressing", addpre(" dresses ")($"sex", $"dressing")).show()
    
// 运行结果
+---+----+--------+------------------+
| id| sex|dressing|UDF(sex, dressing)|
+---+----+--------+------------------+
|  1| boy|      裤子|    boy dresses 裤子|
|  2|girl|      裤子|   girl dresses 裤子|
|  3| boy|      裙子|    boy dresses 裙子|
|  4|girl|      裙子|   girl dresses 裙子|
|  5|girl|      裙子|   girl dresses 裙子|
+---+----+--------+------------------+
```

 

