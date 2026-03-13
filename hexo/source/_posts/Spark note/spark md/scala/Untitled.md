---
title: "scala基础之泛型详解"
date: 2019-10-30 19:20:55
slug: "Untitled"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# scala基础之泛型详解

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/zhanglh046/article/details/72845897

在Scala中你可以使用类型参数来实现类和函数，这样的类和函数可以用于多种类型。比如Array[T] 你可以存放任意指定类型T的数据.

类、特质、函数都可以有类型参数；将类型参数放在名字后面用方括号括起来

# 一 泛型类

## 1.1 Java 实现

```java
public class Animals<A,B> {
  private A name;
  private B age;

  public Animals() 				{  }
  public Animals(A name, B age) {
    this.name = name;
    this.age = age;
  }

  public A getName() {
    return name;
  }

  public void setName(A name) {
    this.name = name;
  }

  public B getAge() {
    return age;
  }

  public void setAge(B age) {
    this.age = age;
  }
}

public class MainClient {
    public static void main(String[] args) {
        Animals<String,Integer> animals = new Animals<String,Integer>();
        animals.setName("小花");
        animals.setAge(2);
    }
}
```

## 1.2 Scala实现

```scala
class Animals[A,B](var name:A, var age:B) {
    println(s"Name is $name, Age is $age")
}
 
object GenericClient extends App {
    val cat = new Animals[String,Int]("小花",2)
    val dog = new Animals[String,String]("阿黄","5")
}
```

# 二 泛型函数

## 2.1 Java 实现

```java
public <T> T convertJsonToObject(String jsonData, Class<T> clazz) {
    Gson gson = new Gson();
    T object =  gson.fromJson(jsonData, clazz);
    return object;
}

protected static <T> List<T> asList(T[] pSrc) {
    if (pSrc == null || pSrc.length == 0) {
        return new ArrayList<T>();
    } else {
        return Arrays.asList(pSrc);
    }
}
```

## 2.2Scala实现

```scala
def asList[T](pSrc:Array[T]): List[T] = {
    if (pSrc == null || pSrc.isEmpty) {
        List[T]()
    } else {
        pSrc.toList
    }
}
val friends = Array("小白","琪琪","乐乐")
val friendList = cat.asList(friends)
println(friendList.isInstanceOf[List[String]])
```

# 三 类型变量界定

## 3.1 上边界

有时候我们需要对变量类型进行限制，比如：

```scala
class Pair[T](val first:T, val second:T) {
    def smaller = if (first.compareTo(second))
}
```

我们并不知道类型T到底有没有compareTo方法，所以编译报错。

我们可以添加一个上边界

Java版上边界实现：

```java
public class Pair<T extends Comparable<T>> {
    private T first;
    private T second;
    public void smaller(){
        if (getFirst().compareTo(getSecond()) < 1) {
            System.out.println("first < second");
        } else if (getFirst().compareTo(getSecond()) > 1) {
            System.out.println("first > second");
        } else {
            System.out.println("first = second");
        }
    }

    public T getSecond() {
        return second;
    }

    public void setSecond(T second) {
        this.second = second;
    }

    public T getFirst() {
        return first;
    }

    public void setFirst(T first) {
        this.first = first;
    }
}
Pair<String> p = new Pair<String>();
p.setFirst("10");
p.setSecond("20");
p.smaller();
```

Scala版上边界实现：

```scala
class Pair[T <: Comparable[T]](val first:T, val second:T) {
    def smaller = {
        if (first.compareTo(second) < 0) {
            println("first < second")
        } else if (first.compareTo(second) > 0) {
            println("first > second")
        } else {
            println("first = second")
        }
    }
}
val p = new Pair[String]("10","20")
p.smaller
```

## 3.2 下边界

Java实现：

```java
public class Father {
    protected String name;
    public Father(String name) {
        this.name = name;
    }
    public Father() {
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public String message() {
        return "<Father> name is "+name;
    }
}

public class Child extends Father{
    public String message() {
        return "<Child> name is "+name;
    }
}
public class Children extends Child {
    public String message() {
        return "<Children> name is "+name;
    }
}
public class MethodClient {
    public String getMessage(Class<? super Child> clazz) {
        if (clazz == Child.class) {
            return new Child().message();
        }
        if (clazz == Father.class) {
            return new Father().message();
        }
        //这里编译通不过，因为Children是Child的子类，而我们所接受的参数是Child以及他的父类才可以
        if (clazz == Children.class) {
            return new Children().message();
        }
        return null;
    }
}
```

