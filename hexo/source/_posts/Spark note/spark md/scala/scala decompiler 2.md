---
title: "[Scala 令人着迷的类设计](https://www.cnblogs.com/nowgood/p/ScalaClass.html)"
date: 2019-11-14 21:30:40
slug: "scala decompiler 2"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# [Scala 令人着迷的类设计](https://www.cnblogs.com/nowgood/p/ScalaClass.html)

这篇博客深入介绍 Scala 的类的相关知识, 看看 Scala 简洁的类定义背后都发生了什么? 从简洁的 Scala 类定义代码到冗长的反编译代码解读之后, 回过头在去编写简洁的 Scala 代码时, 我相信这是一个奇妙的感觉.

尽管 Scala 和 Java 有很多相同的地方, 但是在类的声明, 构造, 访问控制上存在很大的差异, 通过本文你也能看到相比较 Java 很多啰嗦的模板代码, Scala 更加的简洁, 使用 Scala 之后, 我想你再也不想去编写那些冗长的 Java 代码了. 不过由于 Scala 写代码简化了很多东西(背后为我们编写很多模板代码), 如果你刚从 Java 转到 Scala, 会感觉有点不适应, 不过一旦你了解 Scala 类的知识, 你将会有不一样的感觉.

为了让你看清楚 Scala 类的全貌, 本文使用 [Java Decompiler](http://jd.benow.ca/) 反编译工具向你展现 Scala 代码反编译的结果, 这样 Scala 都做了什么你就一目了然了. 还有一点就是, JavaBean 中 一对 getter /setter 方法通常称为`属性`, 由于 Scala 并没有遵循 JavaBeans 规范将字段属性定义为 getXXX, setXXX, 现在有各种中文版称呼, 现在还没有一个让我感到很舒服的称中文名称, 所以本文还是沿用 Java 中称呼, 用 setter 表示修改方法, getter 表示取值方法, 如果你从 Java 中转过来, 这样表示你将会感到很舒服.

本文以如下思路依次展现 Scala 类相关知识. 为了能避免理论上的空谈, 我们从代码入手, 这就要求我们先得有一个类, 所以我们先从类的主构造器入手, 看看 Scala 类的大致样子, 然后再介绍类的字段定义和访问控制, 方法可见性, 辅助构造器等相关知识, 下面, 我们先看看类的主构造器吧

## 1. 主构造器

如果你是从 Java 转到 Scala, 你马上就能发现 Scala 声明主构造函数的过程和 Java 区别很大; Java 中构造器函数的定义一目了然, 由于Scala 的设计者认为每敲一个键都是珍贵的, 所以**把 Scala 主构造器的定义和类的定义交织在一起, 导致 Scala 的主构造器没法像 Java 的构造器那样清晰了**. 当我们学习新知识时, 开放的心态是很重要的, 因为这样我们才能欣赏不同第一眼令我们困惑的设计蕴含的迷人的东西. 在看到下面的代码时, 如果你觉得困惑, 不妨以一种比较开放的思维来看待这样的设计, 想想这样设计给我们带来的代码上的简洁. Scala 之父 Martin Odersky 建议我们这样来看待主构造器, "在 Scala 中, 类也接受参数, 就像方法一样". 开始介绍技术上的知识:)

### 主构造器结构

先来说明 Scala 类一个术语的定义, 字段(Filed), 对应于 Java 中成员变量, 不过又有不同之处, Scala 中字段还对应一组 setter/getter 方法, 现在有疑问的话, 可以先当成员变量理解, 看到后面就懂了.

在 Scala 中, 每个类都有主构造器, 有如下的结构

1. 主构造器的定义和类的定义交织在一起, 主构造器的参数被编译成字段;
2. 主构造器会执行类定义中的所有语句;
3. 如果类名后没有参数, 即该类具备一个无参主构造器, 这样的一个构造器仅仅简单的执行类体的所有语句而已

好的, 我们来看一个简单的 Flower 类, Flower 类体由 3 个字段, 1 个方法定义和调用语句, 以及 2 个 println 语句构成

