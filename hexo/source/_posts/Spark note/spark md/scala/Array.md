---
title: "scala之Array的方法"
date: 2019-11-22 19:33:23
slug: "Array"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# scala之Array的方法

2018-08-05 11:06:14 更多

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/zyp13781913772/article/details/81428862

[Scala开篇（目录）](http://blog.csdn.net/bdmh/article/details/50069117) 
数组是一种可变的、可索引的数据集合。在Scala中用Array[T]的形式来表示Java中的数组形式 T[]。

```scala
val numbers = Array(1, 2, 3, 4) //声明一个数组对象
val first = numbers(0) // 读取第一个元素
numbers(3) = 100 // 替换第四个元素为100
val biggerNumbers = numbers.map(_ * 2) // 所有元素乘2
```

Scala提供了大量的集合操作：

- **def ++[B](that: GenTraversableOnce[B]): Array[B]** 
  合并集合，并返回一个新的数组，新数组包含左右两个集合对象的内容。

```scala
val a = Array(1,2)    
val b = Array(3,4)    
val c = a ++ b    //c中的内容是(1,2,3,4)
```

- **def ++:[B >: A, That](that: collection.Traversable[B])(implicit bf: CanBuildFrom[Array[T], B, That]): That** 
  这个方法同上一个方法类似，两个加号后面多了一个冒号，但是不同的是右边操纵数的类型决定着返回结果的类型。下面代码中List和LinkedList结合，返回结果是LinkedList类型

```scala
val a = List(1,2)    
val b = scala.collection.mutable.LinkedList(3,4)   
val c = a ++: b   
println(c.getClass().getName())// c的类型是：scala.collection.mutable.LinkedList
```

- **def +:(elem: A): Array[A]** 
  在数组前面添加一个元素，并返回新的对象，下面添加一个元素 0

```
    val a = List(1,2)    val c = 0 +: a // c中的内容是 （0,1,2）
```

- **def :+(elem: A): Array[A]** 
  同上面的方法想法，在数组末尾添加一个元素，并返回新对象
- **def /:[B](z: B)(op: (B, T) ⇒ B): B** 
  对数组中所有的元素进行相同的操作 ，foldLeft的简写

```
    val a = List(1,2,3,4)    val c = (10 /: a)(_+_)   // 1+2+3+4+10    val d = (10 /: a)(_*_)   // 1*2*3*4*10    println("c:"+c)   // c:20    println("d:"+d)   // d:240
```

- **def :\[B](z: B)(op: (T, B) ⇒ B): B** 
  foldRight的简写
- **def addString(b: StringBuilder): StringBuilder** 
  将数组中的元素逐个添加到b中

```
    val a = List(1,2,3,4)    val b = new StringBuilder()    val c = a.addString(b)   // c中的内容是  1234
```

- **def addString(b: StringBuilder, sep: String): StringBuilder** 
  同上，每个元素用sep分隔符分开

```
    val a = List(1,2,3,4)    val b = new StringBuilder()    val c = a.addString(b,",")     println("c:  "+c)  // c:  1,2,3,4
```

- **def addString(b: StringBuilder, start: String, sep: String, end: String): StringBuilder** 
  同上，在首尾各加一个字符串，并指定sep分隔符

```
    val a = List(1,2,3,4)    val b = new StringBuilder()    val c = a.addString(b,"{",",","}")     println("c:  "+c)  // c:  {1,2,3,4}
```

- **def aggregate[B](z: ⇒ B)(seqop: (B, T) ⇒ B, combop: (B, B) ⇒ B): B** 
  聚合计算，aggregate是柯里化方法，参数是两个方法，为了方便理解，我们把aggregate的两个参数，分别封装成两个方法，并把计算过程打印出来。

```
  def main(args: Array[String]) {    val a = List(1,2,3,4)    val c = a.par.aggregate(5)(seqno,combine)    println("c:"+c)  }  def seqno(m:Int,n:Int): Int ={    val s = "seq_exp=%d+%d"    println(s.format(m,n))    return m+n  }  def combine(m:Int,n:Int): Int ={    val s = "com_exp=%d+%d"    println(s.format(m,n))    return m+n  }  /**    seq_exp=5+3    seq_exp=5+2    seq_exp=5+4    seq_exp=5+1    com_exp=6+7    com_exp=8+9    com_exp=13+17    c:30  */
```

上面过程可以简写为

```
val c = a.par.aggregate(5)(_+_,_+_)
```

-  

- **def apply(i: Int): T** 
  同下面代码，取出指定索引处的元素

```
val first = numbers(0) // 读取第一个元素
```

- **def canEqual(that: Any): Boolean** 
  判断两个对象是否可以进行比较
- **def charAt(index: Int): Char** 
  获取index索引处的字符，这个方法会执行一个隐式的转换，将Array[T]转换为 ArrayCharSequence，只有当T为char类型时，这个转换才会发生。

```
val chars = Array('a','b','c')println("c:"+chars.charAt(0))   //结果 a
```

- **def clone(): Array[T]** 
  创建一个副本

```
    val chars = Array('a','b','c')    println(a.apply(2))    val newchars = chars.clone()
```

- **def collect[B](pf: PartialFunction[A, B]): Array[B]** 
  通过执行一个并行计算（偏函数），得到一个新的数组对象

```
   val chars = Array('a','b','c')   val newchars = chars.collect(fun)   println("newchars:"+newchars.mkString(","))  //我们通过下面的偏函数，把chars数组的小写a转换为大写的A  val fun:PartialFunction[Char,Char] = {    case 'a' => 'A'    case x => x  }  /**输出结果是 newchars:A,b,c */
```

- **def collectFirst[B](pf: PartialFunction[T, B]): Option[B]** 
  在序列中查找第一个符合偏函数定义的元素，并执行偏函数计算

```
val arr = Array(1,'a',"b")//定义一个偏函数，要求当被执行对象为Int类型时，进行乘100的操作，对于上面定义的对象arr来说，只有第一个元素符合要求  val fun:PartialFunction[Any,Int] = {    case x:Int => x*100  }//计算  val value = arr.collectFirst(fun)  println("value:"+value)//另一种写法val value = arr.collectFirst({case x:Int => x*100})
```

- **def combinations(n: Int): collection.Iterator[Array[T]]** 
  排列组合，这个排列组合会选出所有包含字符不一样的组合，对于 “abc”、“cba”，只选择一个，参数n表示序列长度，就是几个字符为一组

```
    val arr = Array("a","b","c")    val newarr = arr.combinations(2)    newarr.foreach((item) => println(item.mkString(",")))    /**    a,b    a,c    b,c    */
```

- **def contains[A1 >: A](elem: A1): Boolean** 
  序列中是否包含指定对象
- **def containsSlice[B](that: GenSeq[B]): Boolean** 
  判断当前序列中是否包含另一个序列

```
    val a = List(1,2,3,4)    val b = List(2,3)    println(a.containsSlice(b))  //true
```

- **def copyToArray(xs: Array[A]): Unit** 
  此方法还有两个类似的方法 
  copyToArray(xs: Array[A], start: Int): Unit 
  copyToArray(xs: Array[A], start: Int, len: Int): Unit

```
val a = Array('a', 'b', 'c')val b : Array[Char] = new Array(5)a.copyToArray(b)    /**b中元素 ['a','b','c',0,0]*/a.copyToArray(b,1)  /**b中元素 [0,'a',0,0,0]*/a.copyToArray(b,1,2)    /**b中元素 [0,'a','b',0,0]*/
```

- **def copyToBuffer[B >: A](dest: Buffer[B]): Unit** 
  将数组中的内容拷贝到Buffer中

```
    val a = Array('a', 'b', 'c')    val b:ArrayBuffer[Char]  = ArrayBuffer()    a.copyToBuffer(b)    println(b.mkString(","))
```

- **def corresponds[B](that: GenSeq[B])(p: (T, B) ⇒ Boolean): Boolean** 
  判断两个序列长度以及对应位置元素是否符合某个条件。如果两个序列具有相同的元素数量并且p(x, y)=true，返回结果为true 
  下面代码检查a和b长度是否相等，并且a中元素是否小于b中对应位置的元素

```
val a = Array(1, 2, 3)val b = Array(4, 5,6)println(a.corresponds(b)(_<_))  //true
```

- **def count(p: (T) ⇒ Boolean): Int** 
  统计符合条件的元素个数，下面统计大于 2 的元素个数

```
    val a = Array(1, 2, 3)    println(a.count({x:Int => x > 2}))  // count = 1
```

- **def diff(that: collection.Seq[T]): Array[T]** 
  计算当前数组与另一个数组的不同。将当前数组中没有在另一个数组中出现的元素返回

```
val a = Array(1, 2, 3,4)val b = Array(4, 5,6,7)val c = a.diff(b)println(c.mkString) //1,2,3
```

- **def distinct: Array[T]** 
  去除当前集合中重复的元素，只保留一个

```
val a = Array(1, 2, 3,4,4,5,6,6)val c = a.distinctprintln(c.mkString(","))    // 1,2,3,4,5,6
```

- **def drop(n: Int): Array[T]** 
  将当前序列中前 n 个元素去除后，作为一个新序列返回

```
val a = Array(1, 2, 3,4)val c = a.drop(2)println(c.mkString(","))    // 3,4
```

- **def dropRight(n: Int): Array[T]**
- 功能同 drop，去掉尾部的 n 个元素
- **def dropWhile(p: (T) ⇒ Boolean): Array[T]** 
  去除当前数组中符合条件的元素，这个需要一个条件，就是从当前数组的第一个元素起，就要满足条件，直到碰到第一个不满足条件的元素结束（即使后面还有符合条件的元素），否则返回整个数组

```
//下面去除大于2的，第一个元素 3 满足，它后面的元素 2 不满足，所以返回 2,3,4val a = Array(3, 2, 3,4)val c = a.dropWhile( {x:Int => x > 2} )println(c.mkString(",")) //如果数组 a 是下面这样，第一个元素就不满足，所以返回整个数组 1, 2, 3,4val a = Array(1, 2, 3,4) 
```

- **def endsWith[B](that: GenSeq[B]): Boolean** 
  判断是否以某个序列结尾

```
val a = Array(3, 2, 3,4)val b = Array(3,4)println(a.endsWith(b))  //true
```

- **def exists(p: (T) ⇒ Boolean): Boolean** 
  判断当前数组是否包含符合条件的元素

```
 val a = Array(3, 2, 3,4) println(a.exists( {x:Int => x==3} ))   //true println(a.exists( {x:Int => x==30} ))  //false
```

- **def filter(p: (T) ⇒ Boolean): Array[T]** 
  取得当前数组中符合条件的元素，组成新的数组返回

```
val a = Array(3, 2, 3,4)val b = a.filter( {x:Int => x> 2} )println(b.mkString(","))    //3,3,4
```

- **def filterNot(p: (T) ⇒ Boolean): Array[T]** 
  与上面的 filter 作用相反
- **def find(p: (T) ⇒ Boolean): Option[T]** 
  查找第一个符合条件的元素

```
val a = Array(1, 2, 3,4)val b = a.find( {x:Int => x>2} )println(b)  // Some(3)
```

- **def flatMap[B](f: (A) ⇒ GenTraversableOnce[B]): Array[B]** 
  对当前序列的每个元素进行操作，结果放入新序列返回，参数要求是GenTraversableOnce及其子类

```
val a = Array(1, 2, 3,4)val b = a.flatMap(x=>1 to x)println(b.mkString(","))/**1,1,2,1,2,3,1,2,3,4从1开始，分别于集合a的每个元素生成一个递增序列，过程如下11,21,2,31,2,3,4*/
```

- **def flatten[U](implicit asTrav: (T) ⇒ collection.Traversable[U], m: ClassTag[U]): Array[U]** 
  将二维数组的所有元素联合在一起，形成一个一维数组返回

```
val dArr = Array(Array(1,2,3),Array(4,5,6))val c = dArr.flattenprintln(c.mkString(","))    //1,2,3,4,5,6
```

-**def fold[A1 >: A](z: A1)(op: (A1, A1) ⇒ A1): A1** 
对序列中的每个元素进行二元运算，和aggregate有类似的语义，但执行过程有所不同，我们来对比一下他们的执行过程。 
因为aggregate需要两个处理方法，所以我们定义一个combine方法

```
  def seqno(m:Int,n:Int): Int ={    val s = "seq_exp=%d+%d"    println(s.format(m,n))    return m+n  }  def combine(m:Int,n:Int): Int ={    val s = "com_exp=%d+%d"    println(s.format(m,n))    return m+n  }    val a = Array(1, 2, 3,4)    val b = a.fold(5)(seqno)    /** 运算过程    seq_exp=5+1    seq_exp=6+2    seq_exp=8+3    seq_exp=11+4    */    val c = a.par.aggregate(5)(seqno,combine)    /** 运算过程    seq_exp=5+1    seq_exp=5+4    seq_exp=5+3    com_exp=8+9    seq_exp=5+2    com_exp=6+7    com_exp=13+17    */
```

看上面的运算过程发现，fold中，seqno是把初始值顺序和每个元素相加，把得到的结果与下一个元素进行运算 
而aggregate中，seqno是把初始值与每个元素相加，但结果不参与下一步运算，而是放到另一个序列中，由第二个方法combine进行处理

-**def foldLeft[B](z: B)(op: (B, T) ⇒ B): B** 
从左到右计算，简写方式：def /:[B](z: B)(op: (B, T) ⇒ B): B

```
  def seqno(m:Int,n:Int): Int ={    val s = "seq_exp=%d+%d"    println(s.format(m,n))    return m+n  }    val a = Array(1, 2, 3,4)    val b = a.foldLeft(5)(seqno)    /** 运算过程    seq_exp=5+1    seq_exp=6+2    seq_exp=8+3    seq_exp=11+4    */    /**    简写 (5 /: a)(_+_)    */
```

-**def foldRight[B](z: B)(op: (B, T) ⇒ B): B** 
从右到左计算，简写方式：def :\[B](z: B)(op: (T, B) ⇒ B): B

```
  def seqno(m:Int,n:Int): Int ={    val s = "seq_exp=%d+%d"    println(s.format(m,n))    return m+n  }    val a = Array(1, 2, 3,4)    val b = a.foldRight(5)(seqno)    /** 运算过程    seq_exp=4+5    seq_exp=3+9    seq_exp=2+12    seq_exp=1+14    */    /**    简写 (a :\ 5)(_+_)    */
```

-**def forall(p: (T) ⇒ Boolean): Boolean** 
检测序列中的元素是否都满足条件 p，如果序列为空，返回true

```
    val a = Array(1, 2, 3,4)    val b = a.forall( {x:Int => x>0})   //true    val b = a.forall( {x:Int => x>2})   //false
```

-**def foreach(f: (A) ⇒ Unit): Unit** 
检测序列中的元素是否都满足条件 p，如果序列为空，返回true

```
    val a = Array(1, 2, 3,4)    val b = a.forall( {x:Int => x>0})   //true    val b = a.forall( {x:Int => x>2})   //false
```

-**def foreach(f: (A) ⇒ Unit): Unit** 
遍历序列中的元素，进行 f 操作

```
    val a = Array(1, 2, 3,4)    a.foreach(x => println(x*10))    /**    10    20    30    40    */
```

-**def groupBy[K](f: (T) ⇒ K): Map[K, Array[T]]** 
按条件分组，条件由 f 匹配，返回值是Map类型，每个key对应一个序列，下面代码实现的是，把小于3的数字放到一组，大于3的放到一组，返回Map[String,Array[Int]]

```
    val a = Array(1, 2, 3,4)    val b = a.groupBy( x => x match {      case x if (x < 3) => "small"      case _ => "big"    })
```

![分组后的结果如图](https://img-blog.csdn.net/20151201103711927)

-**def grouped(size: Int): collection.Iterator[Array[T]]** 
按指定数量分组，每组有 size 数量个元素，返回一个集合

```
val a = Array(1, 2, 3,4,5)val b = a.grouped(3).toListb.foreach((x) => println("第"+(b.indexOf(x)+1)+"组:"+x.mkString(",")))/**第1组:1,2,3第2组:4,5*/
```

-  

-**def hasDefiniteSize: Boolean** 
检测序列是否存在有限的长度，对应Stream这样的流数据，返回false

```
val a = Array(1, 2, 3,4,5)println(a.hasDefiniteSize)  //true
```

-**def head: T** 
返回序列的第一个元素，如果序列为空，将引发错误

```
val a = Array(1, 2, 3,4,5)println(a.head) //1
```

-**def headOption: Option[T]** 
返回Option类型对象，就是scala.Some 或者 None，如果序列是空，返回None

```
val a = Array(1, 2, 3,4,5)println(a.headOption)   //Some(1)
```

-**def indexOf(elem: T): Int** 
返回elem在序列中的索引，找到第一个就返回

```
val a = Array(1, 3, 2, 3, 4)println(a.indexOf(3))   // return 1
```

-**def indexOf(elem: T, from: Int): Int** 
返回elem在序列中的索引，可以指定从某个索引处（from）开始查找，找到第一个就返回

```
val a = Array(1, 3, 2, 3, 4)println(a.indexOf(3,2)) // return 3
```

-**def indexOfSlice[B >: A](that: GenSeq[B]): Int** 
检测当前序列中是否包含另一个序列（that），并返回第一个匹配出现的元素的索引

```
    val a = Array(1, 3, 2, 3, 4)    val b = Array(2,3)    println(a.indexOfSlice(b))  // return 2
```

-**def indexOfSlice[B >: A](that: GenSeq[B], from: Int): Int** 
检测当前序列中是否包含另一个序列（that），并返回第一个匹配出现的元素的索引，指定从 from 索引处开始

```
    val a = Array(1, 3, 2, 3, 2, 3, 4)    val b = Array(2,3)    println(a.indexOfSlice(b,3))    // return 4
```

-**def indexWhere(p: (T) ⇒ Boolean): Int** 
返回当前序列中第一个满足 p 条件的元素的索引

```
    val a = Array(1, 2, 3, 4)    println(a.indexWhere( {x:Int => x>3}))  // return 3
```

-**def indexWhere(p: (T) ⇒ Boolean, from: Int): Int** 
返回当前序列中第一个满足 p 条件的元素的索引，可以指定从 from 索引处开始

```
    val a = Array(1, 2, 3, 4, 5, 6)    println(a.indexWhere( {x:Int => x>3},4))    // return 4
```

-**def indices: collection.immutable.Range** 
返回当前序列索引集合

```
    val a = Array(10, 2, 3, 40, 5)    val b = a.indices    println(b.mkString(","))    // 0,1,2,3,4
```

-**def init: Array[T]** 
返回当前序列中不包含最后一个元素的序列

```
    val a = Array(10, 2, 3, 40, 5)    val b = a.init    println(b.mkString(","))    // 10, 2, 3, 40
```

-**def inits: collection.Iterator[Array[T]]** 
对集合中的元素进行 init 操作，该操作的返回值中， 第一个值是当前序列的副本，包含当前序列所有的元素，最后一个值是空的，对头尾之间的值进行init操作，上一步的结果作为下一步的操作对象

```
    val a = Array(1, 2, 3, 4, 5)    val b = a.inits.toList    for(i <- 1 to b.length){      val s = "第%d个值：%s"      println(s.format(i,b(i-1).mkString(",")))    }    /**计算结果    第1个值：1,2,3,4,5    第2个值：1,2,3,4    第3个值：1,2,3    第4个值：1,2    第5个值：1    第6个值    */
```

-  
-  

-**def intersect(that: collection.Seq[T]): Array[T]** 
取两个集合的交集

```
    val a = Array(1, 2, 3, 4, 5)    val b = Array(3, 4, 6)    val c = a.intersect(b)    println(c.mkString(","))    //return 3,4
```

-**def isDefinedAt(idx: Int): Boolean** 
判断序列中是否存在指定索引

```
    val a = Array(1, 2, 3, 4, 5)    println(a.isDefinedAt(1))   // true    println(a.isDefinedAt(10))  // false
```

-**def isEmpty: Boolean** 
判断当前序列是否为空

-**def isTraversableAgain: Boolean** 
判断序列是否可以反复遍历，该方法是GenTraversableOnce中的方法，对于 Traversables 一般返回true，对于 Iterators 返回 false，除非被复写

-**def iterator: collection.Iterator[T]** 
对序列中的每个元素产生一个 iterator

```
    val a = Array(1, 2, 3, 4, 5)    val b = a.iterator  //此时就可以通过迭代器访问 b
```

-**def last: T** 
取得序列中最后一个元素

```
    val a = Array(1, 2, 3, 4, 5)    println(a.last) // return  5
```

-**def lastIndexOf(elem: T): Int** 
取得序列中最后一个等于 elem 的元素的位置

```
    val a = Array(1, 4, 2, 3, 4, 5)    println(a.lastIndexOf(4))   // return  4
```

- -**def lastIndexOf(elem: T, end: Int): Int** 
  取得序列中最后一个等于 elem 的元素的位置，可以指定在 end 之前（包括）的元素中查找

```
    val a = Array(1, 4, 2, 3, 4, 5)    println(a.lastIndexOf(4,3)) // return  1
```

-**def lastIndexOfSlice[B >: A](that: GenSeq[B]): Int** 
判断当前序列中是否包含序列 that，并返回最后一次出现该序列的位置处的索引

```
    val a = Array(1, 4, 2, 3, 4, 5, 1, 4)    val b = Array(1, 4)    println(a.lastIndexOfSlice(b))  // return  6
```

-**def lastIndexOfSlice[B >: A](that: GenSeq[B], end: Int): Int** 
判断当前序列中是否包含序列 that，并返回最后一次出现该序列的位置处的索引，可以指定在 end 之前（包括）的元素中查找

```
    val a = Array(1, 4, 2, 3, 4, 5, 1, 4)    val b = Array(1, 4)    println(a.lastIndexOfSlice(b,4))    // return  0
```

-**def lastIndexWhere(p: (T) ⇒ Boolean): Int** 
返回当前序列中最后一个满足条件 p 的元素的索引

```
    val a = Array(1, 4, 2, 3, 4, 5, 1, 4)    val b = Array(1, 4)    println(a.lastIndexWhere( {x:Int => x<2}))  // return  6
```

-**def lastIndexWhere(p: (T) ⇒ Boolean, end: Int): Int** 
返回当前序列中最后一个满足条件 p 的元素的索引，可以指定在 end 之前（包括）的元素中查找

```
    val a = Array(1, 4, 2, 3, 4, 5, 1, 4)    val b = Array(1, 4)    println(a.lastIndexWhere( {x:Int => x<2},2))    // return  0
```

-**def lastOption: Option[T]** 
返回当前序列中最后一个对象

```
    val a = Array(1, 2, 3, 4, 5)    println(a.lastOption)   // return  Some(5)
```

-**def length: Int** 
返回当前序列中元素个数

```
    val a = Array(1, 2, 3, 4, 5)    println(a.length)   // return  5
```

-**def lengthCompare(len: Int): Int** 
比较序列的长度和参数 len，根据二者的关系返回不同的值，比较规则是

```
x <  0       if this.length <  lenx == 0       if this.length == lenx >  0       if this.length >  len
```

-**def map[B](f: (A) ⇒ B): Array[B]** 
对序列中的元素进行 f 操作

```
    val a = Array(1, 2, 3, 4, 5)    val b = a.map( {x:Int => x*10})    println(b.mkString(","))    // 10,20,30,40,50
```

-**def max: A** 
返回序列中最大的元素

```
    val a = Array(1, 2, 3, 4, 5)    println(a.max)  // return  5
```

-**def minBy[B](f: (A) ⇒ B): A** 
返回序列中第一个符合条件的最大的元素

```
    val a = Array(1, 2, 3, 4, 5)    println(a.maxBy( {x:Int => x > 2})) // return  3
```

-**def mkString: String** 
将所有元素组合成一个字符串

```
    val a = Array(1, 2, 3, 4, 5)    println(a.mkString) // return  12345
```

-**def mkString(sep: String): String** 
将所有元素组合成一个字符串，以 sep 作为元素间的分隔符

```
    val a = Array(1, 2, 3, 4, 5)    println(a.mkString(","))    // return  1,2,3,4,5
```

-**def mkString(start: String, sep: String, end: String): String** 
将所有元素组合成一个字符串，以 start 开头，以 sep 作为元素间的分隔符，以 end 结尾

```
    val a = Array(1, 2, 3, 4, 5)    println(a.mkString("{",",","}"))    // return  {1,2,3,4,5}
```

-**def nonEmpty: Boolean** 
判断序列不是空

-**def padTo(len: Int, elem: A): Array[A]** 
后补齐序列，如果当前序列长度小于 len，那么新产生的序列长度是 len，多出的几个位值填充 elem，如果当前序列大于等于 len ，则返回当前序列

```
    val a = Array(1, 2, 3, 4, 5)    val b = a.padTo(7,9)    //需要一个长度为 7  的新序列，空出的填充 9    println(b.mkString(","))    // return  1,2,3,4,5,9,9
```

-**def par: ParArray[T]** 
返回一个并行实现，产生的并行序列，不能被修改

```
    val a = Array(1, 2, 3, 4, 5)    val b = a.par   //  "ParArray" size = 5
```

-**def partition(p: (T) ⇒ Boolean): (Array[T], Array[T])** 
按条件将序列拆分成两个新的序列，满足条件的放到第一个序列中，其余的放到第二个序列，下面以序列元素是否是 2 的倍数来拆分

```
    val a = Array(1, 2, 3, 4, 5)    val b:(Array[Int],Array[Int]) = a.partition( {x:Int => x % 2 == 0})    println(b._1.mkString(","))     // return  2,4    println(b._2.mkString(","))     // return  1,3,5
```

-**def patch(from: Int, that: GenSeq[A], replaced: Int): Array[A]** 
批量替换，从原序列的 from 处开始，后面的 replaced 数量个元素，将被替换成序列 that

```
    val a = Array(1, 2, 3, 4, 5)    val b = Array(3, 4, 6)    val c = a.patch(1,b,2)    println(c.mkString(","))    // return 1,3,4,6,4,5    /**从 a 的第二个元素开始，取两个元素，即 2和3 ，这两个元素被替换为 b的内容*/
```

-**def permutations: collection.Iterator[Array[T]]** 
排列组合，他与combinations不同的是，组合中的内容可以相同，但是顺序不能相同，combinations不允许包含的内容相同，即使顺序不一样

```
    val a = Array(1, 2, 3, 4, 5)    val b = a.permutations.toList   // b 中将有120个结果，知道排列组合公式的，应该不难理解吧    /**如果是combinations*/    val b = a.combinations(5).toList    // b 中只有一个，因为不管怎样排列，都是这5个数字组成，所以只能保留第一个
```

-**def prefixLength(p: (T) ⇒ Boolean): Int** 
给定一个条件 p，返回一个前置数列的长度，这个数列中的元素都满足 p

```
    val a = Array(1,2,3,4,1,2,3,4)    val b = a.prefixLength( {x:Int => x<3}) // b = 2
```

-**def product: A** 
返回所有元素乘积的值

```
    val a = Array(1,2,3,4,5)    val b = a.product       // b = 120  （1*2*3*4*5）
```

-**def reduce[A1 >: A](op: (A1, A1) ⇒ A1): A1** 
同 fold，不需要初始值

```
  val fun:PartialFunction[Any,Int] = {    case 'a' => 'A'    case x:Int => x*100  }   val a = Array(1,2,3,4,5)  val b = a.reduce(seqno)  println(b)    // 15  /**    seq_exp=1+2    seq_exp=3+3    seq_exp=6+4    seq_exp=10+5  */
```

-**def reduceLeft[B >: A](op: (B, T) ⇒ B): B** 
从左向右计算

-**def reduceRight[B >: A](op: (T, B) ⇒ B): B** 
从右向左计算

-**def reduceLeftOption[B >: A](op: (B, T) ⇒ B): Option[B]** 
计算Option，参考reduceLeft

-**def reduceRightOption[B >: A](op: (T, B) ⇒ B): Option[B]** 
计算Option，参考reduceRight

-**def reverse: Array[T]** 
反转序列

```
    val a = Array(1,2,3,4,5)    val b = a.reverse    println(b.mkString(","))    //5,4,3,2,1
```

-**def reverseIterator: collection.Iterator[T]** 
反向生成迭代

-**def reverseMap[B](f: (A) ⇒ B): Array[B]** 
同 map 方向相反

```
    val a = Array(1,2,3,4,5)    val b = a.reverseMap( {x:Int => x*10} )    println(b.mkString(","))    // 50,40,30,20,10
```

-**def sameElements(that: GenIterable[A]): Boolean** 
判断两个序列是否顺序和对应位置上的元素都一样

```
    val a = Array(1,2,3,4,5)    val b = Array(1,2,3,4,5)    println(a.sameElements(b))  // true     val c = Array(1,2,3,5,4)    println(a.sameElements(c))  // false
```

-**def scan[B >: A, That](z: B)(op: (B, B) ⇒ B)(implicit cbf: CanBuildFrom[Array[T], B, That]): That** 
用法同 fold，scan会把每一步的计算结果放到一个新的集合中返回，而 fold 返回的是单一的值

```
    val a = Array(1,2,3,4,5)    val b = a.scan(5)(seqno)    println(b.mkString(","))    // 5,6,8,11,15,20
```

-**def scanLeft[B, That](z: B)(op: (B, T) ⇒ B)(implicit bf: CanBuildFrom[Array[T], B, That]): That** 
从左向右计算

-**def scanRight[B, That](z: B)(op: (T, B) ⇒ B)(implicit bf: CanBuildFrom[Array[T], B, That]): That** 
从右向左计算

-**def segmentLength(p: (T) ⇒ Boolean, from: Int): Int** 
从序列的 from 处开始向后查找，所有满足 p 的连续元素的长度

```
    val a = Array(1,2,3,1,1,1,1,1,4,5)    val b = a.segmentLength( {x:Int => x < 3},3)        // 5
```

-**def seq: collection.mutable.IndexedSeq[T]** 
产生一个引用当前序列的 sequential 视图

-**def size: Int** 
序列元素个数，同 length

-**def slice(from: Int, until: Int): Array[T]** 
取出当前序列中，from 到 until 之间的片段

```
    val a = Array(1,2,3,4,5)    val b = a.slice(1,3)    println(b.mkString(","))    // 2,3
```

-**def sliding(size: Int): collection.Iterator[Array[T]]** 
从第一个元素开始，每个元素和它后面的 size - 1 个元素组成一个数组，最终组成一个新的集合返回，当剩余元素不够 size 数，则停止

```
    val a = Array(1,2,3,4,5)    val b = a.sliding(3).toList    for(i<-0 to b.length - 1){      val s = "第%d个：%s"      println(s.format(i,b(i).mkString(",")))    }      /**    第0个：1,2,3    第1个：2,3,4    第2个：3,4,5      */
```

-**def sliding(size: Int, step: Int): collection.Iterator[Array[T]]** 
从第一个元素开始，每个元素和它后面的 size - 1 个元素组成一个数组，最终组成一个新的集合返回，当剩余元素不够 size 数，则停止 
该方法，可以设置步进 step，第一个元素组合完后，下一个从 上一个元素位置+step后的位置处的元素开始

```
    val a = Array(1,2,3,4,5)    val b = a.sliding(3,2).toList   //第一个从1开始， 第二个从3开始，因为步进是 2    for(i<-0 to b.length - 1){      val s = "第%d个：%s"      println(s.format(i,b(i).mkString(",")))    }      /**    第0个：1,2,3    第1个：3,4,5      */
```

-**def sortBy[B](f: (T) ⇒ B)(implicit ord: math.Ordering[B]): Array[T]** 
按指定的排序规则排序

```
    val a = Array(3,2,1,4,5)    val b = a.sortBy( {x:Int => x})    println(b.mkString(","))    // 1,2,3,4,5
```

-**def sortWith(lt: (T, T) ⇒ Boolean): Array[T]** 
自定义排序方法 lt

```
    val a = Array(3,2,1,4,5)    val b = a.sortWith(_.compareTo(_) > 0)  // 大数在前    println(b.mkString(","))    // 5,4,3,2,1
```

-**def sorted[B >: A](implicit ord: math.Ordering[B]): Array[T]** 
使用默认的排序规则对序列排序

```
    val a = Array(3,2,1,4,5)    val b = a.sorted        println(b.mkString(","))    // 1,2,3,4,5
```

-**def span(p: (T) ⇒ Boolean): (Array[T], Array[T])** 
分割序列为两个集合，从第一个元素开始，直到找到第一个不满足条件的元素止，之前的元素放到第一个集合，其它的放到第二个集合

```
    val a = Array(3,2,1,4,5)    val b = a.span( {x:Int => x > 2})    println(b._1.mkString(","))     //  3    println(b._2.mkString(","))     //  2,1,4,5
```

-**def splitAt(n: Int): (Array[T], Array[T])** 
从指定位置开始，把序列拆分成两个集合

```
    val a = Array(3,2,1,4,5)    val b = a.splitAt(2)    println(b._1.mkString(",")) //  3,2    println(b._2.mkString(",")) //  1,4,5
```

-**def startsWith[B](that: GenSeq[B], offset: Int): Boolean** 
从指定偏移处，是否以某个序列开始

```
    val a = Array(0,1,2,3,4,5)    val b = Array(1,2)    println(a.startsWith(b,1))      //  true
```

-**def startsWith[B](that: GenSeq[B]): Boolean** 
是否以某个序列开始

```
    val a = Array(1,2,3,4,5)    val b = Array(1,2)    println(a.startsWith(b))        //  true
```

-**def stringPrefix: String** 
返回 toString 结果的前缀

```
    val a = Array(0,1,2,3,4,5)    println(a.toString())       //[I@3daa57fb    val b = a.stringPrefix    println(b)      //[I
```

-**def subSequence(start: Int, end: Int): CharSequence** 
返回 start 和 end 间的字符序列

```
    val chars = Array('a','b','c','d')    val b = chars.subSequence(1,3)    println(b.toString)     //  bc
```

-**def sum: A** 
序列求和，元素需为Numeric[T]类型

```
    val a = Array(1,2,3,4,5)    val b = a.sum       //  15
```

-**def tail: Array[T]** 
返回除了当前序列第一个元素的其它元素组成的序列

```
    val a = Array(1,2,3,4,5)    val b = a.tail      //  2,3,4,5
```

-**def take(n: Int): Array[T]** 
返回当前序列中前 n 个元素组成的序列

```
    val a = Array(1,2,3,4,5)    val b = a.take(3)       //  1,2,3
```

-**def takeRight(n: Int): Array[T]** 
返回当前序列中，从右边开始，选择 n 个元素组成的序列

```
    val a = Array(1,2,3,4,5)    val b = a.takeRight(3)      //  3,4,5
```

-**def takeWhile(p: (T) ⇒ Boolean): Array[T]** 
返回当前序列中，从第一个元素开始，满足条件的连续元素组成的序列

```
    val a = Array(1,2,3,4,5)    val b = a.takeWhile( {x:Int => x < 3})      //  1,2
```

-**def toArray: Array[A]** 
转换成 Array 类型

-**def toBuffer[A1 >: A]: Buffer[A1]** 
转换成 Buffer 类型

-**def toIndexedSeq: collection.immutable.IndexedSeq[T]** 
转换成 IndexedSeq 类型

-**def toIterable: collection.Iterable[T]** 
转换成可迭代的类型

-**def toIterator: collection.Iterator[T]** 
同 iterator 方法

-**def toList: List[T]** 
同 List 类型

-**def toMap[T, U]: Map[T, U]** 
同 Map 类型，需要被转化序列中包含的元素时 Tuple2 类型数据

```
    val chars = Array(("a","b"),("c","d"),("e","f"))    val b = chars.toMap    println(b)      //Map(a -> b, c -> d, e -> f)
```

-**def toSeq: collection.Seq[T]** 
同 Seq 类型

-**def toSet[B >: A]: Set[B]** 
同 Set 类型

-**def toStream: collection.immutable.Stream[T]** 
同 Stream 类型

-**def toVector: Vector[T]** 
同 Vector 类型

-**def transpose[U](implicit asArray: (T) ⇒ Array[U]): Array[Array[U]]** 
矩阵转换，二维数组行列转换

```
    val chars = Array(Array("a","b"),Array("c","d"),Array("e","f"))    val b = chars.transpose    println(b.mkString(","))
```

![转换结果](https://img-blog.csdn.net/20151201165147222) 
-**def union(that: collection.Seq[T]): Array[T]** 
联合两个序列，同操作符 ++

```
    val a = Array(1,2,3,4,5)    val b = Array(6,7)    val c = a.union(b)    println(c.mkString(","))        // 1,2,3,4,5,6,7
```

-**def unzip[T1, T2](implicit asPair: (T) ⇒ (T1, T2), ct1: ClassTag[T1], ct2: ClassTag[T2]): (Array[T1], Array[T2])** 
将含有两个元素的数组，第一个元素取出组成一个序列，第二个元素组成一个序列

```
    val chars = Array(("a","b"),("c","d"))    val b = chars.unzip    println(b._1.mkString(","))     //a,c    println(b._2.mkString(","))     //b,d
```

-**def unzip3[T1, T2, T3](implicit asTriple: (T) ⇒ (T1, T2, T3), ct1: ClassTag[T1], ct2: ClassTag[T2], ct3: ClassTag[T3]): (Array[T1], Array[T2], Array[T3])** 
将含有三个元素的三个数组，第一个元素取出组成一个序列，第二个元素组成一个序列，第三个元素组成一个序列

```
    val chars = Array(("a","b","x"),("c","d","y"),("e","f","z"))    val b = chars.unzip3    println(b._1.mkString(","))     //a,c,e    println(b._2.mkString(","))     //b,d,f    println(b._3.mkString(","))     //x,y,z
```

-**def update(i: Int, x: T): Unit** 
将序列中 i 索引处的元素更新为 x

```
    val a = Array(1,2,3,4,5)    a.update(1,9)    println(a.mkString(","))        //1,9,3,4,5
```

-**def updated(index: Int, elem: A): Array[A]** 
将序列中 i 索引处的元素更新为 x ,并返回替换后的数组

```
    val a = Array(1,2,3,4,5)    val b = a.updated(1,9)    println(b.mkString(","))        //1,9,3,4,5
```

-**def view(from: Int, until: Int): IndexedSeqView[T, Array[T]]** 
返回 from 到 until 间的序列，不包括 until 处的元素

```
    val a = Array(1,2,3,4,5)    val b = a.view(1,3)    println(b.mkString(","))        //2,3
```

-**def withFilter(p: (T) ⇒ Boolean): FilterMonadic[T, Array[T]]** 
根据条件 p 过滤元素

```
    val a = Array(1,2,3,4,5)    val b = a.withFilter( {x:Int => x>3}).map(x=>x)    println(b.mkString(","))        //4,5
```

-**def zip[B](that: GenIterable[B]): Array[(A, B)]** 
将两个序列对应位置上的元素组成一个pair序列

```
    val a = Array(1,2,3,4,5)    val b = Array(5,4,3,2,1)    val c = a.zip(b)    println(c.mkString(","))        //(1,5),(2,4),(3,3),(4,2),(5,1)
```

-**def zipAll[B](that: collection.Iterable[B], thisElem: A, thatElem: B): Array[(A, B)]** 
同 zip ，但是允许两个序列长度不一样，不足的自动填充，如果当前序列端，空出的填充为 thisElem，如果 that 短，填充为 thatElem

```
    val a = Array(1,2,3,4,5,6,7)    val b = Array(5,4,3,2,1)    val c = a.zipAll(b,9,8)         //(1,5),(2,4),(3,3),(4,2),(5,1),(6,8),(7,8)     val a = Array(1,2,3,4)    val b = Array(5,4,3,2,1)    val c = a.zipAll(b,9,8)         //(1,5),(2,4),(3,3),(4,2),(9,1)
```

-**def zipWithIndex: Array[(A, Int)]** 
序列中的每个元素和它的索引组成一个序列

```
    val a = Array(10,20,30,40)    val b = a.zipWithIndex    println(b.mkString(","))        //(10,0),(20,1),(30,2),(40,3)
```