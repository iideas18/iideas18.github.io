---
title: "初识Scala反射"
date: 2019-11-01 05:18:48
cover: "https://yqfile.alicdn.com/img_6e8fea92a4e8c66c507a6bfbfd0f16c8.jpeg"
slug: "Scala反射"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# 初识Scala反射

[scala](http://sharkdtu.com/tags/scala/) [反射](http://sharkdtu.com/tags/reflect/)

我们知道，scala编译器会将scala代码编译成JVM字节码，**编译过程中会擦除scala特有的一些类型信息**，在scala-2.10以前，只能在scala中利用java的反射机制，但是通过java反射机制得到的是只是擦除后的类型信息，并不包括scala的一些特定类型信息。从scala-2.10起，scala实现了自己的反射机制，我们可以**通过scala的反射机制得到scala的类型信息**。scala反射**包括运行时反射和编译时反射**，本文主要阐述运行时反射的一些用法，方便scala开发人员参考，具体原理细节请查看官方文档。本文涉及到的代码示例是基于scala-2.10.4，如有不同请勿对号入座。

给定类型或者对象实例，通过scala运行时反射，可以做到：

​		1）**获取运行时类型信息**；

​		2）**通过类型信息实例化新对象**；

​		3）**访问或调用对象的方法和属性等**。

下面分别举例阐述运行时反射的功能。

## 1. 获取运行时类型信息

scala运行时类型信息是保存在`TypeTag`对象中，编译器在编译过程中将类型信息保存到`TypeTag`中，并将其携带到运行期。我们可以通过`typeTag`方法获取`TypeTag`类型信息。

```scala
scala> import scala.reflect.runtime.universe._
import scala.reflect.runtime.universe._

scala> typeTag[List[Int]]
res0: reflect.runtime.universe.TypeTag[List[Int]] = TypeTag[scala.List[Int]]

scala> res0.tpe
res1: reflect.runtime.universe.Type = scala.List[Int]
```

如上述scala REPL显示，通过`typeTag`方法获取`List[Int]`类型的`TypeTag`对象，该对象包含了`List[Int]`的详细类型信息，通过`TypeTag`对象的`tpe`方法得到由`Type`对象封装具体的类型信息，可以看到该`Type`对象的类型信息精确到了类型参数`Int`。如果仅仅是获取类型信息，还有一个更简便的方法，那就是通过`typeOf`方法。

```scala
scala> import scala.reflect.runtime.universe._
import scala.reflect.runtime.universe._

scala> typeOf[List[Int]]
res0: reflect.runtime.universe.Type = scala.List[Int]
```

这时有人就会问，`typeTag`方法需要传一个具体的类型，事先知道类型还要`TypeTag`有啥用啊。我们不妨写个方法，获取任意对象的类型信息。

```scala
scala> val ru = scala.reflect.runtime.universe
ru: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@6dae22e7

scala> def getTypeTag[T: ru.TypeTag](obj: T) = ru.typeTag[T]
getTypeTag: [T](obj: T)(implicit evidence$1: ru.TypeTag[T])ru.TypeTag[T]

scala> val list = List(1, 2, 3)
list: List[Int] = List(1, 2, 3)

scala> val theType = getTypeTag(list).tpe
theType: ru.Type = List[Int]
```

如上scala REPL显示，方法`getTypeTag`可以获取任意对象的类型信息，注意方法中的上下文界定`T: ru.TypeTag` ,它表示存在一个从`T`到`TypeTag[T]`的隐式转换，前面已经讲到，`TypeTag`对象是在编译期间由编译器生成的，如果不加这个上下文界定，编译器就不会为T生成`TypeTag`对象。当然也可以通过隐式参数替代上下文界定，就如同REPL中显示的`implicit evidence$1: ru.TypeTag[T]`那样。一旦我们获取到了类型信息(Type instance)，我们就可以通过该`Type`对象查询更详尽的类型信息。

```scala
scala> val decls = theType.declarations.take(10)
decls: Iterable[ru.Symbol] = List(constructor List, method companion, method isEmpty, method head, method tail, method ::, method :::, method reverse_:::, method mapConserve, method ++)
```

到这里我们知道`TypeTag`对象封装了`Type`对象，通过`Type`对象可以获取详尽的类型信息，包括方法和属性等，通过`typeTag`方法可以得到`TypeTag`对象，通过`typeOf`方法可以得到`Type`对象，它包含没有被编译器擦除的含完整的scala类型信息，与之对应地，如果想获取擦除后的类型信息，传统的方法可以通过java的反射机制来实现，但是scala也提供了该功能，通过`classTag`方法可以获取`ClassTag`对象，`ClassTag`封装了擦除后的类型信息，通过`classOf`方法可以获取`Class`对象，这与java反射中的`Class`对象一致。

```scala
scala> import scala.reflect._
import scala.reflect._

scala> val clsTag = classTag[List[Int]]
clsTag: scala.reflect.ClassTag[List[Int]] = scala.collection.immutable.List

scala> clsTag.runtimeClass
res0: Class[_] = class scala.collection.immutable.List

scala> val cls = classOf[List[Int]]
cls: Class[List[Int]] = class scala.collection.immutable.List

scala> cls.[tab键补全]
asInstanceOf              asSubclass          cast
desiredAssertionStatus    getAnnotation
getAnnotations            getCanonicalName    ...   
```

从上述scala REPL中可以看到，`ClassTag`对象包含了`Class`对象，通过`Class`对象仅仅可以获取擦除后的类型信息，通过在scala REPL中用tab补全可以看到通过`Class`对象可以获取的信息。

## 2. 运行时类型实例化

我们已经知道通过`Type`对象可以获取未擦除的详尽的类型信息，下面我们通过`Type`对象中的信息找到构造方法并实例化类型的一个对象。

```scala
scala> case class Person(id: Int, name: String)
defined class Person

scala> val ru = scala.reflect.runtime.universe
ru: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@3e9ed70d

scala> val m = ru.runtimeMirror(getClass.getClassLoader)
m: ru.Mirror = JavaMirror with scala.tools.nsc.interpreter.IMain$TranslatingClassLoader@a57fc5f ...

scala> val classPerson = ru.typeOf[Person].typeSymbol.asClass
classPerson: ru.ClassSymbol = class Person

scala> val cm = m.reflectClass(classPerson)
cm: ru.ClassMirror = class mirror for Person (bound to null)

scala> val ctor = ru.typeOf[Person].declaration(ru.nme.CONSTRUCTOR).asMethod
ctor: ru.MethodSymbol = constructor Person

scala> val ctorm = cm.reflectConstructor(ctor)
ctorm: ru.MethodMirror = constructor mirror for Person.<init>(id: scala.Int, name: String): Person (bound to null)

scala> val p = ctorm(1, "Mike")
p: Any = Person(1,Mike)
```

如上scala REPL代码，要想通过`Type`对象获取相关信息，必须借助`Mirror`，`Mirror`是按层级划分的，有`ClassLoaderMirror`, `ClassMirror`, `InstanceMirror`, `ModuleMirror`, `MethodMirror`, `FieldMirror`。通过`ClassLoaderMirror`可以创建`ClassMirror`, `InstanceMirror`, `ModuleMirror`, `MethodMirror`, `FieldMirror`。通过`ClassMirror`, `InstanceMirror`可以创建`MethodMirror`, `FieldMirror`。`ModuleMirror`用于处理单例对象，通常是由`object`定义的。从上述代码中可以发现，首先获取一个`ClassLoaderMirror`，然后通过该`Mirror`创建一个`ClassMirror`，继续创建`MethodMirror`，通过该`MethodMirror`调用构造函数。从一个`Mirror`创建另一个`Mirror`，需要指定一个`Symbol`，`Symbol`其实就是绑定名字和一个实体，有`ClassSymbol`、 `MethodSymbol`、 `FieldSymbol`等，`Symbol`的获取是通过`Type`对象方法去查询，例如上述代码中通过`declaration`方法查询构造函数的`Symbol`。

## 3. 运行时类成员访问

下面举例阐述访问运行时类成员，同理，我们只需逐步创建`FieldMirror`来访问类成员。

```scala
scala> case class Person(id: Int, name: String)
defined class Person

scala> val ru = scala.reflect.runtime.universe
ru: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@3e9ed70d

scala> val m = ru.runtimeMirror(getClass.getClassLoader)
m: ru.Mirror = JavaMirror with scala.tools.nsc.interpreter.IMain$TranslatingClassLoader@a57fc5f ...

scala> val p = Person(1, "Mike")
p: Person = Person(1,Mike)

scala> val nameTermSymb = ru.typeOf[Person].declaration(ru.newTermName("name")).asTerm
nameTermSymb: ru.TermSymbol = value name

scala> val im = m.reflect(p)
im: ru.InstanceMirror = instance mirror for Person(1,Mike)

scala> val nameFieldMirror = im.reflectField(nameTermSymb)
nameFieldMirror: ru.FieldMirror = field mirror for Person.name (bound to Person(1,Mike))

scala> nameFieldMirror.get
res0: Any = Mike

scala> nameFieldMirror.set("Jim")

scala> p.name
res2: String = Jim
```

如上代码所示，通过层级`ClassLoaderMirror`->`InstanceMirror`->`FieldMirror`得到`FieldMirror`，通过`Type`对象调用方法`declaration(ru.newTermName("name"))`获取name字段的`Symbol`，通过`FieldMirror`的`get`和`set`方法去访问和修改成员变量。

说了这么多，貌似利用java的反射机制也可以实现上述功能，还不用这么的费劲。关键还是在于你要访问编译器擦除后的类型信息还是擦除前的类型信息，如果是访问擦除后的类型信息，使用java和scala的反射都可以，但是访问擦除前的类型信息，那就必须要使用scala的反射，因为java的反射并不知道擦除前的信息。

举个栗子，一步步剖析，首先定义一个基类`A`，它包含一个抽象类型成员`T`，然后分别派生出两个子类`B`和`C`。

```scala
scala> class A {
     | type T
     | val x: Option[T] = None
     | }
defined class A

scala> class B extends A
defined class B

scala> class C extends B
defined class C
```

现在分别实例化`B`和`C`的一个对象，并将抽象类型`T`具体化为`String`类型。

```scala
scala> val b = new B { type T = String }
b: B{type T = String} = $anon$1@446344a8

scala> val c = new C { type T = String }
c: C{type T = String} = $anon$1@195bc0a4
```

现在通过java的反射机制判断对象`b`和`c`的运行时类型是否是父子关系。

```scala
scala> b.getClass.isAssignableFrom(c.getClass)
res3: Boolean = false
```

可以看到通过java的反射判断对象`c`的运行时类型并不是对象`b`的运行时类型的子类。然而从我们的定义来看，对象`c`的类型本应该是对象`b`的类型的子类，到这里我们就会想到编译器，在实例化对象`b`和`c`时实际上是通过匿名类来实例化的，一开始定义类型信息在编译的时候被擦除了，转为匿名类了。下面通过scala的反射机制判断对象`b`和`c`的运行时类型是否是父子关系。

```scala
scala> val ru = scala.reflect.runtime.universe
ru: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@3e9ed70d

scala> def isSubClass[T: ru.TypeTag, S: ru.TypeTag](x: T, y: S): Boolean = {
     | val leftTag = ru.typeTag[T]
     | val rightTag = ru.typeTag[S]
     | leftTag.tpe <:< rightTag.tpe
     | }
isSubClass: [T, S](x: T, y: S)(implicit evidence$1: ru.TypeTag[T], implicit evidence$2: ru.TypeTag[S])Boolean

scala> isSubClass(c, b)
res5: Boolean = true
```

从上述代码中可以看到，通过scala的反射得到的类型信息符合我们一开始定义。所以在scala中最好是使用scala的反射而不要使用java的反射，因为很有可能编译后通过java的反射得到的结果并不是想象的那样。



# [Scala反射（一）](https://www.cnblogs.com/barrywxx/p/10747008.html)

本篇文章主要让大家理解什么是Scala的反射, 以及反射的分类, 反射的一些术语概念和一些简单的反射例子.

## 1. 什么是反射

我们知道, Scala是基于JVM的语言, Scala编译器会**将Scala代码编译成JVM字节码,** 而JVM编译过程中会擦除一些`泛型`信息, 这就叫**类型擦除**(type-erasure ).

而我们开发过程中, 可能需要**在某一时刻获得类中的详细`泛型`信息. 并进行逻辑处理**. 这时就需要用的 这个概念. 通过反射我们可以做到

1. **获取运行时类型信息**
2. **通过类型信息实例化新对象**
3. **访问或调用对象的方法和属性等**

在Scala-2.10以前, 只能在Scala中利用Java的反射机制, 但是通过Java反射机制得到的是只是擦除后的类型信息, 并不包括Scala的一些特定类型信息. 从Scala-2.10起, Scala实现了自己的反射机制, 我们可以通过Scala的反射机制得到Scala的类型信息。

## 2. Scala 反射的分类

Scala 的反射分为两个范畴:

- 运行时反射
- 编译时反射

这两者之间的区别在于`Environment`, 而`Environment`又是由`universe`决定的. 反射的另一个重要的部分就是一个**实体集合**,而这个实体集合被称为`mirror`,**有了这个实体集合我们就可以实现对需要反射的类进行对应的操作,如属性的获取,属性值得设置,以及对反射类方法的调用**(其实就是成员函数的入口地址, `但请注意, 这只是个地址`)!

可能有点绕, 说的直白点就是**要操作类方法或者属性就需要获得指定的`mirror`**,而`mirror`又是从`Environment`中得来的,而`Environment`又是`Universes`中引入的,而`Universes`根据运行时和编译时又可以分为两个领域的.

对于不同的反射, 我们需要引入不同的`Universes`

```
import scala.reflect.runtime.universe._      // for runtime reflection
import scala.reflect.macros.Universe._       // for compile-time reflection
```

## 3. 编译过程

因为反射需要编译原理基础, 而我学的其实也不好, 所以不做过多深入的探讨, 这里主要说一下Scala 在 `.scala` 到 `.class` 再到装入 JVM 的这个过程.

类Java程序之所以能实现跨平台, 主要得益于**JVM(Java Virtual Machine)**的强大. JVM为什么能实现让类Java代码可以跨平台呢？ 那就要从类Java程序的整个编译、运行的过程说起.

我们平时所写的程序, 都是基于语言(第三代编程语言)范畴的. 它只能是开发者理解, 但底层硬件(如内存和cpu)并不能读懂并执行. 因此需要经历一系列的转化. **类Java的代码, 首先会经过自己特有的编辑器, 将代码转为`.class`**, 再由ClassLoader将`.class`文件加载到JVM运行时数据区, 此时JVM就可以读懂`.class`的二进制文件, 并调用`C/C++`来间接操作底层硬件, 实现代码功能.

### 3.1 .scala => .class 过程

#### 整体流程如下

![image](https://yqfile.alicdn.com/img_6e8fea92a4e8c66c507a6bfbfd0f16c8.jpeg)

#### 词法分析

首先Scala编译器要读取源代码, 一个字节一个字节地读进来, 找到关键词如`if`、`for`、`while`等, 这就是词法分析的过程. 这个过程结束以后`.Scala`代码就变成了规范的Token流, 就像我们把一句话中的名词、动词、标点符号分辨出来.

#### 语法分析

接着Scala编译器就是对Token流进行语法分析了, 比如if后面跟着的是不是一个布尔型的变量, 并将符合规范的语法使用语法树存贮起来. 之所以要用语法树来存储, 是因为这样做可以方便以后对这棵树按照新的规则重新组织, 这也是编译器的关键所在.

#### 语义分析

之后Scala编译器会进行语义分析. 因为可以保证形成语法树以后不存在语法错误, 但语义是否正确则无法保证. 还有就是Scala会有一些相对复杂的语法, 语义分析器的作用就是将这些复杂的语法翻译成更简单的语法, 比如将`foreach`翻译成简单的for循环, 使它更接近目标语言的语法规则.

#### 字节码生成

最后就是由代码生成器将将语义分析的结果生成符合JVM规范的字节码了.

### 3.2 符号 Symbol

Symbol Table, 简单的来说是用于编译器或者解释器的一种数据结构, 通常是用HashTable实现. 它所记载的信息通常是标识符（identifier）的相关信息，如类型，作用域等。那么，它通常会在语义分析（Semantic Analysis）阶段运用到.

### 3.3 抽象语法树 AST

语法树通过树结构来描述开始符到产生式的推导过程.

> 在计算机科学中，抽象语法树（abstract syntax tree 或者缩写为 AST），或者语法树（syntax tree），是源代码的抽象语法结构的树状表现形式，这里特指编程语言的源代码。树上的每个节点都表示源代码中的一种结构。之所以说语法是「抽象」的，是因为这里的语法并不会表示出真实语法中出现的每个细节。

## 4. 运行时反射

Scala运行时类型信息是保存在**TypeTag对象**中, 编译器在编译过程中将类型信息保存到TypeTag中, 并将其携带到运行期. 我们可以通过typeTag方法获取TypeTag类型信息。

### 1. TypeTag

举例如下:

```scala
scala> import scala.reflect.runtime.universe._
import scala.reflect.runtime.universe._

scala> typeTag[List[Int]]
res0: reflect.runtime.universe.TypeTag[List[Int]] = TypeTag[scala.List[Int]]

scala> res0.tpe
res1: reflect.runtime.universe.Type = scala.List[Int]

scala> typeOf[List[Int]]
res2: reflect.runtime.universe.Type = scala.List[Int]
```

但是,上面的例子不实用, 因为我们要在事先知道它的类型信息. 不过没关系, 下面我们写个方法, 来事先任意变量的类型获取:

```scala
scala> val ru = scala.reflect.runtime.universe
ru: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@6dae22e7

scala> def getTypeTag[T : ru.TypeTag](obj: T) = ru.typeOf[T]
getTypeTag: [T](obj: T)(implicit evidence$1: ru.TypeTag[T])ru.TypeTag[T]

scala> val list = List(1, 2, 3)
list: List[Int] = List(1, 2, 3)

scala> val theType = getTypeTag(list)
theType: ru.Type = List[Int]
```

上面代码就是一个简单的方法定义, 但是用到了两个关键的技术, 分别是泛型`[T]`和上下文界定`[T : ru.TypeTag]`, 下面我来解读一下:

### 2. 泛型

scala中的泛型称为**类型参数化**(type parameterlization).
通过名字, 应该有个模糊的概念了, 好像是要传一个类型当做参数. 举个例子:

```scala
scala> def getList[T](value: T) = List(value)
getList: [T](value: T)List[T]

scala> getList[Int](1)
res4: List[Int] = List(1)

scala> getList("1")
res5: List[String] = List(1)
```

看例子, 我们定义了一个方法, 根据传入的一个参数, 来生成一个List, 但为了方法的更加通用(可以处理任何类型), 我们的参数类型`(value: T)`使用了泛型`T`, 可以使任意字母, 但推荐大写(约定俗成).

这样, 我们调用方法, 大家可以看到. 这个方法既可以传入`Int`类型也可以传入`String`类型. 而类型参数[]中的类型, 我们可以手动填写, 也可以不填, Scala编译器会为我们自动推导, 如果填写了, 编译器就不会进行类型推导, 而是进行类型检查, 看我们的入参, 是否符合类型参数.

```scala
scala> getList[String](1)
<console>:16: error: type mismatch;
 found   : Int(1)
 required: String
       getList[String](1)
```

> 知识延伸 上界 `<:`, 下界`>:`, 视界 `<%`, 边界 `:`, 协变 `+T`, 逆变`-T`
>
> ```
> trait Function1[-T, +U] {
>   def apply(x: T): U
> }
> 等价于:
> fun: -T => +U
> ```
>
> [推荐阅读: Scala类型系统之：来自星星的猫](http://freewind.in/posts/2613-scala-type-systems-the-cat-from-stars/)

### 3. 边界

了解了泛型, 下面我们说一下上下文界定`[T : ru.TypeTag]`, 也叫做边界.

了解边界, 我们先说一下视界`<%`. 先举例子:

```scala
scala> case class Fruits(name: String)
defined class Fruits

scala> def getFruits[T <% Fruits](value: T): Fruits = value
getFruits: [T](value: T)(implicit evidence$1: T => Fruits)Fruits

scala> implicit val border: String => Fruits = str => Fruits(str)
border: String => Fruits = <function1>

scala> getFruits("apple")
res11: Fruits = Fruits(apple)
```

可以看到, 在代码最后, 我们调用方法`getFruits`的时候,传入的是一个`String`, 而返回给我们的是一个`Fruits(apple)`, 这是怎么做的的呢?

这就依赖于视界`T <% Fruits`, 这个符号, 可以理解成, 当前名称空间, 必须**存在一个`implicit` 可以将非继承关系的两个实体(`String` 到 `Fruits`)的转换**. 也就是我们上面的那个隐式函数.

理解了视界, 那么边界就很简单了. 还是先写个例子:

```scala
scala> case class Fruits[T](name: T)
defined class Fruits

scala> def getFruits[T](value: T)(implicit fun: T => Fruits[T]): Fruits[T] = value
getFruits: [T](value: T)(implicit fun: T => Fruits[T])Fruits[T]

scala> implicit val border: String => Fruits[String] = str => Fruits(str)
border: String => Fruits[String] = <function1>

scala> getFruits("apple")
res0: Fruits[String] = Fruits(apple)
```

这个应该可以看懂吧, 有个`T => Fruits[T]`的隐式转换. 而Scala有个语法糖可以简化上面的函数定义

```scala
def getFruits[T : Fruits](value: T): Fruits[T] = value
```

作用一样, 需要一个`T => Fruits[T]`的隐式转换.

### 4. typeTag 总结

现在我们在回头看一下最初的例子:

```scala
scala> def getTypeTag[T : ru.TypeTag](obj: T) = ru.typeOf[T]
```

这里, 我们把`Fruits` 换成了 `ru.TypeTag`, 但是我们并没有看到有`T => TypeTag[T]`的隐式转换啊!

不要急, 听我说, 因为前面已经讲过了, Scala运行时类型信息是保存在TypeTag对象中, 编译器在编译过程中将类型信息保存到TypeTag中, 并将其携带到运行期. 也就是说, **Scala编译器会自动为我们生成一个隐式, 只要我们在方法中定义了这个边界**.

## 5. ClassTag

一旦我们获取到了类型信息(Type instance)，我们就可以通过该Type对象查询更详尽的类型信息.

```scala
scala> val decls = theType.declarations.take(10)
decls: Iterable[ru.Symbol] = List(constructor List, method companion, method isEmpty, method head, method tail, method ::, method :::, method reverse_:::, method mapConserve, method ++)
```

而如果想要获得擦除后的类型信息, 可以使用`ClassTag`,

> 注意,`classTag` 在包`scala.reflect._`下

```scala
scala> import scala.reflect._
import scala.reflect._

scala> import scala.reflect.runtime.universe._
import scala.reflect.runtime.universe._

scala> val tpeTag = typeTag[List[Int]]
tpeTag: reflect.runtime.universe.TypeTag[List[Int]] = TypeTag[scala.List[Int]]

scala> val clsTag = classTag[List[Int]]
clsTag: scala.reflect.ClassTag[List[Int]] = scala.collection.immutable.List

scala> clsTag.runtimeClass
res12: Class[_] = class scala.collection.immutable.List

scala> classOf[List[Int]]
res0: Class[List[Int]] = class scala.collection.immutable.List
```

## 运行时类型实例化

反射是比Scala本身更接近底层的一种技术, 所以当然比本身可以做更多的事情, 我们试着使用反射, 在运行期生成一个实例:

```scala
scala> case class Fruits(id: Int, name: String)
defined class Fruits

scala> import scala.reflect.runtime.universe._
import scala.reflect.runtime.universe._

// 获得当前JVM中的所有类镜像
scala> val rm = runtimeMirror(getClass.getClassLoader)
rm: reflect.runtime.universe.Mirror = JavaMirror with scala.tools.nsc.interpreter.IMain$TranslatingClassLoader@566edb2e of .....

// 获得`Fruits`的类型符号, 并指定为class类型
scala> val classFruits = typeOf[Fruits].typeSymbol.asClass
classFruits: reflect.runtime.universe.ClassSymbol = class Fruits

// 根据上一步的符号, 从所有的类镜像中, 取出`Fruits`的类镜像
val cm = rm.reflectClass(classFruits)
cm: reflect.runtime.universe.ClassMirror = class mirror for Fruits (bound to null)

// 获得`Fruits`的构造函数, 并指定为asMethod类型
scala> val ctor = typeOf[Fruits].declaration(nme.CONSTRUCTOR).asMethod
ctor: reflect.runtime.universe.MethodSymbol = constructor Fruits

// 根据上一步的符号, 从`Fruits`的类镜像中, 取出一个方法(也就是构造函数)
scala> val ctorm = cm.reflectConstructor(ctor)

// 调用构造函数, 反射生成类实例, 完成
scala> ctorm(1, "apple")
res2: Any = Fruits(1,apple)
```

### Mirror

Mirror是按层级划分的，有

- ClassLoaderMirror
  - ClassMirror ( => 类)
    - MethodMirror ( => 方法)
    - FieldMirror ( => 成员)
  - InstanceMirror ( => 实例)
    - MethodMirror
    - FieldMirror
  - ModuleMirror ( => Object)
  - MethodMirror
  - FieldMirror

## 运行时类成员访问

话不多说, 举例来看:

```scala
scala> case class Fruits(id: Int, name: String)
defined class Fruits

scala> import scala.reflect.runtime.universe._
import scala.reflect.runtime.universe._

// 获得当前JVM中的所有类镜像
scala> val rm = runtimeMirror(getClass.getClassLoader)
rm: reflect.runtime.universe.Mirror = JavaMirror with scala.tools.nsc.interpreter.IMain$TranslatingClassLoader@566edb2e of .....

// 生成一个`Fruits`的实例
scala> val fruits = Fruits(2, "banana")
fruits: Fruits = Fruits(2,banana)

// 根据`Fruits`的实例生成实例镜像
val instm = rm.reflect(fruits)
instm: reflect.runtime.universe.InstanceMirror = instance mirror for Fruits(2,banana)

// 获得`Fruits`中, 名字为name的成员信息, 并指定为asTerm类型符号
scala> val nameTermSymbol = typeOf[Fruits].declaration(newTermName("name")).asTerm
nameTermSymbol: reflect.runtime.universe.TermSymbol = value name

// 根据上一步的符号, 从`Fruits`的实例镜像中, 取出一个成员的指针
scala> val nameFieldMirror = instm.reflectField(nameTermSymbol)
nameFieldMirror: reflect.runtime.universe.FieldMirror = field mirror for private[this] val name: String (bound to Fruits(2,banana))

// 通过get方法访问成员信息
scala> nameFieldMirror.get
res3: Any = banana

// 通过set方法, 改变成员信息
scala> nameFieldMirror.set("apple")

// 再次查询, 发现成员的值已经改变, 即便是val, 在反射中也可以改变
scala> nameFieldMirror.get
res6: Any = apple
```

## (补)关于`Manifest`的路径依赖问题

Scala 在2.10之前的反射中, 使用的是 `Manifest` 和 `ClassManifest`.
不过scala在2.10里却用TypeTag替代了Manifest，用ClassTag替代了ClassManifest.

原因是在路径依赖类型中，Manifest存在问题：

```scala
scala> class Foo{class Bar}
defined class Foo

scala> val f1 = new Foo;val b1 = new f1.Bar
f1: Foo = Foo@994f7fd
b1: f1.Bar = Foo$Bar@1fc0e258

scala> val f2 = new Foo;val b2 = new f2.Bar
f2: Foo = Foo@ecd59a3
b2: f2.Bar = Foo$Bar@15c882e8

scala> def mfun(f: Foo)(b: f.Bar)(implicit ev: Manifest[f.Bar]) = ev
mfun: (f: Foo)(b: f.Bar)(implicit ev: scala.reflect.Manifest[f.Bar])scala.reflect.Manifest[f.Bar]

scala> def tfun(f: Foo)(b: f.Bar)(implicit ev: TypeTag[f.Bar]) = ev
tfun: (f: Foo)(b: f.Bar)(implicit ev: reflect.runtime.universe.TypeTag[f.Bar])reflect.runtime.universe.TypeTag[f.Bar]

scala> mfun(f1)(b1) == mfun(f2)(b2)
res14: Boolean = true

scala> tfun(f1)(b1) == tfun(f2)(b2)
res15: Boolean = false
```

# 编译时反射

我们知道，scala编译器会将scala代码编译成JVM字节码，编译过程中会擦除scala特有的一些类型信息，在scala-2.10以前，只能在scala中利用java的反射机制，但是通过java反射机制得到的是只是擦除后的类型信息，并不包括scala的一些特定类型信息。从scala-2.10起，scala实现了自己的反射机制，我们可以通过scala的反射机制得到scala的类型信息。scala反射包括运行时反射和编译时反射，本文主要阐述运行时反射的一些用法，方便scala开发人员参考，具体原理细节请查看官方文档。本文涉及到的代码示例是基于scala-2.10.4，如有不同请勿对号入座。

给定类型或者对象实例，通过scala运行时反射，可以做到：1）获取运行时类型信息；2）通过类型信息实例化新对象；3）访问或调用对象的方法和属性等。下面分别举例阐述运行时反射的功能。

## 获取运行时类型信息

scala运行时类型信息是保存在`TypeTag`对象中，编译器在编译过程中将类型信息保存到`TypeTag`中，并将其携带到运行期。我们可以通过`typeTag`方法获取`TypeTag`类型信息。

```
scala> import scala.reflect.runtime.universe._
import scala.reflect.runtime.universe._

scala> typeTag[List[Int]]
res0: reflect.runtime.universe.TypeTag[List[Int]] = TypeTag[scala.List[Int]]

scala> res0.tpe
res1: reflect.runtime.universe.Type = scala.List[Int]
```

如上述scala REPL显示，通过`typeTag`方法获取`List[Int]`类型的`TypeTag`对象，该对象包含了`List[Int]`的详细类型信息，通过`TypeTag`对象的`tpe`方法得到由`Type`对象封装具体的类型信息，可以看到该`Type`对象的类型信息精确到了类型参数`Int`。如果仅仅是获取类型信息，还有一个更简便的方法，那就是通过`typeOf`方法。

```
scala> import scala.reflect.runtime.universe._
import scala.reflect.runtime.universe._

scala> typeOf[List[Int]]
res0: reflect.runtime.universe.Type = scala.List[Int]
```

这时有人就会问，`typeTag`方法需要传一个具体的类型，事先知道类型还要`TypeTag`有啥用啊。我们不妨写个方法，获取任意对象的类型信息。

```
scala> val ru = scala.reflect.runtime.universe
ru: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@6dae22e7

scala> def getTypeTag[T: ru.TypeTag](obj: T) = ru.typeTag[T]
getTypeTag: [T](obj: T)(implicit evidence$1: ru.TypeTag[T])ru.TypeTag[T]

scala> val list = List(1, 2, 3)
list: List[Int] = List(1, 2, 3)

scala> val theType = getTypeTag(list).tpe
theType: ru.Type = List[Int]
```

如上scala REPL显示，方法`getTypeTag`可以获取任意对象的类型信息，注意方法中的上下文界定`T: ru.TypeTag` ,它表示存在一个从`T`到`TypeTag[T]`的隐式转换，前面已经讲到，`TypeTag`对象是在编译期间由编译器生成的，如果不加这个上下文界定，编译器就不会为T生成`TypeTag`对象。当然也可以通过隐式参数替代上下文界定，就如同REPL中显示的`implicit evidence$1: ru.TypeTag[T]`那样。一旦我们获取到了类型信息(Type instance)，我们就可以通过该`Type`对象查询更详尽的类型信息。

```
scala> val decls = theType.declarations.take(10)
decls: Iterable[ru.Symbol] = List(constructor List, method companion, method isEmpty, method head, method tail, method ::, method :::, method reverse_:::, method mapConserve, method ++)
```

到这里我们知道`TypeTag`对象封装了`Type`对象，通过`Type`对象可以获取详尽的类型信息，包括方法和属性等，通过`typeTag`方法可以得到`TypeTag`对象，通过`typeOf`方法可以得到`Type`对象，它包含没有被编译器擦除的含完整的scala类型信息，与之对应地，如果想获取擦除后的类型信息，传统的方法可以通过java的反射机制来实现，但是scala也提供了该功能，通过`classTag`方法可以获取`ClassTag`对象，`ClassTag`封装了擦除后的类型信息，通过`classOf`方法可以获取`Class`对象，这与java反射中的`Class`对象一致。

```
scala> import scala.reflect._
import scala.reflect._

scala> val clsTag = classTag[List[Int]]
clsTag: scala.reflect.ClassTag[List[Int]] = scala.collection.immutable.List

scala> clsTag.runtimeClass
res0: Class[_] = class scala.collection.immutable.List

scala> val cls = classOf[List[Int]]
cls: Class[List[Int]] = class scala.collection.immutable.List

scala> cls.[tab键补全]
asInstanceOf              asSubclass          cast
desiredAssertionStatus    getAnnotation
getAnnotations            getCanonicalName    ...   
```

从上述scala REPL中可以看到，`ClassTag`对象包含了`Class`对象，通过`Class`对象仅仅可以获取擦除后的类型信息，通过在scala REPL中用tab补全可以看到通过`Class`对象可以获取的信息。

## 运行时类型实例化

我们已经知道通过`Type`对象可以获取未擦除的详尽的类型信息，下面我们通过`Type`对象中的信息找到构造方法并实例化类型的一个对象。

```
scala> case class Person(id: Int, name: String)
defined class Person

scala> val ru = scala.reflect.runtime.universe
ru: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@3e9ed70d

scala> val m = ru.runtimeMirror(getClass.getClassLoader)
m: ru.Mirror = JavaMirror with scala.tools.nsc.interpreter.IMain$TranslatingClassLoader@a57fc5f ...

scala> val classPerson = ru.typeOf[Person].typeSymbol.asClass
classPerson: ru.ClassSymbol = class Person

scala> val cm = m.reflectClass(classPerson)
cm: ru.ClassMirror = class mirror for Person (bound to null)

scala> val ctor = ru.typeOf[Person].declaration(ru.nme.CONSTRUCTOR).asMethod
ctor: ru.MethodSymbol = constructor Person

scala> val ctorm = cm.reflectConstructor(ctor)
ctorm: ru.MethodMirror = constructor mirror for Person.<init>(id: scala.Int, name: String): Person (bound to null)

scala> val p = ctorm(1, "Mike")
p: Any = Person(1,Mike)
```

如上scala REPL代码，要想通过`Type`对象获取相关信息，必须借助`Mirror`，`Mirror`是按层级划分的，有`ClassLoaderMirror`, `ClassMirror`, `InstanceMirror`, `ModuleMirror`, `MethodMirror`, `FieldMirror`。通过`ClassLoaderMirror`可以创建`ClassMirror`, `InstanceMirror`, `ModuleMirror`, `MethodMirror`, `FieldMirror`。通过`ClassMirror`, `InstanceMirror`可以创建`MethodMirror`, `FieldMirror`。`ModuleMirror`用于处理单例对象，通常是由`object`定义的。从上述代码中可以发现，首先获取一个`ClassLoaderMirror`，然后通过该`Mirror`创建一个`ClassMirror`，继续创建`MethodMirror`，通过该`MethodMirror`调用构造函数。从一个`Mirror`创建另一个`Mirror`，需要指定一个`Symbol`，`Symbol`其实就是绑定名字和一个实体，有`ClassSymbol`、 `MethodSymbol`、 `FieldSymbol`等，`Symbol`的获取是通过`Type`对象方法去查询，例如上述代码中通过`declaration`方法查询构造函数的`Symbol`。

## 运行时类成员访问

下面举例阐述访问运行时类成员，同理，我们只需逐步创建`FieldMirror`来访问类成员。

```
scala> case class Person(id: Int, name: String)
defined class Person

scala> val ru = scala.reflect.runtime.universe
ru: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@3e9ed70d

scala> val m = ru.runtimeMirror(getClass.getClassLoader)
m: ru.Mirror = JavaMirror with scala.tools.nsc.interpreter.IMain$TranslatingClassLoader@a57fc5f ...

scala> val p = Person(1, "Mike")
p: Person = Person(1,Mike)

scala> val nameTermSymb = ru.typeOf[Person].declaration(ru.newTermName("name")).asTerm
nameTermSymb: ru.TermSymbol = value name

scala> val im = m.reflect(p)
im: ru.InstanceMirror = instance mirror for Person(1,Mike)

scala> val nameFieldMirror = im.reflectField(nameTermSymb)
nameFieldMirror: ru.FieldMirror = field mirror for Person.name (bound to Person(1,Mike))

scala> nameFieldMirror.get
res0: Any = Mike

scala> nameFieldMirror.set("Jim")

scala> p.name
res2: String = Jim
```

如上代码所示，通过层级`ClassLoaderMirror`->`InstanceMirror`->`FieldMirror`得到`FieldMirror`，通过`Type`对象调用方法`declaration(ru.newTermName("name"))`获取name字段的`Symbol`，通过`FieldMirror`的`get`和`set`方法去访问和修改成员变量。

说了这么多，貌似利用java的反射机制也可以实现上述功能，还不用这么的费劲。关键还是在于你要访问编译器擦除后的类型信息还是擦除前的类型信息，如果是访问擦除后的类型信息，使用java和scala的反射都可以，但是访问擦除前的类型信息，那就必须要使用scala的反射，因为java的反射并不知道擦除前的信息。

举个栗子，一步步剖析，首先定义一个基类`A`，它包含一个抽象类型成员`T`，然后分别派生出两个子类`B`和`C`。

```
scala> class A {
     | type T
     | val x: Option[T] = None
     | }
defined class A

scala> class B extends A
defined class B

scala> class C extends B
defined class C
```

现在分别实例化`B`和`C`的一个对象，并将抽象类型`T`具体化为`String`类型。

```
scala> val b = new B { type T = String }
b: B{type T = String} = $anon$1@446344a8

scala> val c = new C { type T = String }
c: C{type T = String} = $anon$1@195bc0a4
```

现在通过java的反射机制判断对象`b`和`c`的运行时类型是否是父子关系。

```
scala> b.getClass.isAssignableFrom(c.getClass)
res3: Boolean = false
```

可以看到通过java的反射判断对象`c`的运行时类型并不是对象`b`的运行时类型的子类。然而从我们的定义来看，对象`c`的类型本应该是对象`b`的类型的子类，到这里我们就会想到编译器，在实例化对象`b`和`c`时实际上是通过匿名类来实例化的，一开始定义类型信息在编译的时候被擦除了，转为匿名类了。下面通过scala的反射机制判断对象`b`和`c`的运行时类型是否是父子关系。

```
scala> val ru = scala.reflect.runtime.universe
ru: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@3e9ed70d

scala> def isSubClass[T: ru.TypeTag, S: ru.TypeTag](x: T, y: S): Boolean = {
     | val leftTag = ru.typeTag[T]
     | val rightTag = ru.typeTag[S]
     | leftTag.tpe <:< rightTag.tpe
     | }
isSubClass: [T, S](x: T, y: S)(implicit evidence$1: ru.TypeTag[T], implicit evidence$2: ru.TypeTag[S])Boolean

scala> isSubClass(c, b)
res5: Boolean = true
```

从上述代码中可以看到，通过scala的反射得到的类型信息符合我们一开始定义。所以在scala中最好是使用scala的反射而不要使用java的反射，因为很有可能编译后通过java的反射得到的结果并不是想象的那样。