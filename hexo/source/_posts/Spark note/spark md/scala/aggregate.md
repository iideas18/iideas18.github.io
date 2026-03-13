---
title: "spark aggregate函数详解"
date: 2019-11-01 04:10:04
cover: "https://img-blog.csdn.net/20180114163912311?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvdTAxMTcyNDQwMg==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast"
slug: "aggregate"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# spark aggregate函数详解

2017-09-25 18:53:39 更多

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/bitcarmanlee/article/details/78088304

aggregate算是spark中比较常用的一个函数，理解起来会比较费劲一些，现在通过几个详细的例子带大家来着重理解一下aggregate的用法。

## 1.先看看aggregate的函数签名

在spark的源码中，可以看到aggregate函数的签名如下：

```
def aggregate[U: ClassTag](zeroValue: U)(seqOp: (U, T) => U, combOp: (U, U) => U): U1
```

可以看出，这个函数是个柯里化的方法，输入参数分为了两部分：`(zeroValue: U)`与`(seqOp: (U, T) => U, combOp: (U, U) => U)`

## 2.aggregate的用法

函数签名比较复杂，可能有的小伙伴看着就晕菜了。别捉急，我们再来看看函数前面的注释，关于此函数的用法我们就会比较清楚。

```
  /**
   * Aggregate the elements of each partition, and then the results for all the partitions, using
   * given combine functions and a neutral "zero value". This function can return a different result
   * type, U, than the type of this RDD, T. Thus, we need one operation for merging a T into an U
   * and one operation for merging two U's, as in scala.TraversableOnce. Both of these functions are
   * allowed to modify and return their first argument instead of creating a new U to avoid memory
   * allocation.
   *
   * @param zeroValue the initial value for the accumulated result of each partition for the
   *                  `seqOp` operator, and also the initial value for the combine results from
   *                  different partitions for the `combOp` operator - this will typically be the
   *                  neutral element (e.g. `Nil` for list concatenation or `0` for summation)
   * @param seqOp an operator used to accumulate results within a partition
   * @param combOp an associative operator used to combine results from different partitions
   */123456789101112131415
```

翻译过来就是：aggregate先对每个分区的元素做聚集，然后对所有分区的结果做聚集，聚集过程中，使用的是给定的聚集函数以及初始值”zero value”。这个函数能返回一个与原始RDD不同的类型U，因此，需要一个合并RDD类型T到结果类型U的函数，还需要一个合并类型U的函数。这两个函数都可以修改和返回他们的第一个参数，而不是重新新建一个U类型的参数以避免重新分配内存。
参数zeroValue：`seqOp`运算符的每个分区的累积结果的初始值以及`combOp`运算符的不同分区的组合结果的初始值 - 这通常将是初始元素（例如“Nil”表的列表 连接或“0”表示求和）
参数seqOp： 每个分区累积结果的聚集函数。
参数combOp： 一个关联运算符用于组合不同分区的结果

## 3.求平均值

看来了上面的原理介绍，接下来我们看干货。
首先可以看网上最多的一个例子：

```
val list = List(1,2,3,4,5,6,7,8,9)
val (mul, sum, count) = sc.parallelize(list, 2).aggregate((1, 0, 0))(
    (acc, number) => (acc._1 * number, acc._2 + number, acc._3 + 1),
    (x, y) => (x._1 * y._1, x._2 + y._2, x._3 + y._3)
        )
    (sum / count, mul)123456
```

在常见的求均值的基础上稍作了变动，sum是求和，count是累积元素的个数，mul是求各元素的乘积。
解释一下具体过程：
1.初始值是(1, 0 ,0)
2.number是函数中的T，也就是List中的元素，此时类型为Int。而acc的类型为(Int, Int, Int)。acc._1 * num是各元素相乘(初始值为1)，acc._2 + number为各元素相加。
3.sum / count为计算平均数。

## 4.另外的例子

为了加深理解，看另外一个的例子。

```
        val raw = List("a", "b", "d", "f", "g", "h", "o", "q", "x", "y")
        val (biggerthanf, lessthanf) = sc.parallelize(raw, 1).aggregate((0, 0))(
            (cc, str) => {
                var biggerf = cc._1
                var lessf = cc._2
                if (str.compareTo("f") >= 0) biggerf = cc._1 + 1
                else if(str.compareTo("f") < 0) lessf = cc._2 + 1
                (biggerf, lessf)
            },
            (x, y) => (x._1 + y._1, x._2 + y._2)
        )1234567891011
```

