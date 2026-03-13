---
title: "template"
date: 2022-10-08 20:21:39
categories:
  - "C++"
---

# template

## 1. Define

### 1.1 函数模板

#### 1.1.1 定义

以关键字template开始，后跟一个模板参数列表(不能为空)（template parameter list），这是一个逗号分隔的一个或多个模板参数（template parameter）的列表，用小于号（<）和大于号（>）包围起来。

![image-20221007013055866](image-20221007013055866.png)

> 模板参数列表的作用很像函数参数列表: 函数参数列表定义了若干特定类型的局部变量，但并未指出如何初始化它们。在运行时，调用者提供实参来初始化形参。
>
> 类似的，模板参数表示在类或函数定义中用到的类型或值。当使用模板时，我们（隐式地或显式地）指定模板实参（template argument），将其绑定到模板参数上。
>
> 我们的compare函数声明了一个名为T的类型参数。在compare中，我们用名字T表示一个类型。而T表示的实际类型则在编译时根据compare的使用情况来确定。

#### 1.1.2 实例化

编译器用推断出的模板参数来为我们实例化（instantiate）一个特定版本的函数。当编译器实例化一个模板时，它使用实际的模板实参代替对应的模板参数来创建出模板的一个新“实例”.

![image-20221007013558175](image-20221007013558175.png)

这些编译器生成的版本通常被称为模板的实例（instantiation）

#### 1.1.3 模板类型参数 ---------- T

compare函数有一个模板类型参数（type parameter）。一般来说，我们可以将类型参数看作类型说明符，就像内置类型或类类型说明符一样使用。特别是，类型参数可以用来指定返回类型或函数的参数类型，以及在函数体内用于变量声明或类型转换：

![image-20221007013836821](image-20221007013836821.png)

类型参数前必须使用关键字class或typename, 在模板参数列表中，这两个关键字的含义相同，可以互换使用。一个模板参数列表中可以同时使用这两个关键字：

![image-20221007013927676](image-20221007013927676.png)

看起来用关键字typename来指定模板类型参数比用class更为直观。毕竟，我们可以用内置（非类）类型作为模板类型实参。而且，typename更清楚地指出随后的名字是一个类型名。但是，typename是在模板已经广泛使用之后才引入C++语言的，某些程序员仍然只用class。

#### 1.1.3 非类型参数（nontype parameter）

除了定义类型参数，还可以在模板中定义非类型参数（nontype parameter）。一个非类型参数表示一个值而非一个类型。我们通过一个特定的类型名而非关键字class或typename来指定非类型参数。

![image-20221007014048859](image-20221007014048859.png)

当一个模板被实例化时，非类型参数被一个用户提供的或编译器推断出的值所代替。这些值必须是常量表达式（参见2.4.4节，第58页），从而允许编译器在编译时实例化模板。

## 1.2 类模板

#### 1.2.1定义

类似函数模板，类模板以关键字template开始，后跟模板参数列表。在类模板（及其成员）的定义中，我们将模板参数当作替身，代替使用模板时用户需要提供的类型或值：

![image-20221008144636879](image-20221008144636879.png)

我们的Blob模板有一个名为T的模板类型参数，用来表示Blob保存的元素的类型。例如，我们将元素访问操作的返回类型定义为T&。当用户实例化Blob时，T就会被替换为特定的模板实参类型。

#### 1.2.2 实例化类模板

显式模板实参（explicit template argument）列表，它们被绑定到模板参数。编译器使用这些模板实参来实例化出特定的类。

![image-20221008144747104](image-20221008144747104.png)

ia和ia2使用相同的特定类型版本的Blob（即Blob<int>）。从这两个定义，编译器会实例化出一个与下面定义等价的类：

![image-20221008144842835](image-20221008144842835.png)

当编译器从我们的Blob模板实例化出一个类时，它会重写Blob模板，将模板参数T的每个实例替换为给定的模板实参，在本例中是int。对我们指定的每一种元素类型，编译器都生成一个不同的类：

![image-20221008144856031](image-20221008144856031.png)

这两个定义会实例化出两个不同的类。names的定义创建了一个Blob类，每个T都被替换为string。prices的定义生成了另一个Blob类，T被替换为double。









在编写代码的时候，发现一个现象：

1. 模板类从一个父模板类继承后，不能访问其内部的protected成员变量，提示：not declare；
2. 普通类从一个父模板类继承后，可以访问其内部的protected成员变量，可正常编译和使用；

对于第1个现象，如果想正常使用需要加上父模板类的域名; 

