---
title: "scala 编译完生成两个class文件有何不同"
date: 2019-10-24 17:53:48
cover: "https://img-blog.csdn.net/2018061323315693?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3NtaWxlX2Zyb21fMjAxNQ==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70"
slug: "scala decompiler"
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# scala 编译完生成两个class文件有何不同

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/smile_from_2015/article/details/80686836

### 首先编写一个 `HelloWorld.scala` 文件

```scala
object HelloWorld {
  def main(args: Array[String]) {
    println("Hello World")
  }
}
```

命令行使用`scalac HelloWorld.scala`编译后产生两个文件分别为`HelloWorld.class`和`HelloWorld$.class`
**备注**：类似于 **Java 语言**，**Scala 语言** 可以使用 `scalac` 和 `scala` 分别编译和运行程序。例如运行命令：`scala HelloWorld`

### 使用 JD-GUI 反编译工具对 class 文件进行反编译得到如下目录：

![这里写图片描述](https://img-blog.csdn.net/2018061323315693?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3NtaWxlX2Zyb21fMjAxNQ==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)
从整体目录结构上来看，不难发现 `HelloWorld$.class` 里的内容比 `HelloWorld.class` 更加丰富一些。
具体成员如下表所示：

| 成员         | HelloWorld$.class | HelloWorld.class      |
| ------------ | ----------------- | --------------------- |
| 类           | HelloWorld$       | HelloWorld            |
| 私有构造方法 | HelloWorld$()     | –                     |
| 方法         | main(String[])    | static main(String[]) |
| 静态代码块   | static{}          | –                     |
| 静态成员变量 | MODULE$           | –                     |

### 再从具体的反编译文件查看 `HelloWorld$.class` 和 `HelloWorld.class`

![这里写图片描述](https://img-blog.csdn.net/20180613233203935?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3NtaWxlX2Zyb21fMjAxNQ==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)
`HelloWorld.class`(@ScalaSignature后面的参数值有点长,当前重点不在此,先忽略掉)
![这里写图片描述](https://img-blog.csdn.net/20180613233211595?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3NtaWxlX2Zyb21fMjAxNQ==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)
对比两个文件不难发现：函数的执行体主要是在 `HelloWorld$.class` 中，当执行`HelloWorld.class` 中 的`main` 方法时，会调用方法 `HelloWorld.main(null)`,接着会执行方法体中的代码 `HelloWorld..MODULE$.main(paramArrayOfString)` ，接着函数跳转 `HelloWorld$.class` 的 `main` 方法中，然后执行 `Predef..MODULE$.println("Hello World");`最后输出结果:”`Hello World`“。