---
title: "[了解Scala 宏](https://www.cnblogs.com/barrywxx/p/10747025.html)"
date: 2019-11-01 05:35:00
slug: "Scala 宏"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# [了解Scala 宏](https://www.cnblogs.com/barrywxx/p/10747025.html)

[了解Scala反射](https://www.cnblogs.com/barrywxx/p/10747008.html)介绍了反射的基本概念以及运行时反射的用法, 同时简单的介绍了一下编译原理知识, 其中我感觉最为`绕`的地方, 就属泛型的几种使用方式了.

*而最抽象的概念, 就是对于符号和抽象树的这两个概念的理解.*

现在回顾一下泛型的几种进阶用法:

- **上界 <:**
- **下界 >:**
- **视界 <%**
- **边界 :**
- **协变 +T**
- **逆变 -T**

现在想想, 既然已经有了泛型了, 还要这几个功能干嘛呢? 其实可以类比一下, 之前没有泛型, 而为什么引入泛型呢?

> 当然是为了代码更好的服用. 想象一下, 本来一个方法没有入参, 但通过参数, 可以减少很多相似代码.
>
> 同理, 泛型是什么, **generics**. 又叫什么, 类型参数化. 本来方法的入参只能接受一种类型的参数, 加入泛型后, 可以处理多种类型的入参.
>
> 顺着这条线接着往下想, 有了逆变和协变, 我们让泛型的包装类也有了类继承关系, 有了继承的层级关系, 方法的处理能力又会大大增加.

​		泛型, 并不神奇, 只是省略了一系列代码, 而且引入泛型还会导致`泛型擦除`, 以及一系列的隐患. 而类型擦除其实也是为了兼容更早的语言, 我们束手无策.
​		但泛型在设计上实现的数据和逻辑分离, 却可以大大提高程序代码的简洁性和可读性, 并提供可能的编译时类型转换安全检测功能. 所以在可以使用泛型的地方我们还是推荐的.

​		**Scala Macros**对scala函数库编程人员来说是一项不可或缺的编程工具，可以通过它来解决一些用**普通编程或者类层次编程（type level programming）**都无法解决的问题，这是因为**Scala Macros可以直接对程序进行修改**。

​		说到对程序进行修改,几个概念一定要先理解,"编译期"和"运行期",Java也有一个可以修改程序的功能,大家一定用过,就是反射.不是在运行期,编译器也不知道接下来会发生什么,会执行哪些代码(这就是==**动态性**==).

​		而scala是java的衍生语言，自然也有反射，而且它还有一种更高级的反射，就是**编译时反射，它就是宏**.

## 1. 什么是宏

​		一般说来，宏是一种**规则或模式，或称语法替换** ，用于**说明某一特定输入（通常是字符串）如何根据预定义的规则转换成对应的输出（通常是字符串,或者是类,方法等)**。这种替换在预编译时进行，称作宏展开。

​		通过上面的定义,感觉和C的宏概念差不多.但C的宏只不过是一段语法的替换，然而Scala的宏**却可以通过表达式树控制一节代码(类,或者方法)的生成**。获得了控制代码的执行顺序（见惰性计算和非限制函数）的能力，使得新创建的语法结构与语言内建的语法结构不可区分。

​		宏,从程序抽象的角度来看,可能不太容易调试和维护,但是能够很强大的固定我们的设计. 同时使用宏能够==大量==的减少样板代码.比如**Scala的`assert`和`require`**就是使用宏实现的.

## 2. 宏出现的意义

- 编译期元编程
- 更完善的错误检查

### 1. 编译期元编程

什么是元编程?

百度词条的一句话:

> 元编程（Metaprogramming）是指某类计算机程序的编写，**这类计算机程序编写或者操纵其他程序（或者自身）作为它们的数据**，或者**在运行时完成部分本应在编译时完成的工作**。
>
> 很多情况下与手工编写全部代码相比工作效率更高。**编写元程序的语言称之为元语言，被操作的语言称之为目标语言**。
>
> 一门语言同时也是自身的元语言的能力称之为**反射**。

​		元编程是用来产生代码的程序，操纵代码的程序，在运行时创建和修改代码而非编程时，这种程序叫做元程序。而编写这种程序就叫做元编程。

