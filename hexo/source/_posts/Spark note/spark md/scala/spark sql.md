---
title: "Spark SQL的selectExpr"
date: 2019-11-01 00:39:51
slug: "spark sql"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

```scala

import org.apache.spark.sql.SparkSession;

val spark = SparkSession.builder().appName("Spark Hive Example").config("spark.sql.warehouse.dir","/user/hive/warehouse").enableHiveSupport().getOrCreate()

spark.sql("SELECT * FROM refbanking50.recommendation_feature").show();







```







# Spark SQL的selectExpr

```scala
//两者等价,可看作把sql语句直接拿来使用
df1.selectExpr("*","(DEST_COUNTRY_NAME = ORIGIN_COUNTRY_NAME) as withincountry").show(5)
spark.sql("select * ,
(DEST_COUNTRY_NAME = ORIGIN_COUNTRY_NAME) as withincountry from dfTable limit 5")
```





# Spark ML函数VectorAssembler

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/lichao_ustc/article/details/52688127

从源数据中提取特征指标数据，这是一个比较典型且通用的步骤，因为我们的原始数据集里，经常会包含一些非指标数据，如 ID，Description 等。为方便后续模型进行特征输入，需要部分列的数据转换为特征向量，并统一命名，VectorAssembler类完成这一任务。VectorAssembler是一个transformer，将多列数据转化为单列的向量列。

```scala
import org.apache.spark.ml.feature.VectorAssembler
import org.apache.spark.ml.linalg.Vectors

val dataset = spark.createDataFrame(
  Seq((0, 18, 1.0, Vectors.dense(0.0, 10.0, 0.5), 1.0))
).toDF("id", "hour", "mobile", "userFeatures", "clicked")

val assembler = new VectorAssembler()
  .setInputCols(Array("hour", "mobile", "userFeatures"))
  .setOutputCol("features")

val output = assembler.transform(dataset)
println(output.select("features", "clicked").first())
```

转化前的数据：

```scala
id | hour | mobile | userFeatures     | clicked
----|------|--------|------------------|---------
 0  | 18   | 1.0    | [0.0, 10.0, 0.5] | 1.0
```

转化后的数据：

```scala
id | hour | mobile | userFeatures     | clicked | features
----|------|--------|------------------|---------|-----------------------------
 0  | 18   | 1.0    | [0.0, 10.0, 0.5] | 1.0     | [18.0, 1.0, 0.0, 10.0, 0.5]
```





# Spark ML机器学习：绝对值最大标准化-MaxAbsScaler

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/linweidong/article/details/87278960

​	数据归一化，以房价预测为案例，房价(y)通常与离市中心距离(x1)、面积(x2)、楼层(x3)有关，设y=ax1+bx2+cx3，那么abc就是我们需要重点解决的参数。但是有个问题，面积一般数值是比较大的，100平甚至更多，而距离一般都是几公里而已，b参数只要一点变化都能对房价产生巨大影响，而a的变化对房价的影响相对就小很多了。显然这会影响最终的准确性，毕竟距离可是个非常大的影响因素啊。 所以, 需要使用特征的归一化, 取值跨度大的特征数据, 我们浓缩一下, 跨度小的括展一下, 使得他们的**跨度尽量统一**。
**归一化就是将所有特征值都等比地缩小到0-1或者-1到1之间的区间内。其目的是为了使特征都在相同的规模中。**

`MaxAbsScaler`转换由向量列组成的数据集,将每个特征调整到`[-1,1]`的范围,它通过每个特征内的最大绝对值来划分。 它不会移动和聚集数据,因此不会破坏任何的稀疏性。

`MaxAbsScaler`计算数据集上的统计数据,生成`MaxAbsScalerModel`,然后使用生成的模型分别的转换特征到范围`[-1,1]`。下面是程序调用的例子。

```scala
// $example on$
import org.apache.spark.SparkConf
import org.apache.spark.ml.feature.MaxAbsScaler
import org.apache.spark.ml.linalg.Vectors
// $example off$
import org.apache.spark.sql.SparkSession
/*
所有值都扫描一遍，计算出最大最小值，比如1000的话那么absMax=1000。最后返回MaxAbsScalerModel
第一列1.0、2.0、4.0中最小为1.0，最大为4.0，2.0为0.5，第二列0.1、1.0、10.0依次类推
 */

object MaxAbsScalerExample {
  def main(args: Array[String]): Unit = {
    val sparkConf = new SparkConf();
    sparkConf.setMaster("local[*]").setAppName(this.getClass.getSimpleName)
    val spark = SparkSession
      .builder
      .config(sparkConf)
      .appName("MaxAbsScalerExample")
      .getOrCreate()

    // $example on$
    val dataFrame = spark.createDataFrame(Seq(
      (0, Vectors.dense(1.0, 0.1, -8.0)),
      (1, Vectors.dense(2.0, 1.0, -4.0)),
      (2, Vectors.dense(4.0, 10.0, 8.0))
    )).toDF("id", "features")

    val scaler = new MaxAbsScaler()
      .setInputCol("features")
      .setOutputCol("scaledFeatures")

    // Compute summary statistics and generate MaxAbsScalerModel
    val scalerModel = scaler.fit(dataFrame)

    // rescale each feature to range [-1, 1]
    val scaledData = scalerModel.transform(dataFrame)
    scaledData.select("features", "scaledFeatures").show()
    // $example off$

    spark.stop()
  }
}
```

 

结果：

```
+————–+—————-+
| features| scaledFeatures|
+————–+—————-+
|[1.0,0.1,-8.0]|[0.25,0.01,-1.0]|
|[2.0,1.0,-4.0]| [0.5,0.1,-0.5]|
|[4.0,10.0,8.0]| [1.0,1.0,1.0]|
+————–+—————-+
```