```scala
class Flower(val name: String, var color: String) {
  
  println("constructor start")
  
  var number = 10
  def showMessage = println(s"$number $color $name")
  showMessage
  
  println("constructor finish")
}

object Test extends App {
  new Flower("lilac", "purple") // lilac 丁香花 
}

/*输出
constructor start
10 purple lilac
constructor finish 
*/
```

我们先来看看看上面的 Flower 类. 定义 Flower 类时, 我们直接在类名后加上了参数列表, 即主构造器的参数列表, 这是与 Java 的不同之处, 即上面说的第 1 个特点, 主构造器的定义和类的定义交织在一起, 并且这些由 val 或 var 定义的参数列表会成为 Flower 类的字段(成员变量); 接着, 我故意把 Flower 🌺的数量 number 字段定义在类体里面, 是为了说明我们既可以选择将字段定义在主构造器参数中, 也可以将字段定义在类体中, 字段定义在主构造器参数中的好处就是能够在 new 一个对象的时候, 能将传入参数给字段赋值. 并且我们定义了一个方法 showMessage, 并且调用了它;

在测试语句中, 我们使用 `new Flower("lilac", "purple")` 调用了类的主构造器, 从 Flower 类调用主构造器初始化的输出结果可以看出 Scala 主构造器的 第 2 个特点, 即主构造器会执行类定义中的所有语句, 从语句 println("constructor start")到类定义的最后一条语句 println("constructor finish").

> 其实主构造器的第一条语句是主构造器参数的所在字段的赋值语句, 具体看下面的反编译之后的构造器部分).

然后我们看看为什么背后发生了什么? 这里使用 JAD 工具反编译结果如下, 为了满足你的好奇心和内容的整体性, 这里我把反编译的全部代码都贴在下面, 然后后面部分一点一点说明, 所以说如果你有疑惑的部分也不要紧, 后面会把所有的问题解释清楚.

#### Flower类反编译代码

```scala
import scala.Predef;
import scala.StringContext;
import scala.collection.Seq;
import scala.collection.mutable.WrappedArray;
import scala.reflect.ScalaSignature;
import scala.runtime.BoxesRunTime;

// 此处删去了 @ScalaSignature(bytes = XXXX)

public class Flower {
    private final String name;
    private String color;
    private int number;

    public String name() {
        return this.name;
    }

    public String color() {
        return this.color;
    }

    public void color_$eq(String x$1) {
        this.color = x$1;
    }

    public int number() {
        return this.number;
    }

    public void number_$eq(int x$1) {
        this.number = x$1;
    }

    public void showMessage() {
        Predef..MODULE$.println((Object)new StringContext((Seq)Predef..MODULE$.wrapRefArray((Object[])new String[]{"", " ", " ", ""})).s((Seq)Predef..MODULE$.genericWrapArray((Object)new Object[]{BoxesRunTime.boxToInteger((int)this.number()), this.color(), this.name()})));
    }

    public Flower(String name, String color) {
        this.name = name;
        this.color = color;
        Predef..MODULE$.println((Object)" constructor start");
        this.number = 10;
        this.showMessage();
        Predef..MODULE$.println((Object)"constructor  finish");
    }
}
```

上面反编译的结果, 如果不纠结细节, 从总体上来看还是很清晰的. 现在我们来分析一下

#### Flower类反编译代码解析

首先, 我们定义类 Flower 时, 并没有声明类的可见性, 反编译的结果 Flower 类的可见性是 public. 这是因为在 Scala 中, 类的默认可见性就是 public, 且 Scala 源文件中可以包含多个类, 这些类可见性都是 public.

然后, 我们来看看主构造器 `public Flower(String name, String color)`, 可以看出主构造器会执行类中定义中的所有语句, 也就是说 Scala 主构造器包含了整个类定义, 和类的定义交织在一起; 同时我们看一看到反编译代码类的前 3 行是:

```scala
private final String name;
private String color;
private int number;
```

可以看出主构造器参数花名 name 和颜色 color 都自动变成了反编译类中的成员变量(这里没有说是字段是因为在反编译代码很接近 Java 源代码, 比如说 name, 只是一个成员变量). 你一定发现了反编译代码中还有一些方法, 下面我们就来说说这些方法. 不过在说这些方法之前, 我们来回忆一下字段, 之前说过 Scala 的字段和 Java 的成员变量的类似, 其实差别还是很大的, 因为在 Scala 中定义字段时, 自动生成了 setter/getter 方法; 在 Scala 中, getter 和 setter 分别叫做 `XXX` 和 `XXX_=`, 比如说字段 color 的 getter/setter 方法就是 color_= 和 color

