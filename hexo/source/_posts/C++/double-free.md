---
title: "C++: free(): double free detected问题分析和处理"
date: 2022-10-09 15:46:04
slug: "double-free"
categories:
  - "C++"
---

# C++: free(): double free detected问题分析和处理

最近在项目中遇到了“free(): double free detected”问题，出问题的代码类似于：

```c++
#include <queue>
#include <cstring>
#include <iostream>
using namespace std;
 
class Test
{
    int *myArray;
 
public:
    Test() { myArray = new int[10]; }
 
    ~Test()
    {
        cout << "delete, myArray addr: " << myArray << endl;
        delete[] myArray;
    }
};
 
int main()
{
    queue<Test> q;
    Test t;
    q.push(t);
}
```

编译运行这段代码后，报错如下：

```bash
$ ./a.out
delete, myArray addr: 0x55f9d504a0d0
delete, myArray addr: 0x55f9d504a0d0
free(): double free detected in tcache 2
[1]    9912 abort (core dumped)  ./a.out
```

这里看到同一段堆内存被free了两次，使用valgrind工具检查也发现了frees比allocs多了一次：

```c++
$ valgrind --leak-check=yes ./a.out
==10533== HEAP SUMMARY:
==10533==     in use at exit: 0 bytes in 0 blocks
==10533==   total heap usage: 5 allocs, 6 frees, 74,344 bytes allocated
==10533==
==10533== All heap blocks were freed -- no leaks are possible
==10533==
==10533== For counts of detected and suppressed errors, rerun with: -v
==10533== ERROR SUMMARY: 1 errors from 1 contexts (suppressed: 0 from 0)
```


出现这个问题的根本原因是 q.push(t), 当我们查看**std::queue::pus**h方法时，我们看到添加到队列的元素"初始化为 x 的副本"。**它实际上是一个全新的对象，它使用复制构造函数复制原始对象的每个成员来制作一个新的 Test**。**默认情况下C++编译器会生成一个复制构造函数：当把所有变量值从旧对象复制到新对象时，就会有两个指针指向内存中的同一个数组**。这本质上并不坏，但析构函数将尝试删除同一个数组两次，因此出现"double free detected"运行时错误。

## 解决方法一：添加copy constructor和copy-assignment operator

第一步是实现一个copy constructor，它可以安全地将数据从一个对象复制到另一个对象。它可能看起来像这样：

```c++
Test(const Test &other)
{
    myArray = new int[10];
    memcpy(myArray, other.myArray, 10);
}
```

现在在复制 Test 对象时，将为新对象分配一个新数组，并且也会复制数组的值。但是把Test对象赋值给另外一个对象时，编译器可能会导致类似的问题，所以我们要同样实现一个copy-assignment operator，看起来像是这样：

```cpp
Test &operator=(const Test &other)
{
    myArray = new int[10];
    if (this != &other)
    {
        memcpy(myArray, other.myArray, 10);
    }
    return *this;
}
```


这里的重要部分是，我们将其他数组中的数据复制到此对象的数组中，使每个对象的内存保持独立，这样析构函数永远不会删除同一个数组两次。

## 解决方法二（推荐）：使用智能指针

智能指针是存储指向动态分配（堆）对象指针的类。除了能够在适当的时间自动删除指向的对象外，他们的工作机制很像C++的内置指针。智能指针在面对异常的时候格外有用，因为他们能够确保正确的销毁动态分配的对象。他们也可以用于跟踪被多用户共享的动态分配对象。我们尝试用boost库里面的智能指针来解决本文提到的问题，看起来像这样：

```cpp
#include <queue>
#include <cstring>
#include <iostream>
#include <boost/shared_array.hpp>
using namespace std;
 
class Test
{
    int *myArray;
 
public:
    Test()
    {
        boost::shared_array<int> myArray1(new int[10]);
        myArray = myArray1.get();
        std::cout << "myArray addr " << myArray << std::endl;
    }
};
 
int main()
{
    queue<Test> q;
    Test t;
    q.push(t);
}
```

编译后使用valgrind工具检查可以发现堆内存的allocs和frees是一一对应的：