​		所以,元编程技术在多种编程语言中都可以使用，但更多的还是被应用于**动态语**言中，因为动态语言提供了更多的在运行时将代码视为数据进行操纵的能力。
​		虽然静态语言也支持元编程(反射机制)，但是仍然没有诸如Ruby这样的更趋动态性的语言那么透明，这是因为静态语言在运行时其代码和数据是分布在两个层次上的。

> 最后可以理解为,元编程就是程序可以操作更小的粒度和动作.

### 2. 更完善的错误检查

引自知乎https://www.zhihu.com/question/27685977/answer/38014170

首先思考一个问题：如果你的应用程序有bug，那么你希望在什么情况下发现呢？

- **编译时**：这是最理想的状态，如果一个bug可以通过编译器检查出来，那么程序员可以在第一时间发现问题，基本上就是一边写一边fix。这也正是静态编译型语言的强大优势。
- **单元测试**：没有那么理想但是也不差。每写完一段code跑一下测试，看看有没有新的bug出来。对于scala来说，现在的工具链已经不错了，左屏sbt > ~test，右屏写代码惬意得很。
- **运行时**：这个就比较糟糕了。运行时才报错意味着你得首先打包部署，这个时间开销通常就比较大，而且在许多公司,你还要时不时的解决环境问题,很是让人抓狂。

而Scala的宏,就是可以将一些运行期才会出现的错误,在编译器暴露出来.

## 3. 编译时反射

上篇文章已经介绍过, 编译器反射也就是在Scala的表现形式, 就是我们本篇的重点 宏(`Macros`).

### `Macros` 能做什么呢?

直白一点, 宏能够

> Code that generates code

还记得上篇文章中, 我们提到的AST(abstract syntax tree, 抽象语法树)吗? `Macros` 可以利用 `compiler plugin` 在 `compile-time` 操作 `AST`, 从而实现一些为所以为的...任性操作

所以, 可以理解宏就是**一段在编译期运行的代码**, 如果我们可以合理的利用这点, 就可以将一些代码提前执行, 这意味着什么, 更早的(`compile-time`)发现错误, 从而避免了 `run-time`错误. 还有一个不大不小的好处, 就是可以减少方法调用的堆栈开销.

是不是很吸引人, 好, 开始Macros的盛宴.

## 4. 黑盒宏和白盒宏

黑盒和白盒的概念, 就不做过多介绍了. 而Scala既然引用了这两个单词来描述宏, 那么两者区别也就显而易见了. 当然, 这两个是新概念, 在2.10之前, 只有一种宏, 也就是白盒宏的前身.

> 官网描述如下:
> Macros that faithfully follow their type signatures are called blackbox macros as their implementations are irrelevant to understanding their behaviour (could be treated as black boxes).
> Macros that can't have precise signatures in Scala's type system are called whitebox macros (whitebox def macros do have signatures, but these signatures are only approximations).

我怕每个人的理解不一样, 所以先贴出了官网的描述, 而我的理解呢, 就是我们指定好返回类型的`Macros`就是黑盒宏, 而我们虽然指定返回值类型, 甚至是以`c.tree`定义返回值类型, 而更加细致的具体类型, 即真正的返回类型可以在宏中实现的, 我们称为白盒宏.

可能还是有点绕哈, 我举个例子吧. 在此之前, 先把二者的位置说一下:

2.10

- scala.reflect.macros.Context

2.11 +

- scala.reflect.macros.blackbox.Context
- scala.reflect.macros.whitebox.Context

#### 黑盒例子

```SCALA
import scala.reflect.macros.blackbox

object Macros {
    def hello: Unit = macro helloImpl

    def helloImpl(c: blackbox.Context): c.Expr[Unit] = {
        import c.universe._
        c.Expr {
              Apply(
                    Ident(TermName("println")),
                    List(Literal(Constant("hello!")))
              )
        }
    }
}
```

但是要注意, 黑盒宏的使用, 会有四点限制, 主要方面是

- 类型检查
- 类型推到
- 隐式推到
- 模式匹配

这里我不细说了, 有兴趣可以看看官网: https://docs.scala-lang.org/overviews/macros/blackbox-whitebox.html

#### 白盒例子

```
import scala.reflect.macros.blackbox

object Macros {
    def hello: Unit = macro helloImpl

    def helloImpl(c: blackbox.Context): c.Tree = {
      import c.universe._
      c.Expr(q"""println("hello!")""")
    }
}
```

------

> Using macros is easy, developing macros is hard.

