---
title: "Const"
date: 2022-10-08 14:44:20
cover: "/2022/10/08/C++/Const/82f80adb5e9a47aea77322cf5e2202b7.png"
categories:
  - "C++"
---

# Const

## 1. const修饰变量

### 1.1 const常量的作用

1.**将变量定义为常量，防止意外的修改，增强程序的健壮性**

> const常量和宏定义的区别：
>
> 1. const常量会进行类型检查
>    编译器可以对const常量进行类型安全检查，而对define只进行字符替换，没有类型安全检查，在字符替换时可能会产生意料不到的错误。
> 2. const常量更节省空间，避免不必要的内存分配
>    const常量从汇编的角度来看，只是给出了对应的内存地址，而不是像#define一样给出的是立即数，所以，const定义的常量在程序运行过程中只有一份拷贝，而#define宏定义的常量在内存中有若干个拷贝

2.**和static一样，修饰全局变量使其可见范围为当前文件**
普通全局变量的作用域是当前文件，但是在其他文件中也是可见的，使用extern声明后就可以使用

**const全局变量在其他文件中是不可见的，这和添加了static关键字的效果类似。**

### 1.2  const和引用

可以把引用绑定到const对象上，就像绑定到其他对象上一样，我们称之为**对常量的引用**（reference to const）。与普通引用不同的是，对常量的引用不能被用作修改它所绑定的对象

![在这里插入图片描述](82f80adb5e9a47aea77322cf5e2202b7.png)

因为不允许直接为ci赋值，当然也就不能通过引用去改变ci。因此，对r2的初始化是错误的。假设该初始化合法，则可以通过r2来改变它引用对象的值，这显然是不正确的。

### 1.2.1 初始化和对const的引用

我们知道，引用的类型必须与其所引用对象的类型一致，但是有两个例外：
在初始化常量引用时允许用任意表达式作为初始值，只要该表达式的结果能转换成引用的类型即可。
尤其，允许为一个常量引用绑定**非常量的对象、字面值，甚至是个一般表达式**：