Scala实现：

```scala
class Father(val name: String)
class Child(name: String) extends Father(name)
def getIDCard[R >: Child](person:R) {
    if (person.getClass == classOf[Child]) {
        println("please tell us your parents' names.")
    } else if (person.getClass == classOf[Father]) {
        println("sign your name for your child's id card.")
    } else {
        println("sorry, you are not allowed to get id card.")
    }
}

val c = new Child("ALice")
getIDCard(c)
```

# 四 边界之视图边界（View Bounds）

刚才我们看过上边界一个例子，class Pair[T<: Comprable[T]]

如果你尝试new Pair[2,3],肯定会报错，提示Int不是Comparable[Int]的子类，Scala Int类型没有实现Comparable接口，(注意Java的包装类型是可以的)，但是RichInt实现了Comparable[Int]，同时还有一个Int到RichInt的隐式转换，这里就可以使用视图界定。

注意：视图边界用来要求一个可用的隐式转换函数（隐式视图）来将一种类型自动转换为另外一种类型，定义如下：

```scala
def func[A <% B](p:A) = 函数体
```

它其实等价于以下函数定义方式

```scala
def func[A](p:A) (implicit m:A=>B) = 函数体 
```

```scala
class Person(val name: String) {
    def sayHello = println("Hello, I'm " + name)
    def makeFriends(p: Person) {
        sayHello
        p.sayHello
    }
}

class Student(name: String) extends Person(name)
class Dog(val name: String) {
    def sayHello = println("汪汪, I'm " + name)
    implicit def dog2person(dog: Object): Person = {
        if(dog.isInstanceOf[Dog]) {
            val _dog = dog.asInstanceOf[Dog];
            new Person(_dog.name);
        } else {
            null
        }
    }
}

class Party[T <% Person](p1:T,p2:T)
```

另外一个例子：

```scala
class Pairs[T <% Ordered[T]] (val first:T, val second:T) {
    def smaller = if (first < second) first else second
}
```

# 五 边界之上下文界定

我们知道View Bounds: T <% V必须要求存在一个T 到V的隐式转换。而上下文界定的形式就是[T:M]，其中M是另一个泛型类，他要求必须存在一个类型为M[T]的隐式值

```scala
def func[T:S](p:T) = 函数体
```

表示这个函数参数p的类型是T，但是在调用函数func的时候，必须有一个隐式值S[T]存在，也可以这样写：

```scala
def func[T](p:T)(implicit arg:S[T]) = 函数体
```

类型参数可以有一个形式为T:M的上下文界定，其中M是另外一个泛型类型。它要求作用域存在一个M[T]的隐式值

举个例子：

```scala
class Fraction[T:Ordering] {}
```

他要求存在一个类型为Ordering[T]的隐式值，该隐式值可以用于该类的方法中，考虑如下例子：

```scala
class Fraction[T:Ordering](val a:T, val b:T) {
  def small(implicit order:Ordering[T]) = {
    if (order.compare(a,b) < 0) *println*(a.toString) else *println*(b.toString)
  }
}
```

假设现在有一对象Model，需要传入Fraction中，那么：

```scala
class Model(val name:String, val age:Int) {
  *println*(s"构造对象 {$name,$age}")
}

val *f* = new Fraction(new Model("Shelly",28),new Model("Alice",35))
*f*.small
```

*由于需要一个Ordering[Model]的隐式值，但是我们又没有提供，所以上面编译是有问题的*

 

怎么办呢？既然需要Ordering[Model]的隐式值，那么我们就先创建一个Ordering[Model]的类

```scala
class ModelOrdering extends Ordering[Model]{
  override def compare(x: Model, y: Model): Int = {
    if (x.name == y.name) {
      x.age - y.age
    } else if (x.name > y.name) {
      1
    } else {
      -1
    }
  }
}
```

