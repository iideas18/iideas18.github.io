---
title: "Scala方法和函数的本质区别——反编译解析"
date: 2019-11-14 23:43:36
slug: "scala decompiler 3"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# Scala方法和函数的本质区别——反编译解析

2019-04-15 23:32:43 更多

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/alionsss/article/details/89323520

### 文章目录

- [Scala方法和函数的本质区别——反编译解析](https://blog.csdn.net/alionsss/article/details/89323520#Scala_2)

- - [1. 方法-解析](https://blog.csdn.net/alionsss/article/details/89323520#1__3)

  - - [1.1 普通方法](https://blog.csdn.net/alionsss/article/details/89323520#11__4)
    - [1.2 嵌套方法](https://blog.csdn.net/alionsss/article/details/89323520#12__63)

  - [2. 函数-解析](https://blog.csdn.net/alionsss/article/details/89323520#2__117)

  - - [2.1 函数示例](https://blog.csdn.net/alionsss/article/details/89323520#21__118)
    - [2.2 反编译结果](https://blog.csdn.net/alionsss/article/details/89323520#22__130)
    - [2.3 函数反编译解析](https://blog.csdn.net/alionsss/article/details/89323520#23__178)

  - [3. 为什么方法和函数可以相互转换？](https://blog.csdn.net/alionsss/article/details/89323520#3__187)

  - - [3.1 方法和函数混用示例](https://blog.csdn.net/alionsss/article/details/89323520#31__188)
    - [3.2 方法与函数转换-解析](https://blog.csdn.net/alionsss/article/details/89323520#32__211)
    - [3.3 混用示例-解析](https://blog.csdn.net/alionsss/article/details/89323520#33__274)

## 1. 方法-解析

### 1.1 普通方法

1. 普通方法，即平常在class、object中定义的方法，示例如下

```scala
 object Demo01 {
 
  def sum1(a:Int, b: Int) : Int = a + b
  
  def main(args: Array[String]): Unit = {
    println(sum1(1, 2))
  } 
}
```

1. object中定义的方法和class中定义的方法稍有不同的是：object中的方法会多生成一个静态的方法
2. 让我来看看上面代码的反编译结果：

- Demo01.class

```scala
import scala.reflect.ScalaSignature;
	
@ScalaSignature(bytes="\006\001U:Q!\001\002\t\002-\ta\001R3n_B\n$BA\002\005\003\tigM\003\002\006\r\005!A/Z:u\025\t9\001\"\001\003tW\026L(\"A\005\002\007\r|Wn\001\001\021\0051iQ\"\001\002\007\0139\021\001\022A\b\003\r\021+Wn\034\0312'\ti\001\003\005\002\022)5\t!CC\001\024\003\025\0318-\0317b\023\t)\"C\001\004B]f\024VM\032\005\006/5!\t\001G\001\007y%t\027\016\036 \025\003-AQAG\007\005\002m\tAa];ncQ\031AdH\021\021\005Ei\022B\001\020\023\005\rIe\016\036\005\006Ae\001\r\001H\001\002C\")!%\007a\0019\005\t!\rC\003%\033\021\005Q%\001\003nC&tGC\001\024*!\t\tr%\003\002)%\t!QK\\5u\021\025Q3\0051\001,\003\021\t'oZ:\021\007Eac&\003\002.%\t)\021I\035:bsB\021qF\r\b\003#AJ!!\r\n\002\rA\023X\rZ3g\023\t\031DG\001\004TiJLgn\032\006\003cI\001")
public final class Demo01 {
  public static void main(String[] paramArrayOfString) {
    Demo01..MODULE$.main(paramArrayOfString);
  }
  
  public static int sum1(int paramInt1, int paramInt2) {
    return Demo01..MODULE$.sum1(paramInt1, paramInt2);
  }
}
```

- Demo01$.class

```scala
import scala.Predef.;
import scala.runtime.BoxesRunTime;

public final class Demo01$ {
    
    public static final  MODULE$;

    static {
        new ();
    }

    public int sum1(int a, int b) {
        return a + b;
    }

    public void main(String[] args) {
        Predef..MODULE$.println(BoxesRunTime.boxToInteger(sum1(1, 2)));
    }

    private Demo01$() {
        MODULE$ = this;
    }
}
```

1. Demo01.class是JVM真正调用的入口，由它再调用Demo01$中的main。同时负责维护静态方法，经由此处的静态方法sum1调用Demo01$中实际的方法sum1
2. Demo01$.class负责维护实际使用的值、方法
3. 可以看出Scala中的普通方法和Java中的方法区别不大，仅在object的静态编译处有细微区别

### 1.2 嵌套方法

1. 嵌套方法，即定义在方法中的方法，示例如下

```scala
object Demo01 {
	
  def main(args: Array[String]): Unit = {
    def sum2(a:Int, b: Int) : Int = a + b

    println(sum2(3, 4))
  }	
}
```

1. 嵌套方法也是方法，只是使用起来和普通方法的作用域不同，那么他们为什么会有不同的作用域呢？在本质上又有什么区别呢？
2. 让我来看看上面代码的反编译结果：

- Demo01.class

```scala
import scala.reflect.ScalaSignature;

@ScalaSignature(bytes="\006\001-:Q!\001\002\t\002-\ta\001R3n_B\n$BA\002\005\003\tigM\003\002\006\r\005!A/Z:u\025\t9\001\"\001\003tW\026L(\"A\005\002\007\r|Wn\001\001\021\0051iQ\"\001\002\007\0139\021\001\022A\b\003\r\021+Wn\034\0312'\ti\001\003\005\002\022)5\t!CC\001\024\003\025\0318-\0317b\023\t)\"C\001\004B]f\024VM\032\005\006/5!\t\001G\001\007y%t\027\016\036 \025\003-AQAG\007\005\002m\tA!\\1j]R\021Ad\b\t\003#uI!A\b\n\003\tUs\027\016\036\005\006Ae\001\r!I\001\005CJ<7\017E\002\022E\021J!a\t\n\003\013\005\023(/Y=\021\005\025BcBA\t'\023\t9##\001\004Qe\026$WMZ\005\003S)\022aa\025;sS:<'BA\024\023\001")
public final class Demo01 {
  public static void main(String[] paramArrayOfString) {
    Demo01..MODULE$.main(paramArrayOfString);
  }
}
```

- Demo01$.class

```scala
import scala.Predef.;
import scala.runtime.BoxesRunTime;

public final class Demo01$ {
  public static final  MODULE$;
  
  private final int sum2$1(int a, int b) {
    return a + b;
  }
  
  public void main(String[] args) {
    Predef..MODULE$.println(BoxesRunTime.boxToInteger(sum2$1(3, 4)));
  }
  
  private Demo01$() {
    MODULE$ = this;
  }
  
  static {
    new ();
  }
}
```

1. Demo01.class是JVM真正调用的入口，由它再调用Demo01$中的main。其中不存在sum2的静态方法
2. Demo01$.class负责维护实际使用的值、方法。其中存在sum2的方法，同时被更名为sum2$1
3. 由此看来，嵌套方法其实利用了更名的方式，保证不与同名的普通方法冲突，在外部调用sum2其实调用的是class、object中的普通方法sum2，无法调用sum2$1，从而做到了限制作用域。实际上，从Java的角度上来看，嵌套方法还是一个普通方法。

## 2. 函数-解析

### 2.1 函数示例

```scala
object Demo01 {

  def main(args: Array[String]): Unit = {
    val max = (a: Int, b:Int) => if (a > b) a else b

    println(max(5, 6))
  }

}
```

### 2.2 反编译结果

- Demo01.class

```scala
import scala.reflect.ScalaSignature;

@ScalaSignature(bytes="\006\001-:Q!\001\002\t\002-\ta\001R3n_B\n$BA\002\005\003\tigM\003\002\006\r\005!A/Z:u\025\t9\001\"\001\003tW\026L(\"A\005\002\007\r|Wn\001\001\021\0051iQ\"\001\002\007\0139\021\001\022A\b\003\r\021+Wn\034\0312'\ti\001\003\005\002\022)5\t!CC\001\024\003\025\0318-\0317b\023\t)\"C\001\004B]f\024VM\032\005\006/5!\t\001G\001\007y%t\027\016\036 \025\003-AQAG\007\005\002m\tA!\\1j]R\021Ad\b\t\003#uI!A\b\n\003\tUs\027\016\036\005\006Ae\001\r!I\001\005CJ<7\017E\002\022E\021J!a\t\n\003\013\005\023(/Y=\021\005\025BcBA\t'\023\t9##\001\004Qe\026$WMZ\005\003S)\022aa\025;sS:<'BA\024\023\001")
public final class Demo01 {
  public static void main(String[] paramArrayOfString) {
    Demo01..MODULE$.main(paramArrayOfString);
  }
}
```

- Demo01$.class

```scala
import scala.Function2;
import scala.Predef.;
import scala.Serializable;
import scala.runtime.AbstractFunction2.mcIII.sp;
import scala.runtime.BoxesRunTime;

public final class Demo01$ {
  public static final  MODULE$;
  
  static {
    new ();
  }
  
  public void main(String[] args) {
    Function2 max = new AbstractFunction2.mcIII.sp() {
      public static final long serialVersionUID = 0L;
      
      public int apply$mcIII$sp(int a, int b) {
        return a > b ? a : b;
      }
      
      public final int apply(int a, int b) {
        return apply$mcIII$sp(a, b);
      }
    };
    Predef..MODULE$.println(BoxesRunTime.boxToInteger(max.apply$mcIII$sp(5, 6)));
  }
  
  private Demo01$() {
    MODULE$ = this;
  }
}
```

### 2.3 函数反编译解析

1. Demo01.class，这个没什么好说的，和之前一样
2. Demo01$.class中多出来一个类型为scala.Function2的max变量，其实它就是我们的函数。
3. 查看scala源码可知scala.Function2是一个trait，同时对应的new AbstractFunction2是一个abstract class，这个class扩展了Function2。而函数对应的具体的功能其实是这个class AbstractFunction2对trait Function2的方法apply的具体实现。
4. 到这里，其实可以明白了，scala中的函数其实就是定义的一个trait，并且拥有一个对应的抽象实现类来实现具体的函数功能
5. 扩展：
   - scala中的元组其实也是对应的类，类名为Tuple，最多拥有22个参数，即Tuple22。这里示例中max函数对应的的Function2其实指的就是可以传2个参数，同时源码中定义了可以传22个参数的函数，叫Function22
   - 如果比较熟悉Java8的话，我们可以看看lambda表达式，通常情况下这个lambda表达式也是传一个接口的匿名实现类，例如new Thread(() -> System.out.println(“Hello World!”)).start();。同时，Java8中定义了Function、Consumer、Supplier、Predicate几大接口用于Stream处理，正是和Scala函数相对应。
   - Scala中的trait经过反编译后，其实就是接口+抽象类。接口对应Java中的接口，抽象类用于实现trait自带的方法、变量等

## 3. 为什么方法和函数可以相互转换？

### 3.1 方法和函数混用示例

```scala
object Demo01 {

  def main(args: Array[String]): Unit = {
    // 一些单词
    val words= List("java", "scala", "python", "rust", "go", "c", "c++")
    
    // 定义转换字母大写的函数
    val toUpperFunc = (word: String) => word.toUpperCase()
    // 定义转换字母大写的方法
    def toUpperMethod(word: String): String = word.toUpperCase()
    
    // 方法和函数混用
    // map方法在源码中明确标注，需要的参数的类型是函数A => B
    words.map(toUpperFunc).foreach(println)
    words.map(toUpperMethod).foreach(println)
    // 结果一样
  }
}
```

看完上面的示例可能让人有点困惑。毕竟我们前面已经说了，方法和函数在本质上是两个不同的东西，那么方法为什么可以传进入参类型为函数的方法中呢？

### 3.2 方法与函数转换-解析

1. 不急，让我们先看下面一个简单的示例（将方法转换为函数）

```scala
object Demo01 {
  
  def sum2(a:Int, b: Int) : Int = a + b

  def main(args: Array[String]): Unit = {
    val func1: (Int, Int) => Int = sum2 _
    println(func1(9, 10))
    
// 你还可以写成如下形式
//    val func2: (Int, Int) => Int = sum2
//    println(func2(9, 10))
//
//    val func3 = sum2 _
//    println(func3(9, 10))
  }
}
```

1. 让我来看看上面代码的反编译结果：

- Demo01.class（省略）
- Demo01$.class

```scala
import scala.Function2;
import scala.Predef.;
import scala.Serializable;
import scala.runtime.AbstractFunction2.mcIII.sp;
import scala.runtime.BoxesRunTime;

public final class Demo01$ {
  public static final  MODULE$;
  
  static {
    new ();
  }
  
  public int sum2(int a, int b) {
    return a + b;
  }
  
  public void main(String[] args) {
    Function2 func1 = new AbstractFunction2.mcIII.sp() {
      public static final long serialVersionUID = 0L;
      
      public int apply$mcIII$sp(int a, int b) {
        return Demo01..MODULE$.sum2(a, b);
      }
      
      public final int apply(int a, int b) {
        return apply$mcIII$sp(a, b);
      }
    };
    Predef..MODULE$.println(BoxesRunTime.boxToInteger(func1.apply$mcIII$sp(9, 10)));
  }
  
  private Demo01$() {
    MODULE$ = this;
  }
}
```

1. 函数的生成还是和前面的说明一样，实例化了一个实现了Function2的apply方法的抽象类AbstractFunction2对象。不过，注意，这里有一个微妙的区别，apply调用了apply$mcIII$sp方法，而apply$mcIII$sp方法又调用了sum2方法！！！没错，将方法转换为函数，其实函数并没有在内部重新实现该功能，而是直接调用了sum2方法！

### 3.3 混用示例-解析

1. 现在准备好了，请看前面“单词转大写”的混用示例的反编译结果：

- Demo01.class（省略）
- Demo01$.class

```scala
import scala.Function1;
import scala.Predef.;
import scala.Serializable;
import scala.collection.immutable.List;
import scala.collection.immutable.List.;
import scala.runtime.AbstractFunction1;
import scala.runtime.BoxedUnit;

public final class Demo01$ {
  public static final  MODULE$;
  
  public final String com$skey$test$mf$Demo01$$toUpperMethod$1(String word) {
    return word.toUpperCase();
  }
  
  public void main(String[] args) {
    List words = List..MODULE$.apply(Predef..MODULE$.wrapRefArray((Object[])new String[] { "java", "scala", "python", "rust", "go", "c", "c++" }));
    
    Function1 toUpperFunc = new AbstractFunction1() {
      public static final long serialVersionUID = 0L;
      
      public final String apply(String word) {
        return word.toUpperCase();
      }
    };
    ((List)words.map(toUpperFunc, List..MODULE$.canBuildFrom())).foreach(new AbstractFunction1() {
      public static final long serialVersionUID = 0L;
      
      public final void apply(Object x)
      {
        Predef..MODULE$.println(x);
      }
    });
    
    ((List)words.map(new AbstractFunction1()  {
      public static final long serialVersionUID = 0L;
      
      public final String apply(String word) {
        return Demo01..MODULE$.com$skey$test$mf$Demo01$$toUpperMethod$1(word);
      }
    }, List..MODULE$.canBuildFrom())).foreach(new AbstractFunction1() {
      public static final long serialVersionUID = 0L;
      
      public final void apply(Object x) {
        Predef..MODULE$.println(x);
      }
    });
  }
  
  private Demo01$() {
    MODULE$ = this;
  }
  
  static {
    new ();
  }
}
```

1. 首先正常定义的函数部分和我们想象的一样，符合规则，向map中被传入了toUpperFunc函数，最终调用foreach进行了打印
2. 而我们向map中传入toUpperMethod方法的部分，其实是实例化了一个匿名函数（这个函数的apply调用了toUpperMethod方法，即前面的"方法转换为函数"），将这个函数传入了map中，最终调用foreach进行了打印
3. 这下，我们知道了，words数据的map确实只接收类型为A=>B的函数，向map传入方法没产生错误的原因是由于toUpperMethod方法被转换为了函数
4. 总之，方法转换为函数，其实就是新生成一个函数，然后由该函数调用该方法！