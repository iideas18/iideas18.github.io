---
title: "Map 函数"
date: 2020-06-04 23:58:24
cover: "https://images2015.cnblogs.com/blog/776259/201604/776259-20160410013320031-1234218566.png"
slug: "Spark map"
categories:
  - "Spark note"
  - "spark md"
---

# Map 函数

## 1.简述

**Transformation（转换）**操作：**return a new RDD**

**map(func)：**数据集中的每个元素经过用户**自定义的函数**转换形成一个新的RDD，新的RDD叫MappedRDD

```scala
object Map {
  def main(args: Array[String]) {
    val conf = new SparkConf().setMaster("local").setAppName("map")
    val sc = new SparkContext(conf)
    val rdd = sc.parallelize(1 to 10)  //创建RDD
    val map = rdd.map(_*2)             //对RDD中的每个元素都乘于2
    map.foreach(x => print(x+" "))
    sc.stop()
  }
}
```

输出：

```
2 4 6 8 10 12 14 16 18 20
```

**(RDD依赖图：红色块表示一个RDD区，黑色块表示该分区集合，下同)**

![img](https://images2015.cnblogs.com/blog/776259/201604/776259-20160410013320031-1234218566.png)

## 2. 分析

### 1. 在RDD.scala中，有：

![image-20200531183231824](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200531183231824.png)

**SparkContext.scala**:

![image-20200531183351255](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200531183351255.png)

**Iterator.scala**:

![image-20200531183332429](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200531183332429.png)

**MapPartitionsRDD.scala**:

![image-20200531183444905](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200531183444905.png)

![image-20200531184422235](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200531184422235.png)

![image-20200531184439532](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200531184439532.png)

![image-20200531185118119](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200531185118119.png)

![image-20200604231105357](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200604231105357.png)

![image-20200531195229346](C:\Users\zhouy1\AppData\Roaming\Typora\typora-user-images\image-20200531195229346.png)

