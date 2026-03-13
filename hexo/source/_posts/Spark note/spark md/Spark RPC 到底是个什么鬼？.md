---
title: "Spark RPC 到底是个什么鬼？"
date: 2020-06-07 18:00:04
cover: "https://upload.jianshu.io/users/upload_avatars/4473093/5f28ad8b-ec24-45ba-ad32-d26730cda440.jpg?imageMogr2/auto-orient/strip|imageView2/1/w/96/h/96/format/webp"
categories:
  - "Spark note"
  - "spark md"
---

# Spark RPC 到底是个什么鬼？

[![img](https://upload.jianshu.io/users/upload_avatars/4473093/5f28ad8b-ec24-45ba-ad32-d26730cda440.jpg?imageMogr2/auto-orient/strip|imageView2/1/w/96/h/96/format/webp)](https://www.jianshu.com/u/916a9c0f1bd4)

[sun4lower](https://www.jianshu.com/u/916a9c0f1bd4)关注

0.0962017.03.02 16:19:20字数 1,454阅读 2,038

本文会为大家介绍Spark中的RPC通信机制，详细阐述“Spark RPC到底是个什么鬼？”，闲话少叙，让我们来进入Spark RPC的世界！

## Spark RPC三剑客

Spark RPC中最为重要的三个抽象（“三剑客”）为：RpcEnv、RpcEndpoint、RpcEndpointRef，这样做的好处有：

- 对上层的API来说，屏蔽了底层的具体实现，使用方便
- 可以通过不同的实现来完成指定的功能，方便扩展
- 促进了底层实现层的良性竞争，Spark 1.6.3中默认使用了Netty作为底层的实现，但Akka的依赖依然存在；而Spark 2.1.0中的底层实现只有Netty，这样用户可以方便的使用不同版本的Akka或者将来某种更好的底层实现

下面我们就结合Netty和“三剑客”来具体分析他们是如何来协同工作的。

## Send a message locally

我们通过Spark源码中的一个Test（[RpcEnvSuite.scala](https://link.jianshu.com/?t=https://github.com/apache/spark/blob/master/core/src/test/scala/org/apache/spark/rpc/RpcEnvSuite.scala)）来分析一下发送本地消息的具体流程，源码如下（对源码做了一些修改）：



```scala
  test("send a message locally") {
    @volatile var message: String = null
    val rpcEndpointRef = env.setupEndpoint("send-locally", new RpcEndpoint {
      override val rpcEnv = env

      override def receive = {
        //case msg: String => message = msg
        case msg: String => println(message)  //我们直接将接收到的消息打印出来
      }
    })
    rpcEndpointRef.send("hello")
    //下面是原来的代码
    //eventually(timeout(5 seconds), interval(10 millis)) {
    //  assert("hello" === message)
    //}
  }
```

为了方便理解，先把流程图贴出来，然后详细进行阐述：

![img](https://upload-images.jianshu.io/upload_images/4473093-41a79db809742cb3.jpg?imageMogr2/auto-orient/strip|imageView2/2/w/690/format/webp)

下面我们来详细阐述上例的具体过程：

首先是RpcEndpoint创建并注册的流程：（图中的蓝色线条部分）

- 1、创建RpcEndpoint，并初始化rpcEnv的引用（RpcEnv已经创建好，底层实际上是实例化了一个NettyRpcEnv，而NettyRpcEnv是通过工厂方法NettyRpcEnvFactory创建的）
- 2、实例化RpcEndpoint之后需要向RpcEnv注册该RpcEndpoint，底层实现是向NettyRpcEnv进行注册，而实际上是通过调用Dispatcher的registerRpcEndpoint方法向Dispatcher进行注册
- 3、具体的注册就是向endpoints、endpointRefs、receivers中插入记录：而receivers中插入的信息会被Dispatcher中的线程池中的线程执行：会将记录take出来然后调用Inbox的process方法通过模式匹配的方法进行处理，注册的时候通过匹配到OnStart类型的message，去执行RpcEndpoint的onStart方法（例如Master、Worker注册时，就要执行各自的onStart方法），本例中未做任何操作
- 4、注册完成后返回RpcEndpointRef，我们通过RpcEndpointRef就可以向其代表的RpcEndpoint发送消息

下面就是通过RpcEndpointRef向其代表的RpcEndpoint发送消息的具体流程：（图中的红色线条部分）

- 1、2、调用RpcEndpointRef的send方法，底层实现是调用Netty的NettyRpcEndpointRef的send方法，而实际上又是调用的NettyRpcEnv的send方法，发送的消息使用RequestMessage进行封装：



```scala
nettyEnv.send(RequestMessage(nettyEnv.address, this, message))
```

- 3、4、NettyRpcEnv的send方法首先会根据RpcAddress判断是本地还是远程调用，此处是同一个RpcEnv，所以是本地调用，即调用Dispatcher的postOneWayMessage方法
- 5、postOneWayMessage方法内部调用Dispatcher的postMessage方法
- 6、postMessage会向具体的RpcEndpoint发送消息，首先通过endpointName从endpoints中获得注册时的EndpointData，如果不为空就执行EndpointData中Inbox的post(message)方法，向Inbox的mesages中插入一条InboxMessage，同时向receivers中插入一条记录，此处将Inbox单独画出来是为了方便大家理解
- 7、Dispatcher中的线程池会拿出一条线程用来循环receivers中的消息，首先使用take方法获得receivers中的一条记录，然后调用Inbox的process方法来执行这条记录，而process将messages中的一条InboxMessage（第6步中插入的）拿出来进行处理，具体的处理方法就是通过模式匹配的方法，匹配到消息的类型（此处是OneWayMessage），然后来执行RpcEndpoint中对应的receive方法，在此例中我们只打印出这条消息（步骤8）

至此，一个简单的发送本地消息的流程执行完成。

什么，上面的图太复杂了？我也觉得，下面给出一张简洁的图：

![img](https://upload-images.jianshu.io/upload_images/4473093-8cb4e4eccbc61bba.jpg?imageMogr2/auto-orient/strip|imageView2/2/w/500/format/webp)

我们通过NettyRpcEndpointRef来发出一个消息，消息经过NettyRpcEnv、Dispatcher、Inbox的共同处理最终将消息发送到NettyRpcEndpoint，NettyRpcEndpoint收到消息后进行处理（一般是通过模式匹配的方式进行不同的处理）

如果进一步的进行抽象就得到了我们刚开始所讲的“三剑客”：RpcEnv、RpcEndpoint、RpcEndpointRef

![img](https://upload-images.jianshu.io/upload_images/4473093-e2dc3415aff1c163.jpg?imageMogr2/auto-orient/strip|imageView2/2/w/500/format/webp)

RpcEndpointRef发送消息给RpcEnv，RpcEnv查询注册信息将消息路由到指定的RpcEndpoint，RpcEndpoint接收到消息后进行处理（模式匹配的方式）

RpcEndpoint的声明周期：constructor -> onStart -> receive* -> onStop

其中receive*包括receive和receiveAndReply

本文我们只是通过一个简单的测试程序分析了Spark Rpc底层的实现，集群中的其它通信（比如Master和Woker的通信）的原理和这个测试类似，只不过具体的发送方式有所不同（包括ask、askWithRetry等），而且远程发消息的时候使用了OutBox和NIO等相关的内容，感兴趣的朋友可以对源码进行详细的阅读，本文不一一说明，目的就是通过简单的测试理解大致流程，不再为“Spark Rpc到底是什么”而纠结，一句话总结：Spark Rpc就是Spark中对分布式消息通信系统的高度抽象。

本文参考和拓展阅读：

[spark源码](https://link.jianshu.com/?t=https://github.com/apache/spark)

[Netty官方网站](https://link.jianshu.com/?t=http://netty.io)

[Java NIO Tutorial](https://link.jianshu.com/?t=http://tutorials.jenkov.com/java-nio/index.html)

*本文为原创，欢迎转载，转载请注明出处、作者，谢谢！*