下面上代码

1. 模板类继承模板类

```c++
#include <iostream>
namespace test
{
template <typename T>
class Base
{
public:
  void Show()
  {
    std::cout << "hello world1! Base. a = " << a << std::endl;
  }

protected:
  int a = 0;
};

template <typename T>
class Child : public Base<T>
{
public:
  void Show()
  {
    std::cout << "hello world1! Child. a = " << a << std::endl;
  }
};
} // namespace test

int main()
{
  test::Child<int> ch;
  ch.Show();
  std::cout << "main.\n";
  return 0;
}
```

运行结果：

![img](421798-20200426102829593-307001607.png)

对成员变量a增加基类域名后编译通过：

![img](421798-20200426103140333-866845689.png)

1. 普通类继承模板类

```c++
#include <iostream>
namespace test
{
template <typename T>
class Base
{
public:
  void Show()
  {
    std::cout << "hello world1! Base. a = " << a << std::endl;
  }

protected:
  int a = 0;
};

class A : public Base<int>
{
public:
  void Show()
  {
    std::cout << "hello world1! A. a = " << a << std::endl;
  }
};
} // namespace test

int main()
{
  test::A ch;
  ch.Show();
  std::cout << "main.\n";
  return 0;
}
```

运行结果：

![img](421798-20200426104327193-135020804.png)

什么模板类不能够声明和定义分离?

模板类是编译器生成具体的类的依据，只有模板被使用时才会编译。首先一般编译器都是以一个.cpp文件为一个编译单元，如果模板类的声明和实现是分离的，那么对模板类的定义文件编译，生成.o文件，此时只有模板，没有模板的实例类。c++编译器的工作流程分为预处理、编译、汇编、链接，而模板实例化发生在编译期间，当编译器没有找到模板类的一个特例时，它会认为该特例在另外的文件中（.o或.so），而将问题交给链接器去处理，但是模板的实现文件中没有该实例，无法找到符号，所以一般这种问题的抱错都是”ld error“。

那么为什么模板不被使用就无法编译呢。我们知道，c语言对内存的管理是底层的面向系统的，如果类型参数化的模板类而言，无法得知模板的类型，就无法得知模板类的占用内存。编译器无法为一个不知道大小的类分配内存。所谓模板类，不是一个类，而是一个生成类的模板。

![img](v2-eff9c2fa2869f38e48afb7e0ffd3fc59_1440w.webp)

模板实例化是指从一个函数模板或类模板中创建一个具体的函数或一个具体的类。模板的实例化可以是隐式的（编译器生成的）或显式的（用户提供的）。

## **隐式实例化**

隐式实例化应该是你的默认选择。隐式实例化意味着编译器会自动使用提供的模板实参生成具体的函数或类。一般来说，编译器也会从函数的实参中推导出模板实参。在 C++17 中，编译器也可以推导出类模板的模板实参。

```cpp
// implicitTemplateInstantiation.cpp

#include <iostream>
#include <string>
#include <vector>

template <typename T>
class MyClass{
 public:
    MyClass(T t) { }
    std::string getType() const {
        return typeid(T).name();
    }
};

template<typename T>
bool isSmaller(T fir, T sec){
    return fir < sec;
}

int main(){

    std::cout << '\n';

    std::cout << std::boolalpha;
  
    std::vector vec{1, 2, 3, 4, 5};          // (1)
    std::cout << "vec.size(): " << vec.size() << '\n';
  
    MyClass myClass(5);                      // (2)
    std::cout << "myClass.getType(): " << myClass.getType() << '\n';
  
    std::cout << '\n';
  
    std::cout << "isSmaller(5, 10): " 
              << isSmaller(5, 10) << '\n';   // (3)
    std::cout << "isSmaller<double>(5.5f, 6.5): " 
              << isSmaller<double>(5.5f, 6.5) << '\n';    // (4)
  
    std::cout << '\n';
  
}
```

第 (1) 行和第 (2) 行使用了类模板参数推导。第 (3) 行也推导出了它的模板参数。而在第 (4) 行，模板参数double被明确指定：`isSmaller(5.5f, 6.5)`。