```scala
private String color;

public String color() {
        return this.color;
}

public void color_$eq(String x$1) {
        this.color = x$1;
}
```

看到这里你可能会疑惑, 因为你发现, 编译器显示的创建的是 `color` 和 `color_$eq` 方法, 由于 JVM 不允许在方法名中使用 `=`, 所以在编译过程中 `将 = 替换为 $eq`. 结合上面的代码, 我们可以这样理解 Scala 类的字段

```
字段 = 成员变量 + getter/setter方法
```

也就是在定义字段时, 我们心中要明白, 我们除了创建了可见的变量之外, 其实 Scala 还自动为我们创建了 getter/ setter 方法.

到这里, 主构造器的知识就到此为止了, 关于辅助构造器的知识放在后面的小节再说. 因为我想你现在更多的疑惑的在字段身上, 比如说 为什么字段 name 只有 getter 方法, 而 字段 color 同时有 getter 和 setter 方法. 从下一节, 我们来探索下 Scala 的字段相关知识.

结束之前我们来做一个"无聊"的数数游戏, 在这里我们假设反编译代码等同于实现相同功能的 Java 代码. Scala 实际代码长度为 6 行, 而 Java 代码大约花费 23 行代码才能实现, 从而可以看到 Scala 代码的简洁性. 在这里我们引用 ＜＜黑客与画家＞＞的一个例子， 在实际开发中, 假设写每行代码的时间相同, 一个项目使用 Scala 开发完成需要１年，　而使用　Java 开发需要 4 年. 所以, 虽然刚开始接触 Scala 的类时, 感觉有些疑惑, 不过思想上愿意后, 很快就会觉得这样才自然.

> 在 Java 中构建单例对象时, 需要将构造器私有化, 在 Scala 中你也可以将主构造器私有化, 可以这样使用 private 修饰符, 由于 Scala 中有单例对象 object, 所以这个知识也就是提一下, 还不清楚生产环境中有什么用途
> class Pet private (val creature: String)

## 2. 类的字段

上一节结束时说到了, Flower 类反编译代码中, 为什么字段 name 只有 getter 方法, 而 字段 color 同时有 getter 和 setter 方法? 在说明这个问题之前, 让我们简化一下之前的类 Flower, 由于这一节的关注点是字段, 所以我们只留下字段, 并在类中添加一个字段 language(花语).

```
class Flower(val name: String, var color: String) {
  
    var number = 10
    val language = "Missing you"   
}
```

反编译代码

### 2.1 Flower类的字段反编译代码

```
public class Flower {
    private final String name;
    private String color;
    private int number;
    private final String language;

    public String name() {
        return this.name;
    }

    public String color() {
        return this.color;
    }

    public void color_$eq(String x$1) {
        this.color = x$1;
    }

    public int number() {
        return this.number;
    }

    public void number_$eq(int x$1) {
        this.number = x$1;
    }

    public String language() {
        return this.language;
    }

    public Flower(String name, String color) {
        this.name = name;
        this.color = color;
        this.number = 10;
        this.language = "Missing you";
    }
}
```

我们可以看到, 字段既可以在两个地方定义:

1. 类的主构造器参数中
2. 类中定义

下面我们先来说明在字段在类中定义的情况, 关于字段在主构造器参数中定义的情况与之有一点点的小区别, 为了文章的清晰性, 我们还是分开介绍.

### 2.2 类中定义的字段

类中定义的字段的访问控制属性由关键字 val, var 和 private 控制. 这里要说明的一点是 如果我们按照之前说过的方式来理解 Scala 的字段的话, 即

```
字段 = 成员变量 + getter/setter方法
```

Scala 的字段对应的成员变量的可见性默认就是 private 的, val 和 var 控制的字段是否可变, 即是否有 setter 方法; 这里要分清楚的是, 我们本节一开始说类的字段的属性可以由 private 关键字控制, 实际上 private 关键字控制的是字段对应的 getter/setter 方法的可见性, 我们需要明确写出, 而字段的成员变量的可见性是 private, 是强制默认的.

