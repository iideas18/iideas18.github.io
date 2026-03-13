---
title: "[spark RPC详解](https://www.cnblogs.com/superhedantou/p/7570692.html)"
date: 2020-06-07 18:03:06
slug: "spark RPC详解"
categories:
  - "Spark note"
  - "spark md"
---

# [spark RPC详解](https://www.cnblogs.com/superhedantou/p/7570692.html)

 前段时间看spark，看着迷迷糊糊的。最近终于有点头绪，先梳理了一下spark rpc相关的东西，先记录下来。

## 1，概述

个人认为，如果把分布式系统（HDFS, HBASE，SPARK等）比作一个人，那么RPC可以认为是人体的血液循环系统。它将系统中各个不同的组件（如Hbase中的master， Regionserver， client）联系了起来。同样，在spark中，不同组件像driver，executor，worker，master（stanalone模式）之间的通信也是基于RPC来实现的。

Spark 1.6之前，spark的RPC是基于Akaa来实现的。Akka是一个基于scala语言的异步的消息框架。Spark1.6后，spark借鉴Akka的设计自己实现了一个基于Netty的rpc框架。大概的原因是1.6之前，RPC通过Akka来实现，而大文件是基于netty来实现的，加之akka版本兼容性问题，所以1.6之后把Akka改掉了，具体jira见（https://issues.apache.org/jira/browse/SPARK-5293）。

本文主要对spark1.6之后基于netty新开发的rpc框架做一个较为深入的分析。

## 2，整体架构

spark 基于netty新的rpc框架借鉴了Akka的中的设计，它是基于Actor模型，各个组件可以认为是一个个独立的实体，各个实体之间通过消息来进行通信。具体各个组件之间的关系图如下(图片来自[1])：

![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921194542493-687838081.png)

### 2.1 RpcEndpoint

表示一个个需要通信的个体（如master，worker，driver），主要根据接收的消息来进行对应的处理。一个RpcEndpoint经历的过程依次是：构建->onStart→receive→onStop。其中onStart在接收任务消息前调用，receive和receiveAndReply分别用来接收另一个RpcEndpoint（也可以是本身）send和ask过来的消息。

### 2.2 RpcEndpointRef

RpcEndpointRef是对远程RpcEndpoint的一个引用。当我们需要向一个具体的RpcEndpoint发送消息时，一般我们需要获取到该RpcEndpoint的引用，然后通过该应用发送消息。

### 2.3 RpcAddress

表示远程的RpcEndpointRef的地址，Host + Port。

### 2.4 RpcEnv

RpcEnv为RpcEndpoint提供处理消息的环境。RpcEnv负责RpcEndpoint整个生命周期的管理，包括：注册endpoint，endpoint之间消息的路由，以及停止endpoint。

 

## 3，实现

Rpc实现相关类之间的关系图如下(图片来自[2])：

![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921194820821-561349702.png)

核心要点如下：

1，核心的RpcEnv是一个特质（trait），它主要提供了停止，注册，获取endpoint等方法的定义，而NettyRpcEnv提供了该特质的一个具体实现。

2，通过工厂RpcEnvFactory来产生一个RpcEnv，而NettyRpcEnvFactory用来生成NettyRpcEnv的一个对象。

3，当我们调用RpcEnv中的setupEndpoint来注册一个endpoint到rpcEnv的时候，在NettyRpcEnv内部，会将该endpoint的名称与其本省的映射关系，rpcEndpoint与rpcEndpointRef之间映射关系保存在dispatcher对应的成员变量中。

 

接下来，我们看一个具体的案例：在standalone模式中，worker会定时发心跳消息（SendHeartbeat）给master，那心跳消息是怎么从worker发送到master的呢，master又是怎么接收消息的？

1，在worker中，forwordMessageScheduler线程会定时每隔心跳超时时间的四分之一时间向自己发送SendHeartbeat消息，在worker的receive函数中，我们看到一旦接收到SendHeartbeat消息，worker会调用sendToMaster函数，将Heartbeat消息（包含worker Id和当前worker的rpcEndpoint引用）发送给master。

![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921194853118-678367594.png)

2，在worker的sendToMaster函数中，通过masterRef.send(message)将消息发送出去。那这个调用背后又做了什么事情呢？NettryRpcEnv中send的实现如下：

 ![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921194912728-74696601.png)

可以看到，当前发送地址（nettyEnv.address）,目标的master地址（this）和发送的消息（SendHeartbeat）被封装成了RequestMessage消息，如果是远程rpc调用的话，最终send将调用postToOutbox函数，并且此时消息会被序列化成Byte流。

![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921194930618-1049308180.png)

3，在postToOutbox函数中，消息将经过OutboxMessage中的sendWith方法（client.send(content)），最终通过TransportClient的send方法（client.send(content)），而在TransportClient中将消息进一步封装，然后发送给master。

 ![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921195104587-1264264024.png)

4， 在master端TransportRequestHandler的handle方法中，由于心跳信息在worker端被分装成了OneWayMessage，所以在该handle方法中，将调用processOneWayMessage进行处理。

 ![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921195124915-1744223116.png)

 

5，processOneWayMessage函数将调用rpcHandler的实现类NettyRpcEnv中的receive方法。在该方法中，首先通过internalRecieve将消息解包成RequestMessage。然后该消息通过dispatcher的分发给对应的endpoint。

 ![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921195154556-686916962.png)

6，那消息是怎么分发的呢？在Dispatcher的postMessage方法中，可以看到，首先根据对应的endpoint的EndpointData信息（主要是该endpoint及其应用以及其信箱（inbox）），然后将消息塞到给endpoint（此例中的master）的信箱中，最后将消息塞到recievers的阻塞队列中。

![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921195214618-723346799.png)

7，那队列中的消息是怎么被消费的呢？在Dispatcher中有一个线程池threadpool在MessageLoop类的run方法中，将receivers中的对象取出来，交由信箱的process方法去处理。如果没有收到任何消息，将会阻塞在take处。

 ![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921195238196-759992660.png)

8，在inbox的proces方法中，首先取出消息，然后根据消息的类型（此例中是oneWayMessage），最终将调用endpoint的receiver方法进行处理（也就是master中的receive方法）。至此，整个一次rpc调用的流程结束。

 ![img](https://images2017.cnblogs.com/blog/942797/201709/942797-20170921195256306-1604437019.png)

## 4，小结

本文主要对rpc的历史，初始实现思想以及一次rpc的具体流程做了一个较为深入的分析。此外，对spark rpc实现涉及的一部分类也做了一个概括性说明。这也是一个开始，解下来，会陆续对spark的一些内部原理做较为深入的分析。

 

 

 

 

 

 

 

 

[1] https://wongxingjun.github.io/2016/12/08/Spark-RPC%E8%A7%A3%E8%AF%BB/

[2] http://shiyanjun.cn/archives/1545.html