了解了`Macros`的两种规范之后, 我们再来看看它的两种用法, 一种和C的风格很像, 只是在编译期将宏展开, 减少了方法调用消耗. 还有一种用法, 我想大家更熟悉, 就是注解, 将一个宏注解标记在一个类, 方法, 或者成员上, 就可以将所见的代码, 通过AST变成everything, 不过, 请不要变的太离谱.

## 5. Def Macros

方法宏, 其实之前的代码中, 已经见识过了, 没什么稀奇, 但刚才的例子还是比较简单的, 如果我们要传递一个参数, 或者泛型呢?

看下面例子:

```SCALA
object Macros {
    def hello2[T](s: String): Unit = macro hello2Impl[T]

    def hello2Impl[T](c: blackbox.Context)(s: c.Expr[String])(ttag: c.WeakTypeTag[T]): c.Expr[Unit] = {
        import c.universe._
        c.Expr {
            Apply(
                Ident(TermName("println")),
                List(
                    Apply(
                        Select(
                            Apply(
                                Select(
                                    Literal(Constant("hello ")),
                                    TermName("$plus")
                                ),
                                List(
                                    s.tree
                                )
                            ),
                            TermName("$plus")
                        ),
                        List(
                            Literal(Constant("!"))
                        )
                    )
                )
            )
        }
    }
}
```

和之前的不同之处, 暴露的方法hello2主要在于多了参数`s`和泛型`T`, 而`hello2Impl`实现也多了两个括号

- (s: c.Expr[String])
- (ttag: c.WeakTypeTag[T])

我们来一一讲解

### c.Expr

这是`Macros`的表达式包装器, 里面放置着类型`String`, 为什么不能直接传`String`呢?
当然是不可以了, 因为宏的入参只接受Expr, 调用宏传入的参数也会默认转为Expr.

> 这里要注意, 这个`(s: c.Expr[String])`的入参名必须等于`hello2[T](s: String)`的入参名

### WeakTypeTag[T]

记得上一期已经说过的`TypeTag` 和 `ClassTag`.

```
scala> val ru = scala.reflect.runtime.universe
ru @ 6d657803: scala.reflect.api.JavaUniverse = scala.reflect.runtime.JavaUniverse@6d657803

scala> def foo[T: ru.TypeTag] = implicitly[ru.TypeTag[T]]
foo: [T](implicit evidence$1: reflect.runtime.universe.TypeTag[T])reflect.runtime.universe.TypeTag[T]

scala> foo[Int]
res0 @ 7eeb8007: reflect.runtime.universe.TypeTag[Int] = TypeTag[Int]

scala> foo[List[Int]]
res1 @ 7d53ccbe: reflect.runtime.universe.TypeTag[List[Int]] = TypeTag[scala.List[Int]]
```

这都没有问题, 但是如果我传递一个泛型呢, 比如这样:

```
scala> def bar[T] = foo[T] // T is not a concrete type here, hence the error
<console>:26: error: No TypeTag available for T
       def bar[T] = foo[T]
                       ^
```

没错, 对于不具体的类型(泛型), 就会报错了, 必须让T有一个边界才可以调用, 比如这样:

```
scala> def bar[T: TypeTag] = foo[T] // to the contrast T is concrete here
                                    // because it's bound by a concrete tag bound
bar: [T](implicit evidence$1: reflect.runtime.universe.TypeTag[T])reflect.runtime.universe.TypeTag[T]
```

但, 有时我们无法为泛型提供边界, 比如在本章的`Def Macros`中, 这怎么办? 没关系, 杨总说过:

> 任何计算机问题都可以通过加一层中间件解决.

所以, Scala引入了一个新的概念 => `WeakTypeTag[T]`, 放在`TypeTag`之上, 之后可以

```
scala> def foo2[T] = weakTypeTag[T]
foo2: [T]=> reflect.runtime.universe.WeakTypeTag[T]
```

无须边界, 照样使用, 而`TypeTag`就不行了.

```
scala> def foo[T] = typeTag[T]
<console>:15: error: No TypeTag available for T
       def foo[T] = typeTag[T]
```

有兴趣请看
https://docs.scala-lang.org/overviews/reflection/typetags-manifests.html

### Apply

在前面的例子中, 我们多次看到了`Apply()`, 这是做什么的呢?
我们可以理解为这是一个AST构建函数, 比较好奇的我看了下源码, 搜打死乃.

```
class ApplyExtractor{
    def apply(fun: Tree, args: List[Tree]): Apply = {
        ???
    }
}
```

