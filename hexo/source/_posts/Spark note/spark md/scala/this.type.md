---
title: "scala this.type"
date: 2019-11-22 18:06:12
cover: "http://static.oschina.net/uploads/space/2012/0101/001428_lkeG_103999.png"
slug: "this.type"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# scala this.type

(https://www.jianshu.com/u/b5df6080f221)[Codlife一王家二公子](https://www.jianshu.com/u/b5df6080f221)关注

this.type表示**当前对象（this)的类型**。**this指代当前的对象**。this.type被用于**变量，函数参数和函数返回值的类型声明**

```kotlin
 class A {def method1: A = this }
 class B extends A (def method2: B = this}
 val b = new B
```

然后我查看b.method1的类型：

```scala
scala> b.method1.getClass
res29: Class[_ <: A] = class B
```

**res29: Class[_ <: A] = class B**
的意思是结果参数 res29 的类型是 Class[_ <: A]，值为 class B。 _ <: A 表示任意 A 的子类型。

如果调用b.method2.method1是可以的，但是如果想调用b.method1.method2就不行了。因为method1返回的是A类型的。

```scala
scala> b.method1.method2
<console>:11: error: value method2 is not a member of A
              b.method1.method2
```

当然你可以在B中覆盖method1，以返回正确类型。

但是scala中解决这个问题的办法就是this.type

```kotlin
class A { def method1: this.type = this }
class B extends A { def method2: this.type = this }
val b = new B
```

如果调用b.method1则编译器会知道method1返回的是B类型的。

再查看b.method1的类型：

```scala
scala> b.method1.getClass
res31: Class[_ <: B] = class B
```

这时可以调用b.method1.method2方法：

```scala
scala> b.method1.method2
res32: b.type = B@4ff3ac
```

主要原因就是：

```scala
class A { def method1 = this }
```

中 method1 返回类型为 A，没有写出来但编译器会推断为 A。确认方法是自己在这里填上 : A 看编译器报错不。
所以 b.method1 返回的是 A 类型的对象，A 类型中没有 method2。

而带上 this.type 后：

```scala
class A { def method1: this.type = this }
```

**this.type 是 method1 的返回值，这个返回值很特殊，得在运行期才会真正计算出具体类型**，所以当对象实际类型是 B 的时候，调用 b.method1 返回的还是子类 B 类型，而不是 A 类型。这个就是 this type 的用途，是 scala 为了满足这类需求专门设计的关键字。

spark 源码中大量使用了这种方式，比如spark mllib kmeans

```kotlin
  @Since("0.8.0")
  def setMaxIterations(maxIterations: Int): this.type = {
    require(maxIterations >= 0,
      s"Maximum of iterations must be nonnegative but got ${maxIterations}")
    this.maxIterations = maxIterations
    this
  }

  /**
   * The initialization algorithm. This can be either "random" or "k-means||".
   */
  @Since("1.4.0")
  def getInitializationMode: String = initializationMode

  /**
   * Set the initialization algorithm. This can be either "random" to choose random points as
   * initial cluster centers, or "k-means||" to use a parallel variant of k-means++
   * (Bahmani et al., Scalable K-Means++, VLDB 2012). Default: k-means||.
   */
  @Since("0.8.0")
  def setInitializationMode(initializationMode: String): this.type = {
    KMeans.validateInitMode(initializationMode)
    this.initializationMode = initializationMode
    this
  }
```

代码片段一：   

```scala
trait IC{
    def me : this.type = this
    def entity: IC = this
}

class A extends IC
class B extends IC

val a = new A
:type a.me  // 显示Ａ
:type a.entity　//显示 IC
val b = new B  
:type a.me  // 显示 B
:type a.entity // 显示 IC
```

   代码片段二：   

```scala
trait ActiveRecord {def entity: this.type = this} 

class Person extends ActiveRecord{
    override def entity = new ActiveRecord(){}  //编译错误，只能返回当前对象，即this
}
```

   代码片段三：