这个类重写compare方法

然后，编译器需要能够找到这个隐式值这个隐式值 可以是变量也可以是函数。

```scala
object ImplicitClient extends *App* {
  *//implicit valmo = new ModelOrdering
\*  implicit def mo = new ModelOrdering
  */\*由于需要一个Ordering[Model]的隐式值，所以一下编译是有问题的\*/
\*  val *f* = new Fraction(new Model("Shelly",28),new Model("Alice",35))
  *f*.small
}
```

# 六 Manifest上下文界定

在Scala中，如果要实例化一个泛型数组，需要使用[T:Manifest]

泛型类型，这样才能实例化泛型数组

也就是说:

```scala
def func[T: Manifest](参数列表){}

//等价于

def func[T](参数列表)(implicit evidence:Manifest[T]) {}

class Manifests {
  def convert[T:Manifest](array:T*): Unit ={
    val arr = new Array[T](array.length)
    for (i <- 0 until array.length){
      arr(i) = array(i)
    }
    arr
  }
}
```

# 七 多重界定

一个类型参数有多个类型约束,比如：

```
T>: A <: B
```

表示T所允许的范围是A的父类 或者是B的子类

```
T:A:B
```

表示作用域必须存在A[T]和B[T]隐式值

```
T <%A <% B
```

表示作用域必须有T到A 和 T到B 的隐式转换

```scala
class Person(val name:String, val age:Int) {
  def desc(color:String,weight:Int) = *println*(s"我的颜色：$color, 我的重量：$weight")
  def shopping(p:Person) = *println*("我正在和 "+p.name+"在万达广场购物")
}

class Dog(val name: String,val age:Int) {
  def sayHello = *println*("汪汪, 我是" + name)
  def actMute(): Unit = {
    *println*(s"$name 正在卖萌")
  }
}

class Cat(val name: String,val age:Int) {
  def sayHello = *println*("喵喵, 我是" + name)
}

class Converter{
  def act[T <% Person <% Dog](o:T,p:Person,d:Dog): Unit ={
    if (p != null) {
      *println*(o.shopping(p))
    }

​    if (d != null) {
​      *println*(o.actMute())
​    }
  }
}

object GenericClient extends *App* {
  implicit def cat2person(cat: Object): Person = {
    if(cat.isInstanceOf[Cat]) {
      val _cat = cat.asInstanceOf[Cat];
      new Person(_cat.name,_cat.age);
    } else {
      null
    }
  }

  implicit def cat2dog(cat: Object): Dog = {
    if(cat.isInstanceOf[Cat]) {
      val _cat = cat.asInstanceOf[Cat];
      new Dog(_cat.name,_cat.age);
    } else {
      null
    }
  }
  val *converter*= new Converter
  val *p* = new Person("王一彤",20)
  val *d* = new Dog("啸天",5)
  val *c* = new Cat("小白",2)
  *converter*.act(*c*,*p*,*d*)
} 
```

# 八 类型约束

类型约束提供给你的是另外一个限定类型的方式，总共有三种关系可供使用

T =:= U 表示测试T 是否等于U类型

T <:< U 表示测试T 是否为U的子类型

T <%< U 表示是否存在T到U 的转换

# 十 协变和逆变

协变和逆变：用于父子类型的转换

Covariant: 协变表示子类转父类，比如子类型给以赋给父类型

Contravariant: 逆变表示父类转子类

简单举几个例子：

不可变：

```scala
public class Animal {
  private String name;
  private int age;

  public Animal(){

  }

  public Animal(String name,int age){
    super();
    this.name = name;
    this.age = age;
  }

  public int getAge() {
    return age;
  }

  public void setAge(int age) {
    this.age = age;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }
}

public class Mammal extends Animal {
  public Mammal(){

  }
  public Mammal(String name, int age){
    super(name,age);
  }

  public void suckle() {
    System.*out*.println("I'm suckling");
  }
}

 

*/**
 \* 不可变编译就会报错，类型不匹配
 \* 因为ArrayList 和 ArrayList是不相等
 \*/
*ArrayList<Animal> animals1 = new ArrayList<Mammal>();

*/\*
 \* 协变 
 \* 表示我可以接受T类型以及他的子类
 \*/
*ArrayList<? extends Animal> animals2 = new ArrayList<Mammal>();

*/\*
 \* 协变 
 \* 表示我可以接受T类型以及他的父类
 \*/
*ArrayList<? super Mammal> animals3 = new ArrayList<Animal>();
```