看着眼熟不? 没错, 和`Scala` 的`List[+A]`的构建函数类似, 一个延迟创建函数. 好了, 先理解到这.

### Ident

定义, 可以理解为Scala标识符的构建函数.

### Literal(Constant("hello "))

文字, 字符串构建函数

### Select

选择构建函数, 选择的什么呢? 答案是一切, 不论是选择方法, 还是选择类. 我们可以理解为`.`这个调用符. 举个例子吧:

```scala
scala> showRaw(q"scala.Some.apply")
res2: String = Select(Select(Ident(TermName("scala")), TermName("Some")), TermName("apply"))
```

还有上面的例子:
`"hello ".$plus(s.tree)`

```scala
Apply(
    Select(
        Literal(Constant("hello ")),
        TermName("$plus")
    ),
    List(
        s.tree
    )
)
```

源码如下:

```SCALA
class SelectExtractor {
    def apply(qualifier: Tree, name: Name): Select = {
        ???
    }
}
```

### TermName("$plus")

理解`TermName`之前, 我们先了解一下什么是`Names`, `Names`在官网解释是:

> Names are simple wrappers for strings.

只是一个简单的字符串包装器, 也就是把字符串包装起来, `Names`有两个子类, 分别是`TermName` 和 `TypeName`, 将一个字符串用两个子类包装起来, 就可以使用`Select` 在tree中进行查找, 或者组装新的tree.