编译器为每个隐式模板实例化创建一个具体的函数或类。[C++ Insights](https://link.zhihu.com/?target=https%3A//cppinsights.io/s/e8145723)

这个自动过程非常舒适，但也有一些缺点。

- 当你隐式实例化一个模板时，模板的定义通常在头文件中可见。也许，你不想公开这个定义。
- 当你需要一个特定的模板实参时，如果它在具体的翻译单元中不可用，编译器就会实例化。一个翻译单元是C预处理器处理后的源文件。通常情况下，链接器会删除所有多余的模板实例并保留一个。这是对时间和空间的浪费。

这两个问题都可以通过显式模板实例化来解决。

## **显式实例化**

显式实例化有两种风格：显式实例化定义和显式实例化声明。

显式实例化定义的语法：`template 
显式实例化声明的语法：`extern template 

差别在于关键字 `extern`。

显式实例化声明在本文后面会提到，先来讲显式实例化定义。

```cpp
// explicitTemplateInstantiation.cpp

#include <iostream>
#include <string>
#include <vector>

template <typename T>
class MyClass{
 public:
    MyClass(T t) { }
    std::string getType() const {
        return typeid(T).name();
    }
};

template<typename T>
bool isSmaller(T fir, T sec){
  return fir < sec;
}
 
template class std::vector<int>;                       // (1)
template bool std::vector<double>::empty() const;      // (2)

template class MyClass<int>;                           // (3)
template std::string MyClass<double>::getType() const; // (4)

template bool isSmaller(int, int);                     // (5)
template bool isSmaller<double>(double, double);       // (6)

int main(){

  std::cout << '\n';
  
  std::cout << std::boolalpha;
  
  std::vector vec{1, 2, 3, 4, 5};
  std::cout << "vec.size(): " << vec.size() << '\n';
  
  MyClass myClass(5);
  std::cout << "myClass.getType(): " << myClass.getType() << '\n';
  
  std::cout << '\n';
  
  std::cout << "isSmaller(5, 10): " 
            << isSmaller(5,10) << '\n';
  std::cout << "isSmaller<double>(5.5f, 6.5): " 
            << isSmaller<double>(5.5f, 6.5) << '\n';
  
  std::cout << '\n';
  
}
```

请关注注释标出的 (1)-(6) 行，这几行代码进行了模板的显式实例化。

第 (1) 行显式实例化了接收 `int` 类型的 `std::vector`；第 (2) 行显式实例化了`std::vector` 的成员 `empty`。

第 (3) 行显式实例化了接收 `int` 类型的 `MyClass`；第 (4) 行显式实例化了`MyClass` 的成员 `getType`。

第 (5) 行实例化了接收 `(int, int)` 类型的 `Smaller`；第 (6) 行显示提供了模板实参 `double` 完成了同样的事情。

### **隐藏模板的实现**

显式模板实例化可以帮助我们隐藏模板的定义。

1、把模板声明放在头文件。
2、把模板定义放在源文件。在源文件的末尾进行显式模板实例化。
3、包含头文件来使用模板。

这里有三个文件示范了这个过程：

```cpp
// MyClass.h

#include <typeinfo>
#include <string>

template <typename T>
class MyClass{
 public:
    MyClass(T t) { }
    std::string getType() const;
};
// MyClass.cpp

#include "MyClass.h"

template <typename T>
std::string MyClass<T>::getType() const {
    return typeid(T).name();
}

template class MyClass<int>; 
// mainMyClass.cpp

#include "MyClass.h"
#include <iostream>

int main() {

    std::cout << '\n'; 

    MyClass myClass(5);
    std::cout << "myClass.getType(): " << myClass.getType() << '\n';

    /*
    MyClass myClass2(5.5);
    std::cout << "myClass2.getType(): " << myClass2.getType() << '\n';
    */

    std::cout << '\n';

}
```

运行该程序可以得到预期的结果。

![img](https://pic1.zhimg.com/80/v2-46510b93397aa00e2980da0c8890a254_1440w.webp)

但是当我试图对 `int` 以外的其他类型使用 `MyClass` 时，链接器会报出错误。如果让上方代码中注释掉的行生效就会得到这样的报错，原因是没有可用于接收 `double` 类型的模板实例化。

## **抑制模板实例化**

假设你在不同的编译单元中使用 `MyClass`，链接器将其放在一起。本质上，链接器只留了下一个模板实例，其余的都被丢弃了。这是对计算时间的浪费。在C++11中，可以使用了extern关键字，从一个显式模板实例化定义中做出一个显式模板实例化声明。

```cpp
template class MyClass<int>;        // 显式模板实例化定义
extern template class MyClass<int>; // 显式模板实例化声明
```

第二行并没有引起模板实例化，因此编译器生成的东西不会被链接器扔掉。你只需要确保链接器可以获得 `MyClass` 的一个实例化。如果没有，链接器就会报错。