![在这里插入图片描述](https://img-blog.csdnimg.cn/6e5b617dd747452488a23f8f3aa84418.png)

**对const的引用可能引用一个并非const的对象**
必须认识到，常量引用仅对引用可参与的操作做出了限定，对于引用的对象本身是不是一个常量未作限定。因为对象也可能是个非常量，所以允许通过其他途径改变它的值：

![image-20221008102822824](image-20221008102822824.png)

r2绑定（非常量）整数i是合法的行为。然而，不允许通过r2修改i的值。尽管如此，i的值仍然允许通过其他途径修改，既可以直接给i赋值，也可以通过像r1一样绑定到i的其他引用来修改。

### 1.3 const和指针

与引用一样，也可以令指针指向常量或非常量。类似于常量引用，指向常量的指针（pointer to const）不能用于改变其所指对象的值。
**要想存放常量对象的地址，只能使用指向常量的指针**：

![image-20221008102920258](image-20221008102920258.png)

指针的类型必须与其所指对象的类型一致，但也不绝对，因为允许令一个指向常量的指针指向一个非常量对象：

![image-20221008102936707](image-20221008102936707.png)

**和常量引用一样，指向常量的指针也没有规定其所指的对象必须是一个常量。所谓指向常量的指针仅仅要求不能通过该指针改变对象的值，而没有规定那个对象的值不能通过其他途径改变。**

## 2. const修饰函数

1、const修饰函数参数，表示参数不可变，若参数为引用，可以增加效率(引用传递而不用值拷贝)

2、const 修饰函数返回值，避免返回值被修改

3、const修饰类的成员函数本身(不能修饰全局函数，因为全局函数没有this指针)

- 该函数不能修改成员变量
- 不能调用非const成员函数，因为任何非const成员函数会有修改成员变量的企图

默认的this指针是顶层const，形如 A* const this，是指向类类型非常量版本的常量指针，

因为this是隐式的，所以它需要遵循初始化规则，意味着（在默认情况下）我们不能把this绑定到一个常量对象上，这一情况也就使得我们不能在一个常量对象上调用普通的成员函数。

如果我们想让this绑定到常量对象上怎么做呢？
由于this是隐式的并且不会出现在参数列表中，所以无法显示的将this声明成指向常量的指针。
C++的做法是允许把const关键字放在成员函数的参数列表之后，表示this是一个指向常量的指针。
像这样使用const的成员函数被称作常量成员函数（常量对象，以及常量对象的引用或指针都只能调用常量成员函数）

现在的this也成了底层const，所以属性值不能改变。
形如：`const A* const this`

```c++
// 修饰函数参数
 int get_data(const int a) 
// 修饰返回值
const int get_data(/*A*  const this*/)
    {
        return this->data;
    }
// 修饰成员函数
int get_data(/*const A*  const this*/)  const
    {
        return this->data;
 //因为this是指向常量的指针，所以常量成员函数不能改变调用它的对象的内容。即不能修改data
    }
```

const修饰类成员
1、const修饰类的成员变量
表示成员变量不能被修改，同时只能在初始化列表中赋值

2、const修饰类的成员函数
见上面修饰函数

3、const修饰类对象
对象的任何成员都不能被修改
const类对象只能调用const成员函数

类中的所有函数都可以声明为const函数吗。哪些函数不能？
1、构造函数不能
因为const修饰的成员函数不能修改成员变量。构造函数也属于类的成员函数，但是构造函数需要修改类的成员变量，所以类的构造函数不能申明成const类型的。
2、static静态成员函数不行
static静态成员是属于类的，而不属于某个具体的对象，所有的对象共用static成员。this指针是某个具体对象的地址，因此static成员函数没有this指针。而函数中的const其实就是用来修饰this指针的，表示this指向的内容不可变，static静态成员却没有this指针，所以const不能用来修饰static成员函数

## 3. const代码举例

const修饰的变量、函数、对象 分别成为：常变量、常函数、常对象

常函数只能访问常变量，常对象只能访问常变量和常函数

```c++
class Student{
public:
    Student(char *name, int age, float score);
public:
    void show();
    //三个常函数
    char *getname() const;
    int getage() const;
    float getscore() const;
private://三个常变量
    char *m_name;
    int m_age;
    float m_score;
};
//常变量的赋值方式：参数列表
Student::Student(char *name, int age, float score): m_name(name), m_age(age), m_score(score){ }

//常函数的作用就是获取常变量的值，但是又不能修改它们的值，这种措施主要还是为了保护数据而设置的
char * Student::getname() const{
    return m_name;
}
int Student::getage() const{
    return m_age;
}
float Student::getscore() const{
    return m_score;
}

//stu、pstu 分别是常对象以及常对象指针，它们都只能调用 const 成员函数。
int main(){
    const Student stu("小明", 15, 90.6);
    //stu.show();  //error
    cout<<stu.getname()<<"的年龄是"<<stu.getage()<<"，成绩是"<<stu.getscore()<<endl;
    const Student *pstu = new Student("李磊", 16, 80.5);
    //pstu -> show();  //error
    cout<<pstu->getname()<<"的年龄是"<<pstu->getage()<<"，成绩是"<<pstu->getscore()<<endl;
    return 0;
}
```

## 4. constexpr

constexpr：constant expression，常量表达式

实际开发中，我们经常会用到常量表达式。以定义数组为例，数组的长度就必须是一个常量表达式：

```c++
// 1)
int url[10];//正确
// 2)
int url[6 + 4];//正确
// 3)
int length = 6;
int url[length];//错误，length是变量
```

下面的代码是正确的：

```c++
constexpr int num = 1 + 2 + 3;
int url[num] = {1,2,3,4,5,6};
```

为什么需要constexpr ？

我们知道，C++ 程序的执行过程大致要经历编译、链接、运行这 3 个阶段。
常量表达式和非常量表达式的计算时机不同：

非常量表达式只能在程序运行阶段计算出结果；
而常量表达式的计算往往发生在程序的编译阶段，这可以极大提高程序的执行效率，因为表达式只需要在编译阶段计算一次，而不再需要每次运行时都计算一次。对于用 C++ 编写的程序，性能往往是永恒的追求。
所以，constexpr 使常量表达式获得在程序编译阶段计算出结果的能力，而不必等到程序运行阶段。

const vs constexpr
const 强调 只读
constexpr 强调 常量
即凡是表达“只读”语义的场景都使用 const，表达“常量”语义的场景都使用 constexpr。