这个例子中，我们想做的就是统计一下在raw这个list中，比”f”大与比”f”小的元素分别有多少个。代码本身的逻辑也比较简单，就不再更多解释。

## 5.aggregateByKey与combineByKey的比较

aggregate是针对序列的操作，aggregateByKey则是针对k,v对的操作。顾名思义，aggregateByKey则是针对key做aggregate操作。spark中函数的原型如下：

```
  def aggregateByKey[U: ClassTag](zeroValue: U)(seqOp: (U, V) => U,
      combOp: (U, U) => U): RDD[(K, U)] = self.withScope {
    aggregateByKey(zeroValue, defaultPartitioner(self))(seqOp, combOp)
  }1234
```

都是针对k,v对的操作，spark中还有一个combineByKey的操作：

```
  def combineByKey[C](
      createCombiner: V => C,
      mergeValue: (C, V) => C,
      mergeCombiners: (C, C) => C): RDD[(K, C)] = self.withScope {
    combineByKeyWithClassTag(createCombiner, mergeValue, mergeCombiners)(null)
  }123456
```

为了看清楚两个的联系，我们再看看 aggregateByKey里面的真正实现：

```
  def aggregateByKey[U: ClassTag](zeroValue: U, partitioner: Partitioner)(seqOp: (U, V) => U,
      combOp: (U, U) => U): RDD[(K, U)] = self.withScope {
    // Serialize the zero value to a byte array so that we can get a new clone of it on each key
    val zeroBuffer = SparkEnv.get.serializer.newInstance().serialize(zeroValue)
    val zeroArray = new Array[Byte](zeroBuffer.limit)
    zeroBuffer.get(zeroArray)

    lazy val cachedSerializer = SparkEnv.get.serializer.newInstance()
    val createZero = () => cachedSerializer.deserialize[U](ByteBuffer.wrap(zeroArray))

    // We will clean the combiner closure later in `combineByKey`
    val cleanedSeqOp = self.context.clean(seqOp)
    combineByKeyWithClassTag[U]((v: V) => cleanedSeqOp(createZero(), v),
      cleanedSeqOp, combOp, partitioner)
  }123456789101112131415
```

从上面这段源码可以清晰看出，aggregateByKey调用的就是combineByKey方法。seqOp方法就是mergeValue，combOp方法则是mergeCombiners，cleanedSeqOp(createZero(), v)是createCombiner, 也就是传入的seqOp函数, 只不过其中一个值是传入的zeroValue而已！
因此, 当createCombiner和mergeValue函数的操作相同, aggregateByKey更为合适！

# spark-aggregate与treeAggregate的理解

2018-01-14 16:41:13 更多

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/u011724402/article/details/79057450

