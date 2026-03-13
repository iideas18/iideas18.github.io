---
title: "Scala集合的mutable和immutable"
date: 2019-11-22 02:22:08
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# Scala集合的mutable和immutable

2018-10-07 12:58:24 更多

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/zhongqi2513/article/details/82956813

- [概述](https://blog.csdn.net/zhongqi2513/article/details/82956813#_1)
- [集合API概述](https://blog.csdn.net/zhongqi2513/article/details/82956813#API_55)

# 1. 概述

1. Scala 集合类系统地区分了**可变**的和**不可变**的集合。可变集合可以在适当的地方被更新或扩展。这意味着你可以修改，添加，移除一个集合的元素。而不可变集合类，相比之下，永远不会改变。不过，你仍然可以模拟添加，移除或更新操作。但是这些操作将在每一种情况下都返回一个新的集合，同时使原来的集合不发生改变。

   > 总结：
   > **可变集合可以修改，添加，移除**
   > **不可变集合永远不会改变，但是可以模拟添加，移除和更新操作，返回的都是新集合**

2. 所有的集合类都可以在包scala.collection 或scala.collection.mutable，scala.collection.immutable，scala.collection.generic中找到。客户端代码需要的大部分集合类都独立地存在于3种变体中，它们位于scala.collection，scala.collection.immutable，scala.collection.mutable包。每一种变体在可变性方面都有不同的特征。scala.collection，scala.collection.immutable，scala.collection.mutable包。每一种变体在可变性方面都有不同的特征。

   > 总结：
   > **经常使用的Scala的API基本位于以下三个包中：**
   > **顶级父类/根集合： scala.collection**
   > **不可变集合：scala.collection.immutable**
   > **可变集合：scala.collection.mutable**

3. scala.collection.immutable包是的集合类确保不被任何对象改变。例如一个集合创建之后将不会改变。因此，你可以相信一个事实，在不同的点访问同一个集合的值，你将总是得到相同的元素。

   > 总结：
   > **如果访问的是immutable包中的一个集合对象，该集合将不会改变，集合中的元素也不会更改，模拟更改操作得到的结果是一个新集合**

4. scala.collection.mutable包的集合类则有一些操作可以修改集合。所以处理可变集合意味着你需要去理解哪些代码的修改会导致集合同时改变。
   scala.collection包中的集合，既可以是可变的，也可以是不可变的。例如：collection.IndexedSeq[T]] 就是 collection.immutable.IndexedSeq[T] 和collection.mutable.IndexedSeq[T]这两类的超类。scala.collection包中的根集合类中定义了相同的接口作为不可变集合类，同时，scala.collection.mutable包中的可变集合类代表性的添加了一些有辅助作用的修改操作到这个immutable 接口。

5. **根集合类与不可变集合类之间的区别是不可变集合类的客户端可以确保没有人可以修改集合**。然而，根集合类的客户端仅保证不修改集合本身。即使这个集合类没有提供修改集合的静态操作，它仍然可能在运行时作为可变集合被其它客户端所修改。

6. 默认情况下，Scala 一直采用不可变集合类。例如，如果你仅写了Set 而没有任何加前缀也没有从其它地方导入Set，你会得到一个不可变的set，另外如果你写迭代，你也会得到一个不可变的迭代集合类，这是由于这些类在从scala中导入的时候都是默认绑定的。为了得到可变的默认版本，你需要显式的声明collection.mutable.Set或collection.mutable.Iterable.

   > 总结：
   > **默认使用不可变的集合，若要使用可变集合，请导入可变集合**

   一个有用的约定，如果你想要同时使用可变和不可变集合类，只导入collection.mutable包即可。

   ```scala
   import scala.collection.mutable  //导入包scala.collection.mutable
   ```

   然而，像没有前缀的Set这样的关键字， 仍然指的是一个不可变集合，然而mutable.Set指的是可变的副本（可变集合）。

7. 集合树的最后一个包是collection.generic。这个包包含了集合的构建块。集合类延迟了collection.generic类中的部分操作实现，另一方面集合框架的用户需要引用collection.generic中类在异常情况中。
   为了方便和向后兼容性，一些导入类型在包scala中有别名，所以你能通过简单的名字使用它们而不需要import。这有一个例子是List 类型，它可以用以下两种方法使用，如下：

   ```scala
   scala.collection.immutable.List // 这是它的定义位置
   scala.List //通过scala 包中的别名
   List // 因为scala._     // 总是是被自动导入。
   ```

   其它类型的别名有： Traversable, Iterable, Seq, IndexedSeq, Iterator, Stream, Vector, StringBuilder, Range。

8. 下面的图表显示了**scala.collection**包中所有的集合类。这些都是高级抽象类或特性，它们通常具备和不可变实现一样的可变实现。
   ![在这里插入图片描述](https://img-blog.csdn.net/20181007125325469?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3pob25ncWkyNTEz/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

9. 下面的图表显示**scala.collection.immutable**中的所有集合类。
   ![在这里插入图片描述](https://img-blog.csdn.net/20181007125436753?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3pob25ncWkyNTEz/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

10. 下面的图表显示**scala.collection.mutable**中的所有集合类。
    ![在这里插入图片描述](https://img-blog.csdn.net/2018100712550045?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3pob25ncWkyNTEz/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)
    （以上三个图表由Matthias生成， [来自decodified.com](http://xn--decodified-vs0vy28v.com/)）。

# 2. 集合API概述

大多数重要的集合类都被展示在了上表。而且这些类有很多的共性。例如，每一种集合都能用相同的语法创建，写法是集合类名紧跟着元素。

```scala
Traversable(1, 2, 3)
Iterable("x", "y", "z")
Map("x" -> 24, "y" -> 25, "z" -> 26)
Set(Color.red, Color.green, Color.blue)
SortedSet("hello", "world")
Buffer(x, y, z)
IndexedSeq(1.0, 2.0)
LinearSeq(a, b, c)
```

相同的原则也应用于特殊的集合实现，例如：

```scala
List(1, 2, 3)
HashMap("x" -> 24, "y" -> 25, "z" -> 26)
```

所有这些集合类都通过相同的途径，用toString方法展示出来。

Traversable类提供了所有集合支持的API，同时，对于特殊类型也是有意义的。例如，Traversable类 的map方法会返回另一个Traversable对象作为结果，但是这个结果类型在子类中被重写了。例如，在一个List上调用map会又生成一个List，在Set上调用会再生成一个Set，以此类推。

```scala
scala> List(1, 2, 3) map (_ + 1)
res0: List[Int] = List(2, 3, 4)
scala> Set(1, 2, 3) map (_ * 2)
res0: Set[Int] = Set(2, 4, 6)
```

在集合类库中，这种在任何地方都实现了的行为，被称之为返回类型一致原则。

大多数类在集合树中存在这于三种变体：root, mutable 和immutable。唯一的例外是缓冲区特征，它仅在于mutable集合。