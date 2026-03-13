---
title: "Spark RPC 通信机制"
date: 2020-06-07 18:01:15
categories:
  - "Spark note"
  - "spark md"
---

# Spark RPC 通信机制

[![img](https://upload.jianshu.io/users/upload_avatars/6112189/781f4fd2-269d-4722-ab2a-499f90f2e812?imageMogr2/auto-orient/strip|imageView2/1/w/96/h/96/format/webp)](https://www.jianshu.com/u/5e1464c67d6e)

[wangdy12](https://www.jianshu.com/u/5e1464c67d6e)关注

0.0722018.07.21 20:50:38字数 4,101阅读 1,356

## 相关概念

主要涉及RpcEnv，RpcEndpoint，RpcEndpointRef，其中RpcEnv是通信的基础，每个通信节点上都需要实现该类，其内部实现了消息的传输处理机制，RpcEndpoint表示一个可以接收RPC消息的对象，远程节点通过RpcEndpointRef向相应的RpcEndpoint发送消息

## RpcEnv

**RpcEnv** 抽象类表示一个 RPC Environment，管理着整个`RpcEndpoint`的生命周期，目前唯一的实现类是`NettyRpcEnv`，具体功能是

- 注册`RpcEndpoint`
- 将来自 `RpcEndpointRef`的消息发送给相应的`RpcEndpoint`

`RpcEnv`会在所有的通信节点上创建，例如master，worker，driver，executor都会创建一个RpcEnv

Driver端上的`RpcEnv`在SparkEnv初始化时创建:



```scala
    val systemName = if (isDriver) driverSystemName else executorSystemName
    val rpcEnv = RpcEnv.create(systemName, bindAddress, advertiseAddress, port.getOrElse(-1), conf,
      securityManager, numUsableCores, !isDriver)
RpcEnv.create`内部通过工厂方法创建`RpcEnv`，具体是通过实现`RpcEnvFactory`接口的`NettyRpcEnvFactory`工厂类，创建`RpcEnv`的具体实现类`NettyRpcEnv
```



```scala
  //指明该RpcEnv的名称，监听地址和端口
  def create(
      name: String,
      bindAddress: String,
      advertiseAddress: String,
      port: Int,
      conf: SparkConf,
      securityManager: SecurityManager,
      numUsableCores: Int,
      clientMode: Boolean): RpcEnv = {
    val config = RpcEnvConfig(conf, name, bindAddress, advertiseAddress, port, securityManager,
      numUsableCores, clientMode)
    new NettyRpcEnvFactory().create(config)
  }
```

### RpcEndpoint

**RpcEndPoint** 代表具体的通信节点，例如Master、Worker、CoarseGrainedSchedulerBackend中的DriverEndpoint、CoarseGrainedExecutorBackend等，都实现了该接口，在具体的函数中定义了消息传递来时的处理逻辑，整个生命周期是`constructor -> onStart -> receive* -> onStop`，即调用构造函数，然后向RpcEnv注册，内部调用onStart,之后如果收到消息，RpcEnv会调用`receive*`方法，结束时调用onStop方法



```scala
private[spark] trait RpcEndpoint {
  // 当前RpcEndpoint注册的RpcEnv
  val rpcEnv: RpcEnv
  // 获取该RpcEndpoint对应的RpcEndpointRef
  final def self: RpcEndpointRef

  // 处理RpcEndpointRef.send发送的消息
  def receive: PartialFunction[Any, Unit]
  // 处理RpcEndpointRef.ask发送的消息,通过RpcCallContext返回消息或异常
  def receiveAndReply(context: RpcCallContext): PartialFunction[Any, Unit]

  //一系列的回调函数
  def onError(cause: Throwable): Unit
  def onConnected(remoteAddress: RpcAddress): Unit
  def onDisconnected(remoteAddress: RpcAddress): Unit
  def onNetworkError(cause: Throwable, remoteAddress: RpcAddress): Unit
  def onStart(): Unit
  def onStop(): Unit

  // 停止RpcEndpoint
  final def stop(): Unit 
}
```

它的子类是`ThreadSafeRpcEndpoint`，Spark中实现的Endpoint大多是继承这个类，应该线程安全的处理消息，即`RpcEnv`中的`Dispatcher`在处理该`Endpoint`对应的`Inbox`内的消息时，只能单线程处理消息，不能进行多线程同时处理多个消息

### RpcEndpointRef

**RpcEndPointRef** 是对远程RpcEndpoint的一个引用，内部记录了RpcEndpoint的位置信息



```scala
private[spark] abstract class RpcEndpointRef(conf: SparkConf)
  extends Serializable with Logging {
  // 最大重连次数(3)，重新尝试的等待事件(3s)，默认的超时事件(120s)
  private[this] val maxRetries = RpcUtils.numRetries(conf)
  private[this] val retryWaitMs = RpcUtils.retryWaitMs(conf)
  private[this] val defaultAskTimeout = RpcUtils.askRpcTimeout(conf)

  // 对应RpcEndpoint的地址，名称
  def address: RpcAddress
  def name: String

  // 发送一个消息
  def send(message: Any): Unit
  // 发送消息到相应的`RpcEndpoint.receiveAndReply`，异步
  def ask[T: ClassTag](message: Any, timeout: RpcTimeout): Future[T]
  // 发送消息到相应的`RpcEndpoint.receiveAndReply`，阻塞等待回复的结果
  def askSync[T: ClassTag](message: Any): T
  ....
}
```

### 地址表示

- `RpcAddress(host: String, port: Int)`：Rpc environment的地址
- `RpcEndpointAddress(rpcAddress: RpcAddress, name: String)`：RPC endpoint的地址，其中的rpcAddress指的是endpoint所在的RpcEnv地址，name指的是endpoint的名称

------

## NettyRpcEnv实现

### NettyRpcEnvFactory

- 通过`RpcEnvConfig`创建`NettyRpcEnv`
- 如果非`clientMode`，在特定的地址和端口上启动服务端`startServer(bindAddress: String, port: Int)`

### NettyRpcEnv

内部涉及的部分字段和函数如下：



```scala
private[netty] class NettyRpcEnv(
    val conf: SparkConf,
    //JavaSerializerInstance可以在多线性情况下运行
    javaSerializerInstance: JavaSerializerInstance,
    host: String,
    securityManager: SecurityManager,
    numUsableCores: Int) extends RpcEnv(conf) with Logging {

  private[netty] val transportConf : TransportConf 传输上下文的配置信息，其中默认的netty线程数目为8
  private val dispatcher: Dispatcher 消息分发器，负责将RPC消息发送到对应的endpoint
  private val streamManager : NettyStreamManager 用于文件传输
  private val transportContext : TransportContext 传输的核心，用来创建TransportServer和TransportClientFactory
  private val clientFactory : TransportClientFactory 用来创建TransportClient
  @volatile private var fileDownloadFactory: TransportClientFactory 用来创建用于file下载的TransportClient，使得与主RPC传输分离
  val timeoutScheduler : ScheduledThreadPoolExecutor 线程池，超时控制相关
  private[netty] val clientConnectionExecutor：ThreadPoolExecutor 客户端连接线程池，线程池默认最大线程数目64
  @volatile private var server: TransportServer
  // 向远程RpcAddress发送消息时，将消息放到相应的Outbox中即可
  private val outboxes = new ConcurrentHashMap[RpcAddress, Outbox]()

  // 在特定地址端口上启动服务 即创建一个TransportServer
  def startServer(bindAddress: String, port: Int): Unit
  //该RpcEnv监听的地址 地址+端口
  def address: RpcAddress
  //注册RpcEndpoint,返回RpcEndpointRef
  def setupEndpoint(name: String, endpoint: RpcEndpoint): RpcEndpointRef
  //检索出对应的RpcEndpointRef
  def setupEndpointRef(address: RpcAddress, endpointName: String): RpcEndpointRef
  // 获取RpcEndpoint对应的RpcEndpointRef
  private[rpc] def endpointRef(endpoint: RpcEndpoint): RpcEndpointRef
  // 等待RpcEnv退出
  def awaitTermination(): Unit
}
```

#### Dispatcher

进行消息的异步处理，内部有一个线程池，每个线程执行*MessageLoop*任务，不停将放置在阻塞队列中`receivers`中的`EndpointData`消息取出分发到相应的endpoint，如果为`PoisonPill`消息，关闭线程池

其内部记录了该节点上所有的`RpcEndpoint`



```scala
  private val endpoints: ConcurrentMap[String, EndpointData]
  private val endpointRefs: ConcurrentMap[RpcEndpoint, RpcEndpointRef]
  // 存储EndpointData数据的阻塞队列
  private val receivers = new LinkedBlockingQueue[EndpointData]
  // 创建一个线程名前缀名称为dispatcher-event-loop的线程池，默认线程数目是JVM可获取的核数与2的最大值，用来处理消息InboxMessage
  private val threadpool: ThreadPoolExecutor

  // 注册RpcEndpoint 将相关信息添加到endpoints和endpointRefs，receivers集合中
  def registerRpcEndpoint(name: String, endpoint: RpcEndpoint)
  // 是否存在该endpoint
  def verify(name: String): Boolean

  // 内部的线程池，如果没有指定线程数目，使用核数作为线程数目
  private val threadpool: ThreadPoolExecutor = {
    val availableCores =
      if (numUsableCores > 0) numUsableCores else Runtime.getRuntime.availableProcessors()
    val numThreads = nettyEnv.conf.getInt("spark.rpc.netty.dispatcher.numThreads",
      math.max(2, availableCores))
    val pool = ThreadUtils.newDaemonFixedThreadPool(numThreads, "dispatcher-event-loop")
    for (i <- 0 until numThreads) {
      pool.execute(new MessageLoop)
    }
    pool
  }
```

#### EndpointData

每个endpoint都有一个对应的`EndpointData`，`EndpointData`内部包含了`RpcEndpoint`、`NettyRpcEndpointRef`信息，与一个`Inbox`，收信箱`Inbox`内部有一个`InboxMessage`链表，发送到该endpoint的消息，就是添加到该链表，同时将整个`EndpointData`添加Dispatcher到阻塞队列`receivers`中，由Dispatcher线程异步处理

```
InboxMessage`是`Inbox`内的消息，所有的RPC消息都继承自`InboxMessage
```

- OneWayMessage：不需要Endpoint回复的消息
- RpcMessage：需要Endpoint回复的消息
- OnStart：`Inbox`实例化后自动添加一个`OnStart`，用于通知对应的RpcEndpoint启动
- OnStop：用于关闭对应的RpcEndpoint
- RemoteProcessConnected、RemoteProcessDisconnected、RemoteProcessConnectionError：告诉所有的endpoints,远程连接状态相关的信息

#### 注册RpcEndpoint

NettyRpcEnv内注册RpcEndpoint



```scala
  override def setupEndpoint(name: String, endpoint: RpcEndpoint): RpcEndpointRef = {
    dispatcher.registerRpcEndpoint(name, endpoint)
  }
```

`Dispatcher.registerRpcEndpoint`调用：

- 创建`RpcEndpointAddress`，记录endpoint的地址，端口，名称
- 创建一个对应的`RpcEndpointRef`
- 创建一个`EndpointData`（内部的Inbox内在构造时会放入OnStart消息）,放入endpoints缓存
- 记录`RpcEndpoint`和`RpcEndpointRef`的映射关系到endpointRefs缓存
- 将`EndpointData`放入阻塞队列`receives`，分发器异步调用对应的`OnStart`函数
- 返回`RpcEndpointRef`

#### RpcCallContext

当发送的消息类型是`RpcMessage`时，需要回复消息，需要在其中封装`NettyRpcCallContext`，用来向客户端发送消息



```java
private[spark] trait RpcCallContext {
  // 回复消息给发送方
  def reply(response: Any): Unit
  // 回复失败给发送方
  def sendFailure(e: Throwable): Unit
  // 获取发送方地址
  def senderAddress: RpcAddress
}
```

`NettyRpcCallContext`为实现`RpcCallContext`接口的抽象类，有两个具体的实现类

- LocalNettyRpcCallContext : 接收方和发送方在地址相同，即同一进程，直接通过Promise进行回调
- RemoteNettyRpcCallContext ： 不在一起的时候，使用远程连接式的回调

------

### TransportContext

传输上下文TransportContext，内部包含传输配置信息TransportConf，以及对收到的RPC消息进行处理的RpcHandler，用来创建TransportServer和TransportClientFactory，底层依赖Netty实现

> Netty中的相关概念：
> 每个`Channel`都有一个 `ChannelPipeline`，在Channel创建时会被自动创建
>
> - ChannelPipeline：内部有一个由`ChannelHandlerContext`组成的双向链表，每个`ChannelHandlerContext`对应一个`ChannelHandler`
> - ChannelHandler：处理I/O事件或拦截I/O操作，并将其转发到`ChannelPipeline`中的下一个ChannelHandler，子接口`ChannelOutboundHandler`、`ChannelInboundHandler`分别用于处理发送和接收的I/O

#### TransportConf

传输上下文的配置信息，使用`SparkTransportConf.fromSparkConf`方法来构造

内部实际使用的是一份克隆的`SparkConf`存储配置属性，默认分配给网络传输的IO线程数是系统可用处理器的数量，但线程数目最多为8，最终确定的线程数将被用于设置客户端传输线程数（`spark.$module.io.clientThreads`）和服务端传输线程数（`spark.$module.io.serverThreads`），此外还将`spark.rpc.io.numConnectionsPerPeer`属性设置为1

内部包含大量io相关的配置属性，及其默认值，例如IO模式，缓存大小，线程数目等，属性名称为`"spark." + 模块名称 + "." + 后缀`，其中模块名称为`rpc`,在`NettyRpcEnv`中创建TransportConf时指定

#### TransportClientFactory

由`TransportContext.createClientFactory`方法创建，是用来创建TransportClient的工厂类，内部包含一个连接池`ConcurrentHashMap connectionPool`，进行缓存，方便重复使用

连接池中每个SocketAddress对应一个客户端池`ClientPool`，其内有一个`TransportClient`数组，数组大大小由`spark.rpc.io.numConnectionsPerPeer`指定，即本节点和远程节点建立的连接数目，默认为1

TransportClientFactory构造函数中包含内部Netty客户端相关的配置,具体类型取决于ioMode：NIO或者EPOLL（Java NIO 在Linux下默认使用的就是epoll）

- 事件处理：NioEventLoopGroup/EpollEventLoopGroup
- 通道：NioSocketChannel/EpollSocketChannel
- 缓存分配器：PooledByteBufAllocator

每个`TransportClient`和一个远程地址通信，由`TransportClientFactory`创建，流程如下

- 通过host和port构造未解析的远程连接地址`InetSocketAddress`
- 从连接池`connectionPool`中获取该地址对应的`ClientPool`，为空则初始化一个客户端池
- 从`ClientPool`中随机选取一个`TransportClient`
- 如果`TransportClient`不为空并且处于活跃状态，更新该客户端的最后一次请求事件，直接返回该`TransportClient`
- 否则创建一个新的`TransportClient`

![img](https://upload-images.jianshu.io/upload_images/6112189-f4e72c35d40b790b?imageMogr2/auto-orient/strip|imageView2/2/w/1046/format/webp)

image

Channel中处理 I/O 事件的ChanelHandler核心是`TransportChannelHandler`，此外还有编解码相关和空闲状态检查相关的handler

#### TransportClientBootstrap

```
TransportClientFactory`创建Client成功连接到远程服务端以后，先执行引导程序，主要用来进行初始信息交互，例如`SaslClientBootstrap`进行SASL认证，完成后才会返回该新建的`TransportClient
```

#### TransportClient

`TransportClient`内部包含一个通道`Channel`，以及一个`TransportResponseHandler`，此类用于向服务器发出请求，而`TransportResponseHandler`负责处理来自服务器的响应，是线程安全的，可以从多个线程调用

client用来发送五种`RequestMessage`：ChunkFetchRequest、OneWayMessage、RpcRequest、StreamRequest、UploadStream

- 发送RPC请求`sendRpc`：每个`RpcRequest`对应一个使用UUID生成的requestId，将requestId与对应的`RpcResponseCallback`映射关系记录到`TransportResponseHandler`的`outstandingRpcs`字段中，当收到返回消息时调用相应的回调，主要功能是通过`Channel.writeAndFlush`将RPC请求发送出去
- 请求块数据`fetchChunk`：首先使用流的标记和块的索引创建`StreamChunkId`，向`TransportResponseHandler`的`outstandingFetches`添加索引与`ChunkReceivedCallback`回调的映射关系，使用`channel.writeAndFlush`发送`ChunkFetchRequest`请求，接收到服务器端的相应时，执行相应的回调
- 请求流数据`stream`：在`TransportResponseHandler`的`streamCallbacks`添加`streamId`与`StreamCallback`回调的映射关系，发送`StreamRequest`请求，收到响应时执行对应的回调
- 发送不需要回复的数据`send`，直接通过`Channel.writeAndFlush`发送`OneWayMessage`
- 发送流数据`uploadStream`：发送`UploadStream`数据流到远端

#### TransportServerBootstrap

当客户端和服务器建立连接后，在服务端对应的管道上运行的引导程序

#### TransportServer

RPC框架的服务端，只要`RpcEnvConfig.clientMode`不为ture，都会启动服务

调用`TransportServer.startServer`启动服务，通过`TransportContext.createServer`创建服务端，然后内部会向`NettyRpcEnv`的`dispatcher`中注册本身的`RpcEndpoint`,名称为*endpoint-verifier*，类型为`RpcEndpointVerifier`

它的作用是，当远程节点需要创建该RpcEnv上的Endpoint的一个引用时(`setupEndpointRef`方法)，因为每个RpcEnv上都有`RpcEndpointVerifier`，所以远端可以直接创建一个`RpcEndpointVerifier`对应的ref，通过它发送`CheckExistence(name: String)`消息，查询该dispatcher内部的endpoints缓存中是否存在的名称为name的endpoint,从而确定是否可以创建该`RpcEndpointRef`

`TransportServer`内部包含的变量如下：

- context:传输上下文TransportContext，用来配置channelHandler
- conf:传输配置TransportContext
- appRpcHandler:RPC请求处理器RpcHandler
- bootstraps:TransportServerBootstrap类型，当客户端连接到服务器端时，在通道创建时执行的引导程序

其创建过程就是标准的netty服务端创建方式，对于已经链接进来的client Chanel，ChanelHandler的配置和客户端配置类似

#### RpcHandler

对`TransportClient.sendRpc`发送的RPC消息进行处理，内部通过Dispatcher将收到的RPC分发到对应的Endpoint



```java
// RpcHandler部分定义
public abstract class RpcHandler {
  // 接收一个RPC消息，具体逻辑执行由子类实现，处理完成后通过RpcResponseCallback回调，如果不需要回调返回消息的，传入参数为OneWayRpcCallback，只打印日志
  public abstract void receive(
      TransportClient client,
      ByteBuffer message,
      RpcResponseCallback callback);

  // 获取StreamManager
  public abstract StreamManager getStreamManager();
  // Channel处于活跃状态时调用
  public void channelActive(TransportClient client) { }
  // 非活跃状态时调用
  public void channelInactive(TransportClient client) { }
  // 产生异常时调用
  public void exceptionCaught(Throwable cause, TransportClient client) { }
  ...
}
```

`NettyStreamManager`用于提供`NettyRpcEnv`的文件流服务，可以将文件，目录和jar包注册到其中，然后根据请求，将相应文件的信息封装为`FileSegmentManagedBuffer`，可以用来处理`StreamRequest`类型的消息

#### 管道初始化

管道初始化过程中都使用了`TransportContext.initializePipeline`创建的`TransportChannelHandler`

`TransportChannelHandler`是单个传输层的通道handler，用于将请求委派给`TransportRequestHandler`并响应`TransportResponseHandler`。在传输层中创建的所有通道都是双向的。当客户端使用`RequestMessage`发送给Netty通道（由服务器的RequestHandler处理）时，服务器将生成`ResponseMessage`（由客户端的ResponseHandler处理）。但是，服务器也会在同一个Channel上获取句柄，因此它可能会向客户端发送`RequestMessages`。这意味着客户端还需要一个`RequestHandler`，而Server需要一个`ResponseHandler`，用于客户端对服务器请求的响应进行响应。

此类还处理来自`io.netty.handler.timeout.IdleStateHandler`的超时信息。如果存在未完成的提取`fetch`或RPC请求但是在“requestTimeoutMs”时间内通道上没有的流量，我们认为连接超时。注意这是双工通道;如果客户端不断发送但是没有响应，为简单起见不认为是超时

`TransportChannelHandler`内部使用`MessageHandler`处理`Message`，其中`MessageHandler`有两种类型，分别用来处理客户端请求/处理服务端的响应，`Message`共有10种类型

#### TransportRequestHandler

处理客户端的五种请求信息`RequestMessage`，内部包含`RpcHandler`处理RPC信息，`TransportClient`用来和请求方通信

- `RpcRequest`:通过`RpcHandler`接收请求，实际类型为`NettyRpcHandler`，这里将`ByteBuffer`类型的RPC请求转换为`RequestMessage`，加入到对应endpoint的inbox内，由Dispatcher负责处理，通过`RpcResponseCallback`回复`RpcResponse/RpcFailure`
- `OneWayMessage`:类似前一种情况，最后不对客户端进行回复
- `ChunkFetchRequest`：通过`StreamManager.getChunk`处理要请求的数据块，同时返回结果描述`ChunkFetchSuccess/ChunkFetchFailure`
- `StreamRequest`:通过`StreamManager.openStream`获取请求的流数据，最后返回结果`StreamResponse/StreamFailure`给客户端
- `UploadStream`:处理客户端上传的流

`SaslServerBootstrap`类型的引导首先会对服务器端的`RPCHandler`进行代理，与客户端进行认证交互，认证成功后，将加解密的Handler添加到通道的Pipeline中，后续的消息交给被代理的`RPCHandler`进行代理

#### TransportResponseHandler

处理服务端对请求的响应，内部会记录需要回复的请求的ID，以及对应的callback函数，一共由六种`ResponseMessage`，根据消息类型和ID，执行响应的回调

- ChunkFetchFailure
- ChunkFetchSuccess
- RpcFailure
- RpcResponse
- StreamFailure
- StreamResponse

#### 其他ChannelHandler

- MessageEncoder:对`Message`进行编码，frame格式如下



```void
length(long类型，消息长度，8字节)|message type(消息类型，1个字节)|message meta(消息元数据，例如RpcRequest消息的元数据长度为12，包括requestId和消息体长度bodysize)|message body(消息体，具体的信息，例如ChunkFetchSuccess中的块数据)
```

- MessageDecoder：解码，从中获取消息类型，和消息内容，创建对应的消息
- TransportFrameDecoder:处理TCP中的粘包拆包，得到一个完整的消息，内部主要依靠的就是每个frame前8个字节，表示整个frame的长度
- IdleStateHandler：实现心跳功能，触发IdleStateEvent事件，当通道内没有执行读取，写入操作时，底层通过向线程任务队列中添加定时任务，如果空闲超时，则会触发`TransportChannelHandler.userEventTriggered`方法。在这个方法如果确认超时，会关闭通道

#### Outbox

可以理解为发出消息的盒子，每个地址对应个盒子

NettyRpcEnv中`outboxes : ConcurrentHashMap[RpcAddress, Outbox]`字段，每个远程`RpcAddress`对应一个`Outbox`,`OutBox`其内部包含一个`OutboxMessage`的链表，所有向远端发送的消息都要封装为`OutboxMessage`

调用`Outbox.send`方法发送消息时，将消息添加到`OutboxMessage`链表中，如果远程连接还未建立，会先通过NettyRpcEnv中的`clientConnectionExecutor`线程池执行建立连接的任务，即创建特定`RpcAddress`上的`TransportClient`，然后发送消息

`OutboxMessage`有两个子类，`OneWayOutboxMessage`和`RpcOutboxMessage`，表明不会有回复和存在回复两种消息类型，分别对应调用RpcEndpoint的`receive`和`receiveAndReply`方法，当`TransportClient`发送消息时，如果Message是`RpcOutboxMessage`，先会创建一个UUID，底层`TransportResponseHandler`维护一个发送消息ID与其Callback的HashMap，当Netty收到完整的远程RpcResponse时候，做反序列化，回调相应的Callback，进而执行Spark中的业务逻辑，即Promise/Future的响应

![img](https://upload-images.jianshu.io/upload_images/6112189-100a1872b14f7dc9.png?imageMogr2/auto-orient/strip|imageView2/2/w/834/format/webp)

Rpc底层通信框架

------

### 实际流程分析

当通过`RpcEndpointRef`发送需要回复的消息时：

- RpcEndpointRef.ask
- NettyRpcEndpointRef.ask 构建`RequestMessage(senderAddress,receiver,message content)`

如果远程地址与当前NettyRpcEnv相同：

- NettyRpcEnv.ask，创建一个`Promise`对象，设定`Future`完成后的回调
- Dispatcher.postLocalMessage，构建`RpcMessage`和回调上下文`LocalNettyRpcCallContext`
- Dispatcher.postMessage，将`RequestMessage`消息重构成`RpcMessage`，放置到对应endpoint的inbox内，dispatcher内部的线程池会取出消息，然后根据消息类型，执行不同的操作，调用endpoint的`receiveAndReply`，内部回调`RpcCallContext.reply`返回结果

如果需要连接远程地址时：

- NettyRpcEnv.ask，将`RequestMessage`序列化，构造一个`RpcOutboxMessage`，设定消息成功和失败时对应的的回调
- NettyRpcEnv.postToOutbox,如果尚未创建对应的TransportClient，将消息放入目的地址相应的`Outbox`，必要时新建`Outbox`以及对应的`TransportClient`
- 通过`message.sendWith(client)`调用`TransportClient.sendRpc`发送`RpcRequest`消息，记录该requestId对应的回调`RpcResponseCallback`，用来收到回复后调用

上述步骤都是异步执行的，当将消息放置到相应位置后，就会返回，然后：

- 使用`timeoutScheduler`设定一个计时器，用于超时处理，超时抛出`TimeoutException`异常

> 在Spark 1.6之前，底层使用的Akka进行PRC，它是基于Actor的RPC通信系统，但是无法适用大的package/stream的数据传输，所以还有Netty通信框架，所以将两套通信框架合并统一使用netty，并且akka使用时版本必须保证一致，否则会出现很多问题。但是RpcEnv参照了Akka的思路，内部原理基本一致，都是按照MailBox的设计思路来实现的

![img](https://upload-images.jianshu.io/upload_images/6112189-983e2815d1b57267.jpg?imageMogr2/auto-orient/strip|imageView2/2/w/443/format/webp)

image

## 参考

- [这可能是目前最透彻的Netty原理架构解析](https://mp.weixin.qq.com/s/YS_RLOd0iVwDcwH6JMyB8g)
- [Netty 源码分析之 一 揭开 Bootstrap 神秘的红盖头 (客户端)](https://segmentfault.com/a/1190000007282789#articleHeader0)
- [深入解析Spark中的RPC](https://blog.csdn.net/imgxr/article/details/80131262)
- [Spark 底层网络模块](http://sharkdtu.com/posts/spark-network.html)
- [Spark为何使用Netty通信框架替代Akka](http://www.aboutyun.com/thread-21115-1-1.html)

其他Spark源码分析，记录在[GitBook](https://legacy.gitbook.com/book/wangdy12/spark/details)