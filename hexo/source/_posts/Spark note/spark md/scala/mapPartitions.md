---
title: "spark算子---mapPartitions"
date: 2019-11-22 03:01:47
slug: "mapPartitions"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# spark算子---mapPartitions

2018-05-11 12:28:19 更多

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/wuxintdrh/article/details/80278479

## 1. mapPartitions算子

![这里写图片描述](https://img-blog.csdn.net/20180511140539503?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3d1eGludGRyaA==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

### 1、首先看下`f: Iterator[T] => Iterator[U],`

Scala的解释器在**解析函数参数(function arguments)**时有两种方式：

- **传值调用（call-by-value）**：先计算参数表达式的值，再应用到函数内部；
- **传名调用（call-by-name）**：将未计算的参数表达式直接应用到函数内部

在进入函数内部前，**传值调用**方式就已经将参数表达式的值计算完毕，而**传名调用**是在函数内部进行参数表达式的值计算的。

这就造成了一种现象，每次使用传名调用时，解释器都会计算一次表达式的值。

```scala
object Test {
   def main(args: Array[String]) {
        delayed(time());
   }

   def time() = {
      println("获取时间，单位为纳秒")
      System.nanoTime
   }
   def delayed( t: => Long ) = {
      println("在 delayed 方法内")
      println("参数： " + t)
      t
   }
}
```

以上实例中我们声明了 delayed 方法， 该方法**在变量名和变量类型**使用 => 符号来设置**传名调用**。执行以上代码，输出结果如下：

```
$ scalac Test.scala 
$ scala Test
在 delayed 方法内
获取时间，单位为纳秒
参数： 241550840475831
获取时间，单位为纳秒
```

实例中 delay 方法打印了一条信息表示进入了该方法，接着 delay 方法打印接收到的值，最后再返回 t。

### 2. 高阶函数

```scala
    //===============高阶函数start====================
    /**
     * 高阶函数<br>
     * Scala允许定义高阶函数。它是将其他函数作为参数或其结果是函数的函数。<br>
     * 尝试以下示例程序，apply()函数接受另一个函数f和值v，并将函数f应用于v。<br>
     * 调用：  println(apply(layout, 10))
     */
     def apply(f: Int => String, v: Int) = f(v)
     def layout[A](x: A) = "[" + x.toString() + "]"
     //===============高阶函数end====================
```

## 2. 再来看mapPartitions算子

![这里写图片描述](https://img-blog.csdn.net/20180511140539503?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3d1eGludGRyaA==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

### 调用

![这里写图片描述](https://img-blog.csdn.net/20180511140947232?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3d1eGludGRyaA==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

传入的又是一个匿名函数

## 3. map与mapPartitions的区别

- **map**: 比如一个partition中有1万条数据；那么你的function要执行和计算1万次。
- **MapPartitions**:一个task仅仅会执行一次function，function一次接收所有的partition数据。只要执行一次就可以了，性能比较高。

如果在map过程中需要频繁创建额外的对象(例如将rdd中的数据通过jdbc写入数据库,map需要为每个元素创建一个链接而mapPartition为每个partition创建一个链接),则mapPartitions效率比map高的多。

SparkSql或DataFrame默认会对程序进行mapPartition的优化。

### 4. MapPartitions的缺点：一定是有的。

如果是普通的map操作，一次function的执行就处理一条数据；那么如果内存不够用的情况下，比如处理了1千条数据了，那么这个时候内存不够了，那么就可以将已经处理完的1千条数据从内存里面垃圾回收掉，或者用其他方法，腾出空间来吧。

所以说普通的map操作通常不会导致内存的OOM异常。

但是MapPartitions操作，对于大量数据来说，比如甚至一个partition，100万数据，一次传入一个function以后，那么可能一下子内存不够，但是又没有办法去腾出内存空间来，可能就OOM，内存溢出。





## [spark中map与mapPartitions区别](https://www.cnblogs.com/wbh1000/p/9846527.html)

在spark中，map与mapPartitions两个函数都是比较常用，这里使用代码来解释一下两者区别

```scala
import org.apache.spark.{SparkConf, SparkContext}

import scala.collection.mutable.ArrayBuffer

object MapAndPartitions {
  def main(args: Array[String]): Unit = {
    val sc = new SparkContext(new SparkConf().setAppName("map_mapPartitions_demo").setMaster("local"))
    val arrayRDD =sc.parallelize(Array(1,2,3,4,5,6,7,8,9))

    //map函数每次处理一个/行数据
    arrayRDD.map(element=>{
      element
    }).foreach(println)

    //mapPartitions每次处理一批数据
    //将 arrayRDD分成x批数据进行处理
    //elements是其中一批数据
    //mapPartitions返回一批数据（iterator）
    arrayRDD.mapPartitions(elements=>{
      var result = new ArrayBuffer[Int]()
      elements.foreach(element=>{
        result.+=(element)
      })
      result.iterator
    }).foreach(println)
  }
}
```

两个函数最终处理得到的结果是一样的

mapPartitions比较适合需要分批处理数据的情况，比如将数据插入某个表，每批数据只需要开启一次数据库连接，大大减少了连接开支，伪代码如下：

```scala
    arrayRDD.mapPartitions(datas=>{
      dbConnect = getDbConnect() //获取数据库连接
      datas.foreach(data=>{
        dbConnect.insert(data) //循环插入数据
      })
      dbConnect.commit() //提交数据库事务
      dbConnect.close() //关闭数据库连接
    })
```