[官网地址](https://docs.scala-lang.org/overviews/reflection/annotations-names-scopes.html)

## 宏插值器

刚刚就为了实现一个如此简单的功能, 就写了那么巨长的代码, 如果如此的话, 即便`Macros` 功能强大, 也不易推广`Macros`. 因此Scala又引入了一个新工具 => `Quasiquotes`

`Quasiquotes` 大大的简化了宏编写的难度, 并极大的提升了效率, 因为它让你感觉写宏就像写scala代码一样.

同样上面的功能, `Quasiquotes`实现如下:

```
object Macros {
    def hello2[T](s: String): Unit = macro hello2Impl[T]

    def hello2Impl[T](c: blackbox.Context)(s: c.Expr[String])(ttag: c.WeakTypeTag[T]): c.Expr[Unit] = {
        import c.universe._
        val tree = q"""println("hello " + ${s.tree} + "!")"""
        
        c.Expr(tree)
    }
}
```

`q""" ??? """` 就和 `s""" ??? """`, `r""" ??? """` 一样, 可以使用`$`引用外部属性, 方便进行逻辑处理.

## Macros ANNOTATIONS

宏注释, 就和我们在Java一样, 下面是我写的一个例子:
对于以`class`修饰的类, 我们也像`case class`修饰的类一样, 完善`toString()`方法.

```scala
package com.pharbers.macros.common.connecting

import scala.reflect.macros.whitebox
import scala.language.experimental.macros
import scala.annotation.{StaticAnnotation, compileTimeOnly}

@compileTimeOnly("enable macro paradis to expand macro annotations")
final class ToStringMacro extends StaticAnnotation {
    def macroTransform(annottees: Any*): Any = macro ToStringMacro.impl
}

object ToStringMacro {
    def impl(c: whitebox.Context)(annottees: c.Expr[Any]*): c.Expr[Any] = {
        import c.universe._

        val class_tree = annottees.map(_.tree).toList match {
            case q"$mods class $tpname[..$tparams] $ctorMods(...$paramss) extends ..$parents { $self => ..$stats }" :: Nil =>

                val params = paramss.flatMap { params =>
                    val q"..$trees" = q"..$params"
                    trees
                }
                val fields = stats.flatMap { params =>
                    val q"..$trees" = q"..$params"
                    trees.map {
                        case q"$mods def toString(): $tpt = $expr" => q""
                        case x => x
                    }.filter(_ != EmptyTree)
                }
                val total_fields = params ++ fields

                val toStringDefList = total_fields.map {
    case q"$mods val $tname: $tpt = $expr" => q"""${tname.toString} + " = " + $tname"""
    case q"$mods var $tname: $tpt = $expr" => q"""${tname.toString} + " = " + $tname"""
                    case _ => q""
                }.filter(_ != EmptyTree)
                val toStringBody = if(toStringDefList.isEmpty) q""" "" """ else toStringDefList.reduce { (a, b) => q"""$a + ", " + $b""" }
                val toStringDef = q"""override def toString(): String = ${tpname.toString()} + "(" + $toStringBody + ")""""

                q"""
                    $mods class $tpname[..$tparams] $ctorMods(...$paramss) extends ..$parents { $self => ..$stats
                        $toStringDef
                    }
                """

            case _ => c.abort(c.enclosingPosition, "Annotation @One2OneConn can be used only with class")
        }

        c.Expr[Any](class_tree)
    }
}
```

### compileTimeOnly

非强制的, 但建议加上. 官网解释如下:

> It is not mandatory, but is recommended to avoid confusion. Macro annotations look like normal annotations to the vanilla Scala compiler, so if you forget to enable the macro paradise plugin in your build, your annotations will silently fail to expand. The @compileTimeOnly annotation makes sure that no reference to the underlying definition is present in the program code after typer, so it will prevent the aforementioned situation from happening.

### StaticAnnotation

继承自`StaticAnnotation`的类, 将被Scala解释器标记为注解类, 以注解的方式使用, 所以不建议直接生成实例, 加上`final`修饰符.

### macroTransform

```scala
def macroTransform(annottees: Any*): Any = macro ToStringMacro.impl
```

对于使用`@ToStringMacro`修饰的代码, 编译器会自动调用`macroTransform`方法, 该方法的入参, 是`annottees: Any*`, 返回值是`Any`, 主要是因为`Scala`缺少更细致的描述, 所以使用这种笼统的方式描述可以接受一切类型参数.
而方法的实现, 和`Def Macro`一样.

### impl

```scala
def impl(c: whitebox.Context)(annottees: c.Expr[Any]*): c.Expr[Any] = {
    import c.universe._
    ???
}
```

到了`Macros`的具体实现了. 这里其实和`Def Macro`也差不多. 但对于需要传递参数的宏注解, 需要按照下面的写法:

```scala
final class One2OneConn[C](param_name: String) extends StaticAnnotation {
    def macroTransform(annottees: Any*): Any = macro One2OneConn.impl
}

object One2OneConn {
    def impl(c: whitebox.Context)(annottees: c.Expr[Any]*): c.Expr[Any] = {
        import c.universe._
        
        // 匹配当前注解, 获得参数信息
        val (conn_type, conn_name) = c.prefix.tree match {
            case q"new One2OneConn[$conn_type]($conn_name)" =>
                (conn_type.toString, conn_name.toString.replace("\"", ""))
            case _ => c.abort(c.enclosingPosition, "Annotation @One2OneConn must provide conn_type and conn_name !")
        }
        
        ???
    }
}
```

有几点需要注意的地方:

1. 宏注解只能操作当前自身注解, 和定义在当前注解之下的注解, 对于之前的注解, 因为已经展开, 所以已经不能操作了.
2. 如果宏注解生成多个结果, 例如既要展开注解标识的类, 还要直接生成类实例, 则返回结果需要以块(Block)包起来.
3. 宏注释必须使用白盒宏.
4. 

## Macro Paradise

Scala 推出了一款插件, 叫做Macro Paradise(宏天堂), 可以帮助开发者控制带有宏的Scala代码编译顺序, 同时还提供调试功能, 这里不做过多介绍, 有兴趣的可以查看官网: [Macro Paradise](https://docs.scala-lang.org/overviews/macros/paradise.html)

 

## 宏的编译过程?

Scala是如何编译宏的呢?

引用自https://www.cnblogs.com/tiger-xc/p/6112143.html
![image](https://yqfile.alicdn.com/img_bd8e14bdd3b04573bfeeaaa0460d19d7.jpeg)

明白了上面的流程之后,我们出个栗子:

```
object modules {
    greeting("john")
}
 
object mmacros {
   def greeting(person: String): Unit = macro greetingMacro
   def greetingMacro(c: Context)(person: c.Expr[String]): c.Expr[Unit] = {
        import c.universe._
        println("compiling greeting ...")
        val now = reify {new Date().toString}
        reify {
            println("Hello " + person.splice + ", the time is: " + new Date().toString)
        }
   }
}
```

以上代码的执行逻辑如下:
![image](https://yqfile.alicdn.com/img_02a7fe65e73f379e510ed94898e2149f.jpeg)

> 注意编译器在运算greetingMacro时会以AST方式将参数person传入。由于在编译modules对象时需要运算greetingMacro函数，所以greetingMacro函数乃至整个mmacros对象必须是已编译状态，这就意味着modules和mmacros必须分别在不同的源代码文件里，而且还要确保在编译modules前先完成对mmacros的编译.

## 编写宏实现

其实宏的使编写并不难,api已经帮我们做好了一切,我们只要关注如何使用获取宏参数和宏的返回值即可.
上面栗子中的代码,`greetingMacro`方法就是一个最简单的宏实现,代码如下:

```
def greetingMacro(c: Context)(person: c.Expr[String]): c.Expr[Unit] = {
    import c.universe._
    println("compiling greeting ...")
    val now = reify {new Date().toString}
    reify {
        println("Hello " + person.splice + ", the time is: " + new Date().toString)
    }
}
```

但是想要实现更多的功能,还需要更加深入的学习Scala的宏和表达式树.

# 宏语法糖

## １.implicit macor (隐式宏)

[官方文档](https://docs.scala-lang.org/overviews/macros/implicits.html)

开局出个栗子

```
trait Showable[T] { 
    def show(x: T): String 
}
def show[T](x: T)(implicit s: Showable[T]) = s.show(x)

implicit object IntShowable extends Showable[Int] {
  def show(x: Int) = x.toString
}

show(42) // return "42"
show("42") // compilation error
```

可以调用成功`show()`,主要因为名称空间存在`Showable`的子类`IntShowable`,并且是`implicit object`,这个`implicit object`的作用上一篇已经讲过了,就不说了.

上面代码,乍一看还可以,但是如果扩展起来就不是很舒服了,如果要让`show("42")`也可用,我们就需要添加如下代码:

```
implicit object StringShowable extends Showable[String] {
  def show(x: String) = x
}
```

## ２.宏注解 Macro Annotations ==> @compileTimeOnly("")

[官方文档](https://docs.scala-lang.org/overviews/macros/annotations.html)

开局处个栗子,可以自动为`case class`或`class`在编译时生成一个名为`TempLog`的方法.

```
import scala.reflect.macros.Context
import scala.language.experimental.macros
import scala.annotation.StaticAnnotation
import scala.annotation.compileTimeOnly

@compileTimeOnly("temp log print")
class AnPrint(msg: Any*) extends StaticAnnotation {
    def macroTransform(annottees : Any*) : Any = macro AnPrintMacroImpl.impl
}
```

官网栗子,我们的代码也比较常见,继承了`StaticAnnotation`,表示这是一个注解类,有兴趣的朋友可以看看上一期文章.

主要说的是上面

```
@compileTimeOnly("temp log print")
```

官网解释

> First of all, note the @compileTimeOnly annotation. It is not mandatory, but is recommended to avoid confusion

首先,这不是强制性的,即便不写,也会被编译器自动扩展上.但还是建议加上避免混乱.

然后是宏的具体实现,如下:

```
object AnPrintMacroImpl {
    def impl(c : whitebox.Context)(annottees: c.Expr[Any]*): c.Expr[Any] = {
        import c.universe._
        val tree = annottees.map(_.tree).toList.head
        val (className, fields, parents, body) = tree match{
            case q"case class $className(..$fields) extends ..$parents { ..$body }" => (className, fields, parents, body)
            case q"class $className(..$fields) extends ..$parents { ..$body }" => (className, fields, parents, body)
        }

        //TempLog
        val LogDefName = TermName("TempLog")
        val LogDefImpl = q"""def $LogDefName(sss: Any):Unit=println(" ===>   " + sss)"""

        val out = q"""
            case class $className(..$fields) extends ..$parents {
            ..$LogDefImpl
            ..$body
            }
        """

        println(showRaw(tree))

        c.Expr(out)
    }
}
```

里面的具体细节,主要是宏将类变成AST,然后利用模式匹配,来解析类信息,之后可以加入自己定义的任何操作,最后用Block封装起来,这样子,一个简单的宏就实现了.

我们测试一下:

```
package myTest

@AnPrint("clock")
class ccc(val a: String = "aaa", val b: String = "bbb"){
    TempLog("init b")
}

object annotationPrintTest extends App {
    println("start")
    val a = new b("aiyou", "wolegequ")
    a.TempLog("打印我了")
    println("end")
}
```

> 注意,这里需要先编译`AnPrintMacroImpl`和`AnPrint`文件,才可以测试通过

打印结果如下:

```
start
===> init b
===> 打印我了
end
```