类中字段定义的具体是规则是:

1. 如果字段被声明为 var, Scala 会为该字段生成 getter 方法和 setter 方法, 方法的可见性是 public
2. 如果字段被声明为 val, Scala 会只为该字段生成 getter 方法, 方法的可见性是 public
3. 如果字段被声明为 private var, Scala 会为该字段生成 getter方法和 setter方法, 方法的可见性是 private
4. 如果字段被声明为 private val, Scala 会只为该字段生成 getter 方法, 方法的可见性是 private

这也好理解, Scala 中 var定义的是可变引用, val 定义的是一个不变引用, 没法修改, 自然就不可以有 setter方法去修改它. 如果你不需要 getter/setter 方法, 你可以将字段声明为 private var 或者 private val, 这样就没法在类的外部调用了 getter/sette 方法访问字段和修改字段的值了.

如果你现在还有点疑惑的话, 我们来看看下面的例子. 通过实例学习是不错的学习方式, 看完例子之后你就豁然开朗了. 那么我们来看看 Flower 类中定义的字段

```
var number = 10
val language = "Missing you" 
```

对应的反编译代码整理如下

```scala
// 说明: number 字段由 var 定义, 
// 反编译代码生成的成员变量可见性为 private, 
// 并生成 setter 方法和 getter 方法, 可见性为 public.
 
private int number;
public int number() {
        return this.number;
    }

public void number_$eq(int x$1) {
        this.number = x$1;
    }

// 说明: language 字段由 val 定义, 
// 反编译代码生成的成员变量可见性为 private, 用 final定义为常量, 
// 并生成了 getter 方法, 可见性为 public.

private final String language;
public String language() {
        return this.language;
  }
```

如果将上面字段使用 private 关键字修饰的话, 即

```scala
class Flower(val name: String, var color: String) {
    private var number = 10
    private val language = "Missing you"   
}
```

反编译结果如下, 不做解释

```scala
public class Flower {

    private int number;
    private final String language;
    
    // getter, setter 方法可见性为 private 
    private int number() {  
        return this.number;
    }

    private void number_$eq(int x$1) {
        this.number = x$1;
    }

    private String language() {
        return this.language;
    }
}
```

类中定义的字段的基础知识就到这里了, 主构造器中定义的字段的方式几乎与类中定义的字段一模一样, 除了一点区别之外, 下面让我们看看吧

### 2.3 主构造器中定义的字段

类中定义字段的方式可以完全照搬到主构造器中字段的定义中, 除此之外, 主构造器的参数可以像一般方法参数一样, 不带 val 或者 var, 有意思的时, 这样的参数如何处理取决于它们在类中如何被使用

1. 如果不带 val 或者 var 的参数至少被一个方法所使用, 它变成由 val 的字段
2. 否则, 该参数将不会被保存为一个字段, 它仅仅是一个可以被主构造器的代码访问的普通参数,.

关于第 2 点, 即构造器不被任何方法使用时, 那么这个参数的存在就没有实际意义, 所以编译器就做了优化, 并不会将这样一个没有实际意义的参数定义为类的字段. 我们可以假想一个场景, 类设计者在一开始给在类的主构造器中定义的很多对象属性, 但是这些属性不是强制使用的, 后来的开发人员可以根据需要使用.

同样还是通过一个例子就能说明, 例子中定义了两个构造器参数, 故意设计为一个被方法使用了和一个从来没有使用过, 然后我们看看反编译结果

```scala
class Book(name:String,  pages: Int) {
  def bookPages = pages
}
```

反编译代码

```scala
public class Book {
    private final int pages;

    public int bookPages() {
        return this.pages;
    }

    public Book(String name, int pages) {
        this.pages = pages;
    }
}
```

可以看出参数 pages 被使用了, 所以被升格变为由 val 定义的字段, 而参数 name, 它仅仅是一个可以被主构造器的代码访问的普通参数.

现在类中字段定义和主构造器中字段定义都说清楚了, 下面我们来看看字段更加细粒度的访问控制吧, 你也看可以跳过下面这一小节, 因为这个知识很繁琐, 用到的机会也不多.