spark-mllib中许多算法用到了treeAggregate这个方法，使用该方法而不是aggregate方法能够提升算法的性能。比如mllib中的GaussianMixture模型可以提升20%的性能，见[treeAggregate](https://issues.apache.org/jira/browse/SPARK-17033)

此前对这种聚合方式不是很了解，因此这里记录一下。

#### 1. 一个例子

```scala
def main(args: Array[String]): Unit = {
  val spark = SparkSession
    .builder
    .appName(s"agg")
    .master("local")
    .getOrCreate()
  val sc = spark.sparkContext

  def seqOp(s1:Int, s2:Int):Int = {
    println("seq: "+s1+":"+s2)
    s1 + s2
  }

  def combOp(c1: Int, c2: Int): Int = {
    println("comb: "+c1+":"+c2)
    c1 + c2
  }

  val rdd = sc.parallelize(1 to 12).repartition(6)
  val res1 = rdd.aggregate(0)(seqOp, combOp)
// val res2 = rdd.treeAggregate(0)(seqOp, combOp)
  println(res1)
// println(res2)
}
```

aggregate:

> seq: 0:6
> seq: 6:12
> comb: 0:18
> seq: 0:1
> seq: 1:7
> comb: 18:8
> seq: 0:2
> seq: 2:8
> comb: 26:10
> seq: 0:3
> seq: 3:9
> comb: 36:12
> seq: 0:4
> seq: 4:10
> comb: 48:14
> seq: 0:5
> seq: 5:11
> comb: 62:16
> 78

treeAggregate:

> seq: 0:6
> seq: 6:12
> seq: 0:1
> seq: 1:7
> seq: 0:2
> seq: 2:8
> seq: 0:3
> seq: 3:9
> seq: 0:4
> seq: 4:10
> seq: 0:5
> seq: 5:11
> [Stage 2:> (0 + 0) / 2]
>
> comb: 18:10
> comb: 28:14
> comb: 8:12
> comb: 20:16
> comb: 42:36
> 78

#### 2. Aggregate

treeAggregate是aggregate的一种特殊形式，因此了解treeAggregate首先需要了解aggregate的如何对数据做聚合操作。方法定义如下：

```scala
def aggregate[U: ClassTag](zeroValue: U)(seqOp: (U, T) => U, combOp: (U, U) => U): U1
```

从aggregate方法的定义中，可以看到它需要传入三个参数：

1. 聚合的初始值：zeroValue: U
2. 对序列操作的函数：seqOp
3. 聚合函数：combOp

aggregate函数将每个分区进行seqOp，且从zeroValue开始遍历分区里的所有元素。然后用combOp。从zeroValue开始遍历所有分区的结果。

注：每个partition的seqOp只应用一次zeroValue，最后的combOp也应用一次zeroValue。

用一张图来说明上面的计算过程：

![aggregate](https://img-blog.csdn.net/20180114163912311?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvdTAxMTcyNDQwMg==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

#### 3. treeAggregate

```scala
def treeAggregate[U: ClassTag](zeroValue: U)(
  seqOp: (U, T) => U,
  combOp: (U, U) => U,
  depth: Int = 2): U1234
```

 与aggregate不同的是treeAggregate多了depth的参数，其他参数含义相同。aggregate在执行完SeqOp后会将计算结果拿到driver端使用CombOp遍历一次SeqOp计算的结果，最终得到聚合结果。而treeAggregate不会一次就Comb得到最终结果，SeqOp得到的结果也许很大，直接拉到driver可能会OutOfMemory，因此它会先把分区的结果做局部聚合(reduceByKey)，如果分区数过多时会做分区合并，之后再把结果拿到driver端做reduce。

注：与aggregate不同的地方是：在每个分区，会做两次或者多次combOp，避免将所有局部的值传给driver端。另外，初始值zeroValue不会参与combOp。

具体可以参见源码：

```scala
  /**
   * Aggregates the elements of this RDD in a multi-level tree pattern.
   *
   * @param depth suggested depth of the tree (default: 2)
   * @see [[org.apache.spark.rdd.RDD#aggregate]]
   */
  def treeAggregate[U: ClassTag](zeroValue: U)(
      seqOp: (U, T) => U,
      combOp: (U, U) => U,
      depth: Int = 2): U = withScope {
    require(depth >= 1, s"Depth must be greater than or equal to 1 but got $depth.")
    if (partitions.length == 0) {
      Utils.clone(zeroValue, context.env.closureSerializer.newInstance())
    } else {
      val cleanSeqOp = context.clean(seqOp)
      val cleanCombOp = context.clean(combOp)
      val aggregatePartition =
        (it: Iterator[T]) => it.aggregate(zeroValue)(cleanSeqOp, cleanCombOp)
      var partiallyAggregated = mapPartitions(it => Iterator(aggregatePartition(it)))
      var numPartitions = partiallyAggregated.partitions.length
      val scale = math.max(math.ceil(math.pow(numPartitions, 1.0 / depth)).toInt, 2)
      // If creating an extra level doesn't help reduce
      // the wall-clock time, we stop tree aggregation.

      // Don't trigger TreeAggregation when it doesn't save wall-clock time
      while (numPartitions > scale + math.ceil(numPartitions.toDouble / scale)) {
        numPartitions /= scale
        val curNumPartitions = numPartitions
        partiallyAggregated = partiallyAggregated.mapPartitionsWithIndex {
          (i, iter) => iter.map((i % curNumPartitions, _))
        }.reduceByKey(new HashPartitioner(curNumPartitions), cleanCombOp).values
      }
      partiallyAggregated.reduce(cleanCombOp)
    }
  }1234567891011121314151617181920212223242526272829303132333435
```

还是用一张图来说明：
![treeAggregate](https://img-blog.csdn.net/20180114163949967?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvdTAxMTcyNDQwMg==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

参考：

https://www.cnblogs.com/drawwindows/p/5762392.html

http://blog.csdn.net/lookqlp/article/details/52121057

https://www.jianshu.com/p/27222830d21a