协变与逆变的时机

一般而言：如果一个对象同时消费和产出某值，则类型保持不变；如果是消费某个对象的值，适合逆变，如果生产某个对象的值，则适合协变

```scala
public class Consumer<E> {
  public void consume(List<E> elements) {
    for (E e : elements) {
      System.*out*.print(e + " ");
    }
  }
}

public static void main(String[] args) {
  Consumer<Number> consumer = new Consumer<Number>();
  List<Integer> intList = new ArrayList<Integer>();
  intList.add(1);intList.add(2);intList.add(3);intList.add(6);intList.add(10);
  List<Float> floatList = new ArrayList<Float>();
  floatList.add(11.11f);floatList.add(2.2f);floatList.add(3.3f);floatList.add(6.6f);floatList.add(10.1f);
  consumer.consume(intList);
  consumer.consume(floatList);
}
```

假设我们初始化一个Comsumer<Number>,虽然Integer和Float都是Number子类，但是List<Integer> 和 List<Float> 都不是List<Number>子类，因为Java中泛型是不可变的。

所以我么应该改为：

```scala
public class Consumer<E> {
  public void consume(List<? extends E> elements) {
    for (E e : elements) {
      System.*out*.print(e + " ");
    }
  }
}
```

这样就可以了。

假设我们需要往一个集合添加数据：

```scala
public Collection<E> produce(Collection<E> c,List<? extends E> elementList) {
  for (E e : elementList) {
    c.add(e);
  }
  return c;
}
```

如果还是初始化一个Comsumer<Number>,那我们传递一个Collection<Object>，这时候类型不匹配，因为Collection<Number>并不是Collection<Object>的子类，

```scala
public Collection<? super E> produce(Collection<? super E> c,List<? extends E> elementList) {
  for (E e : elementList) {
    c.add(e);
  }
  return c;
}
```

这样的话，我就可以接收任何E类型父类型，然后把值添加进来

```scala
consumer.produce(new ArrayList<Object>(), intList); 
```

Scala中的协变和逆变：

协变[+T]总结: 只有满足指定类型或者指定类型子类才可以被兼容,即使是指定类型的父类也不会被兼容,通俗地讲，只要是你或者你的子类我都可以编译通过

```scala
class Master(val name:String) {

}
class Professional(name:String) extends Master(name){

}
class Worker(val name:String){

}

class Card[+T](val name: String) {
  def enterMeet[T](card:Card[Master]){
    *println*("welcome you join the meeting!!");
  }
}

object Test extends *App* {
  val *c1* = new Card[Master]("Master")
  *c1*.enterMeet(*c1*)
  val *c2* = new Card[Professional]("Professional")
  *c1*.enterMeet(*c2*)
  val *c3* = new Card[Worker]("Worker")
  */\*由于Worker不是Master子类，所以不满足协变特性\*/
  c3*.enterMeet(c3)
}
```

逆变[-T]总结: 只有满足指定类型或者指定类型父类才可以被兼容,即使是指定类型的子类也不会被兼容通俗地讲，只要是你或者你的父类我都可以编译通过

```scala
class Master(val name:String) {

}
class Professional(name:String) extends Master(name){

}
class Worker(name:String) extends Professional(name) {

}

class Card[-T](val name: String) {
  def enterMeet(card:Card[Professional]){
    *println*("welcome you join the meeting!!");
  }
}

object Test extends *App* {
  val *c1* = new Card[Master]("Master")
  *c1*.enterMeet(*c1*)
  val *c2* = new Card[Professional]("Professional")
  *c1*.enterMeet(*c2*)
  val *c3* = new Card[Worker]("Worker")
  */\*由于Worker不是Professional的父类，所以不满足逆变特性\*/
  c3*.enterMeet(c3)
}
```

# 十一 object不能泛型

我们不能给object添加参数化类型

# 十二 类型通配符