![img](http://static.oschina.net/uploads/space/2012/0101/001428_lkeG_103999.png)

   代码片段四:

![img](http://static.oschina.net/uploads/space/2012/0101/003802_0DGl_103999.png)



​    简单解释一下。我们平时这么写 val a = new A ，我们会说a的类型是A。实际上，在编译这行代码时，编译器会自动生成一个类A的匿名子类（我们不妨把它称为A_$) ，然后用这个匿名子类（A_$)实例化（并且只会实例化）一个对象（a)。我们把这个匿名子类称为single class, 因此对象a的真正类型应该是这个A_$的类型，我们把它叫做singe type。    

   那this.type有什么作用呢？ **主要是在某些场合下加强类型约束，或者说是为了确保类型的绝对安全。**  以代码片段二为例，假如ActiveRecord的entity方法返回ActiveRecord类型, 那么实现类可以返回任意ActiveRecord类型的子类型。 因此将类型声明为this.type，可以对链式调用提供安全保障。 但这在Java中是无法做到的，除非把该方法声明为final，防止被子类改写，但这样一来就失去了灵活性。Play! 的ScaleModel类便运用了Scala的这种特性。 

​    另外要说明的是，this.type是路径依赖的。请看下面的例子：

​    ![img](http://static.oschina.net/uploads/space/2012/0101/010645_w5Ux_103999.png)

 ![img](http://static.oschina.net/uploads/space/2012/0101/010943_pK0U_103999.png)

关于路径依赖类型的知识，请看http://my.oschina.net/aiguozhe/blog/35964?catalog=115675

参考资料：

 http://stackoverflow.com/questions/3926047/debunking-scala-myths/4339557#4339557



[1] https://segmentfault.com/q/1010000004155786?_ea=517268

[2] https://my.oschina.net/aiguozhe/blog/38302

[3] https://www.jianshu.com/p/d3c243a884c2

# scala类型系统：this别名&自身类型

https://blog.csdn.net/hellojoy/article/details/81077294

2018-07-17 10:48:52 更多

看scala的源码的话很发现很多源码开头都有一句：`self =>` 这句相当于给`this`起了一个别名为`self`

```scala
class A {     
    self =>  //this别名    
    val x=2     
    def foo = self.x + this.x }
```

`self`不是关键字，可以用除了`this`外的任何名字命名(除关键字)。就上面的代码，在A内部，可以用`this`指代当前对象，也可以用`self`指代，两者是等价的。

它的一个场景是用在有内部类的情况下：

```scala
class Outer { outer =>     
    val v1 = "here"    
    class Inner {        
        println(outer.v1) // 用outer表示外部类，相当于Outer.this    
    }
}
```

对于this别名 `self =>`这种写法形式，是**自身类型(self type)**的一种特殊方式。

`self`在不声明类型的情况下，只是this的别名，所以不允许用this做this的别名

```scala
scala> class C { this => } //error 不能用this做别名
```

但当声明了类型的时候，就不是别名的用途了，这个时候表示**`自身类型`**，比如：

```scala
scala> class C { this:X => }
```

`this:X =>` 要求C在实例化时或定义C的子类时，必须混入指定的`X`类型，这个`X`类型也可以指定为当前类型

```scala
scala> class C { this:C => } // 不会报错
```

自身类型的存在相当于让当前类变得“抽象”了，它假设当前对象(this)也符合指定的类型，因为自身类型 `this:X =>`的存在，当前类构造实例时需要同时满足`X`类型

```pascal
scala> new C // 不满足
<console>:10: error: class C cannot be instantiated because it does not conform to its self-type C with X 
// ok, 相当于构造一个复合类型(C with X)的实例
scala> val c = new C with X
```

在定义C的子类时，因为自身类型的约束，也必须满足`X`类型，即子类必须也混入`X`

```scala
scala> class D extends C with X
```

注意上面两种情况下`X`都为特质(trait)。

如果自身类型是定义在特质中（大多情况下）：

```scala
scala> trait T { this:X => } 
```

那么当某个class或object 要继承或混入 T 时，必须也要满足 X 类型，如果该类/单例不是X的子类的话就要同时混入X才可以

```scala
scala> object A extends T with X
```

最后，自身类型也可以声明为复合类型

```scala
this: X with Y with Z => 
```

或声明为结构类型

```scala
this: { def close:Unit} => 
```

另外，自身类型中，可以用`this`也可以用其他名字，如`self`。