```bash
$ valgrind --leak-check=yes ./a.out
==21832== Memcheck, a memory error detector
==21832== Copyright (C) 2002-2017, and GNU GPL'd, by Julian Seward et al.
==21832== Using Valgrind-3.13.0 and LibVEX; rerun with -h for copyright info
==21832== Command: ./a.out
==21832==
myArray addr 0x5b7ff40
==21832==
==21832== HEAP SUMMARY:
==21832==     in use at exit: 0 bytes in 0 blocks
==21832==   total heap usage: 6 allocs, 6 frees, 74,376 bytes allocated
==21832==
==21832== All heap blocks were freed -- no leaks are possible
==21832==
==21832== For counts of detected and suppressed errors, rerun with: -v
==21832== ERROR SUMMARY: 0 errors from 0 contexts (suppressed: 0 from 0)
```




### C++中的深拷贝与浅拷贝，double free问题

#### 1. background

C++中新增了类的概念, 构造函数 析构函数等也就伴随而来
在构造函数中有一类被称为“**拷贝构造函数**”，如使用不当，会导致coredump等较麻烦的问题。

C++中默认构造函数主要有两类，

1. 是针对**定义类对象的**，定义类对象时，如果没有对应的构造函数，会默认调用一个函数体为空的无参构造函数，比较简单，本文不多赘述；
2. 是**针对类对象初始化新类对象的**，当用**类对象初始化新的类对象**时，如果没有对应的拷贝构造函数，会调用一个默认的拷贝构造函数，类成员之间实现简单的赋值，也就是我们所说的 **浅拷贝**。
3. 总结：**深拷贝和浅拷贝的区别是在对象状态中包含其它对象的引用的时候，当拷贝一个对象时，如果需要拷贝这个对象引用的对象，则是深拷贝，否则是浅拷贝**。

浅拷贝会有什么问题呢？

   ```cpp
   #include <iostream>
   using namespace std;
   
   class A
   {
   	public:
   		int *p;
   		A(){
   			this->p = new int;
   		}
   		~A(){
   			delete p;
   			p = NULL;
   		}
   };
   
   int main()
   {
   	A a1;
   	*a1.p = 5;
   	cout<<*a1.p<<endl;
   	A a2(a1);
   	cout<<*a2.p<<endl;
   	return 0;
   }
   ```

上面代码就是简单的一个输出：
定义a1，给a1的p开空间，然后赋值5，
定义a2，用a1初始化a2，因为没有定义拷贝构造函数，调用上面所说的默认拷贝（浅拷贝），将a1中 p存的地址，赋值给 a2的 p，

但是运行程序居然会段错误,什么原因呢?

仔细分析一下，会发现程序结束，a1和a2会调用析构函数释放自己成员p指向的空间。。。注意，此时的两个p指向的是同一块内存呢。
![image-20221009151156142](image-20221009151156142.png)

验证：
程序退出前加while true，不然程序退出，自然也就不会调用析构函数了。

```cpp
int main()
{
	A a1;
	*a1.p = 5;
	cout<<*a1.p<<endl;
	A a2(a1);
	cout<<*a2.p<<endl;
	while(1);
	return 0;
}
```

验证结果：进程卡住，core信息没有了，和预期一致。

## 那这种情况应该怎么办呢？

这时候就用到了 ***深拷贝***
也就是显式定义拷贝构造函数，当用类对象初始化新的类对象时，单独给自己的指针成员变量开辟空间。
增加拷贝构造函数的代码如下：

```cpp
#include <iostream>
using namespace std;

class A
{
	public:
		int *p;
		A(){
			this->p = new int;
		}
		//新增的拷贝构造函数
		A(A &x){
			this->p = new int;
			*this->p = *x.p;
		}

		~A(){
			delete p;
			p = NULL；
		}
};

int main()
{
	A a1;
	*a1.p = 5;
	cout<<*a1.p<<endl;;
	A a2(a1);
	cout<<*a2.p<<endl;;
	return 0;
}
```

问题解决。

总结：
当类中有指针成员时，为了防止double free问题的解决方案：
1.定义拷贝构造函数，使用深拷贝；
2.delete前判断要delete的对象是否为NULL；

