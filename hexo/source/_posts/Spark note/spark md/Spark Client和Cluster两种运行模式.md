---
title: "Spark Client和Cluster两种运行模式的工作流程"
date: 2019-10-16 23:13:52
slug: "Spark Client和Cluster两种运行模式"
categories:
  - "Spark note"
  - "spark md"
---

# Spark Client和Cluster两种运行模式的工作流程

版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/SummerMangoZz/article/details/72627518

## 1. client mode:

 In `client` mode, the driver is launched in the same process as the client that submits the application.也就是说在Client模式下，Driver进程会在当前客户端启动，客户端进程一直存在直到应用程序运行结束。

该模式下的工作流程图主要如下：

![img](https://img-blog.csdn.net/20170522163622159?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvU3VtbWVyTWFuZ29aeg==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/Center)

工作流程如下：

​           1.启动master和worker . worker负责整个集群的资源管理，worker负责监控自己的cpu,内存信息并定时向master汇报

​           2.在client中启动Driver进程，并向master注册

​           3.master通过rpc与worker进行通信，通知worker启动一个或多个executor进程

​           4.executor进程向Driver注册，告知Driver自身的信息，包括所在节点的host等

​           5.Driver对job进行划分stage，并对stage进行更进一步的划分，将一条pipeline中的所有操作封装成一个task，并发送到向自己注册的executor

​              进程中的task线程中执行

​           6.应用程序执行完成，Driver进程退出

## 2. cluster mode：

In `cluster` mode, however, the driver is launched from one of the Worker processes inside the cluster, and the client process exits as soon as it fulfills its responsibility of submitting the application without waiting for the application to finish.

也就是说，在cluster模式下，Driver进程将会在集群中的一个worker中启动，而且客户端进程在完成自己提交任务的职责后，就可以退出，而不用等到应用程序执行完毕

该模式下的工作流程图如下：

![img](https://img-blog.csdn.net/20170522164941111?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvU3VtbWVyTWFuZ29aeg==/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/Center)

工作流程如下：

​            1.在集群的节点中，启动master , worker进程，worker进程启动成功后，会向Master进行注册。

​            2.客户端提交任务后，ActorSelection（master的actor引用）,然后通过ActorSelection给Master发送注册Driver请求（RequestSubmitDriver）

​            3.客户端提交任务后，master通知worker节点启动driver进程。(worker的选择是随意的，只要worker有足够的资源即可)

​               driver进程启动成功后，将向Master返回注册成功信息

​            4.master通知worker启动executor进程

​            5.启动成功后的executor进程向driver进行注册

​            6.Driver对job进行划分stage，并对stage进行更进一步的划分，将一条pipeline中的所有操作封装成一个task，并发送到向自己注册的executor

​              进程中的task线程中执行

​            7.所有task执行完毕后，程序结束。



通过上面的描述我们知道：Mater负责整个集群的资源的管理和创建worker，worker负责当前结点的资源的管理，并会将当前的cpu，内存等信息定时告知master,并且负责创建Executor进程(也就是最小额资源分配单位)，Driver负责整个应用任务的job的划分和stage的切割以及task的切割和优化，并负责把task分发到worker对应的节点的executor进程中的task线程中执行, 并获取task的执行结果，Driver通过SparkContext对象与spark集群获取联系，得到master主机host，就可以通过rpc向master注册自己。