### 2.4 字段细粒度访问控制

相比较 Java, 在 Scala 中的字段访问控制实际上可以做到更加的细粒度, 这里引用　＜＜Scala 编程实战＞＞ 的方法可见性级别, 书中按照从 "最严格" 到 "最开放" 的顺序, 将 Scala 的作用域级别分为以下

- 对象私有作用域
- 私有的作用域
- 受保护作用域
- 包内可见
- 指定包内可见
- 公共可见性

这里的可见性级别也适用于字段, 为何这样说了, 我们之前说过我们可以这样理解字段

```
字段 = 成员变量 + getter/setter方法
```

我们实际上是通过控制字段的 getter/setter 方法的可见性来控制字段的可见性的, 说到这我希望我说明白了. 下面我不再说是方法的可见性了, 而是直接说是字段的可见性.

再补充下, 前面提到过, 在 Scala 中, 类的默认可见性是 public, 且 Scala 源文件中可以包含多个类, 这些类可见性都是 public. 我们把多个类定义在一个文件中和定义在同一个包下多个文件中效果是一样的, 所以下面我们会为了简洁将多个类定义在同一个源文件中.

我们代码文件的包结构如下

![屏幕快照 2017-08-08 下午4.05.10](https://images2017.cnblogs.com/blog/1182370/201708/1182370-20170808221252355-1567696823.png)￼

我们在包 nowgood.accesscontrol 中定义了宠物类 Pet, 在类中有一些用 val 定义了"见名知意"的字段.
我们通过访问这些字段来说明字段的可见性, 在上述目录结构中我们在定义了如下类:

1. Pet类用于说明 对象私有作用域 和 类私有作用域
2. Dog类和 Panda类用于说明 受保护作用域
3. Accesscontrol 类用于说明 包内可见;
4. Nowgood 类用于说明 指定包内可见;
5. 上面所有类中都可以说明 公有可见性

下面贴代码, 代码中标明 `编译器报错` 的注释, 表明在当前作用域不能访问的字段.

#### class Pet

```scala
package nowgood.accesscontrol

class Pet {
  
  // 对象私有作用域
  private[this] val privateThis = "private[this] Pet"
  // 私有的作用域
  private val privatee = "private Pet"
  // 受保护作用域
  protected val protectedd = "protected Pet"
  // 包内可见
  private[accesscontrol] val  privateAccesscontrol = "private[accesscontrol] Pet"
  // 指定包内可见
  private[nowgood] val privateNowgood = "private[nowgood] Pet"
  // 公共可见性
  val publicc = "Pet"
  
  protected def show = println(privateThis)
  
  def showInfo(otherPet: Pet) {
    
    // println(pet.privateThis)  编译器报错, 与 方法 show 和下面的 otherPet.privatee 对比说明, 不能访问本类的其他实例, 具有对象私有可见性
        
    println(otherPet.privatee)
    println(otherPet.protectedd)   
    println(otherPet.privateAccesscontrol) 
    println(otherPet.privateNowgood)
    println(otherPet.publicc)
  } 
 
}

class Dog extends Pet {
   def showInfo1 = println(protectedd)
   def showInfo2(pet: Pet) {
   
    /* 编译器报错   
    println(pet.privateThis) 
    println(pet.privatee) 
    
    // 和 showInfo1 比较可以看出 protected 字段对继承类型可见而对继承类型的其他实例不可见 
    println(pet.protectedd)
    */
     
    println(pet.privateAccesscontrol) 
    println(pet.privateNowgood)
    println(pet.publicc)
  } 
}

class Accesscontrol{
  
   def showInfo(pet: Pet) {
   
    /* 编译器报错 
    println(pet.privateThis)
    println(pet.privatee)
    println(pet.protectedd)
    */
 
    println(pet.privateAccesscontrol) 
    println(pet.privateNowgood)
    println(pet.publicc)
  } 
}


class Panda {
   // def showName(pet: Pet ) = pet.name3
   // 编译时错误, 由于 Panda 不是 Pet 的子类所以没法在 Panda 中访问
}
```

#### class Nowgood

```scala
package nowgood

import accesscontrol.Pet

class Nowgood {
  
  def showInfo(pet: Pet) {
   
    /* 编译器报错 
    println(pet.privateThis)
    println(pet.privatee)
    println(pet.protectedd)
    println(pet.privateAccesscontrol)
    */
    
    println(pet.privateNowgood)
    println(pet.publicc)
  }
}
```

如果你愿意用心去看上面的代码, 我想你应该很轻松就能理解了, 不过有一些细节还是在这里说明下. 这里要特别说明的是`受保护保护`可见性字段, protected 声明的字段对子类可见, 但是对子类的其他对象和包中的其他类都不可见, 这和 Java 的区别, Java 中 protected 成员变量不仅对子类可见, 而且对子类的其他类型和包中其他类都具有可见性.

看如下例子

#### class Person

```scala
package test;

public class Person {
    protected  String name;
    Person(String name) {
        this.name = name; 
    }
}
```

Teacher 编译通过说明 Java 中 protected 成员变量的包可见性

```scala
class Teacher {
    public void show(Person person) {
        System.out.println(person.name);
    }
}
```

#### class Student

```scala
package test;

// 说明 Java 父类 protected 成员变量对子类的其他对象的可见性
public class Student extends Person {

    public Student (String name) {
        super(name);
    }

    public static void main(String[] args) {
        new Student("wangbin").show(new Person("wangbin"));
    }

    public  void show(Person person) {
        System.out.println(this.name == person.name);
    }

}

/*输出
 true
*/
```

上面的说明的访问控制机制, 其实就是方法的访问控制机制, 并且 Scala 所有的方法参数都是不变引用, 所以说现在 Scala 方法的访问控制和参数类型你也都掌握了, 已经能够进行 Scala 的简单的面向对象编程了.

> 其实 Scala 有更加细致的方法, 类, 字段的访问控制机制, 想要详细了解的请参考 ＜＜Scala 程序设计 ＞＞ 第二版第 13 章有详细的讲解.

### 2.5 重定义默认的 getter/setter 方法

如果你想要自定义某个字段 getter/setter 方法的逻辑, 首先你想到可能是从覆写 Scala 自动生成的 getter 或 setter 方法, 我们来看看这样是不是能走的通

```scala
class Fruit(val name: String, var num: Int) {
  
  def num()= num  // 错误1
  
  def num_=(n: Int)  { // 报错2
    if (n >= 0) num = n  // 报错3
  }  
}
```

这里会 3 个错误,其中一个错误为

```
method num_=#39263 is defined twice; the conflicting method num_=#39254 was defined at line 7:7 of '/Users/mac/Documents/ScalaEclipseProject/Decompiler/src/nowgood/Fruit.scala'
```

总而言之就是这条路没法走通,常见做法就是在将参数名 xxx 前添加下换线 `_xxx`, 并将可见性声明为 private, 然后手动创建 getter/setter 方法 `xxx` 和 `xxx_=`. 补充一点, Scala 中当我们定义无参方法时, 方法名后面的小括号`()` 是可选的; 如果方法定义时, 采用不带括号的风格, 方法调用时, 只能使用使用不带括号的风格; 如果方法定义时, 采用带括号的风格, 方法调用时, 既可以在方法名后写上圆括号, 也可以不写.

private 关键字的作用是不会把这个字段暴露给其他类, 并且下面为了同时测试 getter, setter 方法所以将字段定义为 private var.

```scala
package nowgood

class Fruit(val name: String, private var _num: Int) {

// 不可写成 def num() = _num, 理由见下分析
  def num = _num    
  def num_=(n: Int) {
    if (n >= 0) _num = n 
  }  
}

object TestFruit {
  
   def main(args: Array[String]): Unit = {  
      var apple = new Fruit("apple", 10)
      apple.num = 6   
      println(apple.num) 
   }
 
}
```

结合例子做出说明, 在重写 Scala 风格 getter 方法时, Scala 规定使用不带括号的风格(使用带括号风格的话, 我们没法使用 Scala 提供给 setter 方法的语法糖, 只能通过 `apple.num_=(6)` 方式调用 setter 方法, 这就是普通的方法调用, 我们把 setter 方法写成 `xxx_=` 形式也失去了意义); 当我们调用 setter 方法时, 如上 `apple.num = 6` 就像我们直接给这个字段赋值一样, 实际上背后调用的是 `apple.num_=(6)`, 这是 Scala 给 getter/setter 方法提供的语法糖, Scala 形式的 setter 方法与 getter 方法一起出现时这种写法才成立

这里提醒下, 千万不要以为编译器看到了 `xxx_=` 形式的方法命名就可以通过这种方式来进行方法调用. 你可以把上面的 `def num = _num` 定义拿掉, 编译器报错 `value num is not a member of nowgood.Fruit`; 所以说 `xxx_=` 形式的方法命名只有在 getter 方法放在一起搭配时才有用. 我大胆在这里猜测一下 setter 方法 `apple.num = 6` 这个语法糖的工作过程, 在我们 Fruit 类中, 等号的左边 apple.num 的返回值为是一个 Int 类型, Int 类型是不变类型, 将 6 赋值时 Scala 编译器会收到这个异常, 然后进行异常处理. 异常处理过程为, 编译器发现 num 方法签名符合 Scala getter 方法风格(即无参不带小括号), 然后编译器会去找方法签名为`num_=`, 并且参数个数为 1 方法, 如果找到了就将 `apple.num = 6` 转化为 `apple.num_=(6)` 的方法调用, 如果找不到报错 `value num_= is not a member of nowgood.Fruit`.

## 3. 辅助构造器

为了满足业务需求, 我们大多数情况下, 我们都会定义多个构造器, Scala 中构造器分为主构造器和辅助构造器, 主构造器的风格第一节已经说过了, 现在来说一说辅助构造器.

Scala 的辅助构造器相比较主构造器来说, 结构及其简单, 主要包括下面几点

1. 辅助构造器必须用 this 命名构建;
2. 每个辅助构造器`必须`以主构造器或者一个先前定义的其他辅助构造器的调用开始;
3. 每个辅助构造器必须有不同的方法签名
4. 每个辅助构造器通过 this 调用另一个不同的构造函数;

即: 辅助构造器第一条语句为调用主构造器或者一个先前定义的其他辅助构造器的语句, 如果调用的是主构造器的话, 形式是 `this(主构造器参数列表)`. 并且方法定义为[过程形式](http://www.cnblogs.com/nowgood/p/scalastartup.html#_nav_16), 即 如果方法体包含在花括号当中但没有前面的等于号= ;

下面来看个例子

```scala
package nowgood

class Feline (val name: String, val size: String, val num: Int) { 
  // 辅助构造器1
  def this(name: String) {
    this(name, "Big", 2) // 第一条语句
    }
  
  // 辅助构造器2
  def this() {
    this("tiger")
  }
  
  // 辅助构造器3, 与 辅助构造器1 方法签名冲突
//  def this(size: String) {
//    this(" leopard", size, 10)
//
//  }
  
  override def toString: String = s"$num $size $name"
}

object TestFeline extends App {
  val cat  = new Feline("cat", "small", 5)
  val lion = new Feline("lion")
  val tiger = new Feline() 
  println(cat)
  println(lion)
  println(tiger)
}

/*输出
5 small cat
2 Big lion
2 Big tiger
*/
```

上面代码中, 辅助构造器 3 与 辅助构造器 1 方法签名冲突, 所以被注释掉了, 如果你确实想要设定美洲豹的体型, 你可以使用 case class, 定义一个 case class Size(size: String), 这里只是为了引出 Scala 中的重量级类 case class, case class 使用极其简单, 在 Scala 中使用极其广泛, 不过由于篇幅原因就不在这里说明了, 网上有大量关于 case class 的介绍.

关于 Scala 类的介绍就到这里了, 如果你还意犹未尽的话, 还可以看看我之前写的关于 [继承](http://www.cnblogs.com/nowgood/p/scalainherit.html) 和 [特质(trait)](http://www.cnblogs.com/nowgood/p/scalatrait.html) 的文章, 特质这篇下了很大的功夫去写, 希望能有所帮助. 最近学习 Scala 有所感悟, 分享给和我一样为 Scala 着迷的人, 文中难免出现错误, 欢迎指正. 如果你有不同的看法和理解, 欢迎分享交流.

## 参考书籍

1. 快学 Scala
2. Scala 编程实战
3. scala in depth