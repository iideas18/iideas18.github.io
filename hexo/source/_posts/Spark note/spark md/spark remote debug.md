---
title: "idea远程调试 spark"
date: 2019-09-30 17:25:39
slug: "spark remote debug"
categories:
  - "Spark note"
  - "spark md"
---

# idea远程调试 spark

2017-12-25 22:18:10  更多

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/u012373815/article/details/78897556

## spark 远端调试

本地调试远端集群运行的spark项目，当spark项目在集群上报错，但是本地又查不出问题时，最好的方式就是调试一步一步跟踪代码。但是在集群上的代码又不能像本地一样的调试。那么就试试这个调试方法吧。

远程调试spark其实就四步：
\* 第一步jar包拷贝到集群master节点。
\* 第二步在 idea 中配置远程机器的IP 和调试端口号。
\* 第三步：启动远端的spark项目。
\* 第四步 启动idea 进行调试。

#### **首先**

首先了解jvm一些参数属性

```shell
-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8888
```

这里对上面的几个参数进行说明：

> -Xdebug 启用调试特性
> -Xrunjdwp 启用JDWP实现，包含若干子选项：
> transport=dt_socket JPDA front-end和back-end之间的传输方法。dt_socket表示使用套接字传输。
> address=8888 JVM在8888端口上监听请求，这个设定为一个不冲突的端口即可。
> server=y y表示启动的JVM是被调试者。如果为n，则表示启动的JVM是调试器。
> suspend=y y表示启动的JVM会暂停等待，直到调试器连接上才继续执行。suspend=n，则JVM不会暂停等待。

### 第一步 将jar包拷贝到集群

将spark 项目打jar包， 将jar包放到集群master节点上；

### 第二步 配置idea

编辑idea配置：
点击小三角，选择：edit Configurations 如图
![这里写图片描述](https://img-blog.csdn.net/20171225221929030?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvdTAxMjM3MzgxNQ==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)
添加一个remote 配置
![这里写图片描述](https://img-blog.csdn.net/20171225222040578?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvdTAxMjM3MzgxNQ==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

配置远端地址和端口 （此处配置的是 远端master 节点的地址）
![这里写图片描述](https://img-blog.csdn.net/20171225222053975?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvdTAxMjM3MzgxNQ==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

### 第三步 远端启动spark项目

在集群启动要调试的spark项目。命令如下：
/tmp/mySpark.jar 为你sprak 项目在集群master上的位置

```shell
spark-submit --class WordCount --master spark://192.168.100.xx:7077  --driver-java-options "-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8888" /tmp/mySpark.jar
```

也可在conf/spark-env.sh这个文件最后加入（不过没有进行实际测试）

```shell
 export SPARK_JAVA_OPTS+="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8888"
```

如图进入监听：
![这里写图片描述](https://img-blog.csdn.net/20171225222321259?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvdTAxMjM3MzgxNQ==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

### 第四步 启动idea

启动idea 的debug 模式就会进入断点。
![这里写图片描述](https://img-blog.csdn.net/20171225222354261?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvdTAxMjM3MzgxNQ==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)





```shell
spark-submit --class SparkWordCountWithScala --master yarn  --driver-java-options "-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8887" spark_hello.jar
```

https://mopheiok.github.io/Tools/idea-spark/