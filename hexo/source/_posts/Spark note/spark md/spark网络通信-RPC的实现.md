---
title: "spark网络通信-RPC的实现"
date: 2020-06-07 18:00:38
cover: "https://cdn2.jianshu.io/assets/default_avatar/3-9a2bcc21a5d89e21dafc73b39dc5f582.jpg"
categories:
  - "Spark note"
  - "spark md"
---

# spark网络通信-RPC的实现

[![img](https://cdn2.jianshu.io/assets/default_avatar/3-9a2bcc21a5d89e21dafc73b39dc5f582.jpg)](https://www.jianshu.com/u/f4e75f0b430b)

[aaron1993](https://www.jianshu.com/u/f4e75f0b430b)关注

2017.05.01 14:22:35字数 2,585阅读 1,636

*本文基于spark源码2.11*

# 1. 概要

spark中网络通信无处不在，例如

- driver和master的通信，比如driver会想master发送RegisterApplication消息
- master和worker的通信，比如worker会向master上报worker上运行Executor信息
- executor和driver的的通信，executor运行在worker上，spark的tasks被分发到运行在各个executor中，executor需要通过向driver发送任务运行结果。
- worker和worker的通信，task运行期间需要从其他地方fetch数据，这些数据是由运行在其他worker上的executor上的task产生，因此需要到worker上fetch数据

总结起来通信主要存在两个方面：

1. 汇集信息，例如task变化信息，executor状态变化信息。
2. 传输数据，spark shuffle（也就是reduce从上游map的输出中汇集输入数据）阶段存在大量的数据传输。

在spark中这两种采用了不同的实现方式，对于 1 spark基于netty实现了简单的rpc服务框架，对于 2 同样基于netty实现了数据传输服务。

## 2. 基于netty的rpc实现

rpc两端称为endpoint，提供服务的一端需要实现RpcEndpoint接口，该接口主要下面两个方法：



```jsx
 def receive: PartialFunction[Any, Unit] = {
    case _ => throw new SparkException(self + " does not implement 'receive'")
  }

  def receiveAndReply(context: RpcCallContext): PartialFunction[Any, Unit] = {
    case _ => context.sendFailure(new SparkException(self + " won't reply anything"))
  }
```

实现这两个方法，完成对消息的处理，这辆个方法不同之处在于receiveAndReply可以通过context向服务请求这回复。实现这个接口之后，实例化，然后注册实例。请求服务的一方需要注册的只是EndpointRef，通过EndpointRef发起服务请求。

spark中需要提供rpc服务的地方主要有：

1. MapoutTracker，MapoutTracker有两个实现类：MapoutTrackerMaster和MapoutTrackerWorker。前者运行在Driver端，后者运行在每一个executor上，两者通信用来保存ShuffleMapTask的map输出数据信息。MapoutTrackerMaster持有MapoutTrackerMasterEndpoint接收信息，MapoutTrackerWorker持有EndpointRef回报map out信息
2. BlockManager，BlockManager负责spark运行期间的数据信息的收集以及存与取，BlockManager运行在Driver和每一个executor上，BlockManager持有BlockManagerMaster，在Driver上BlockManagerMaster持有BlockManagerMasterEndpoint，executor上持有EndpointRef，executor调用blockmanager汇报信息，实际上是通过endpointref汇集到driver上。
3. StandaloneAppClient，ScheduleBackend持有它（standalone模式下，实例话为CoarseGrainedSchedulerBackend），在standalone部署模式下，driver通过它来与master通信
4. DriverEndpoint，ScheduleBackend（standalone模式下，实例话为CoarseGrainedSchedulerBackend）用来与executor通信，收集executor信息，收集task变化信息
5. Worker,Master，维持心跳，运行executor，运行task
6. CoarseGrainedExecutorBackend，每一个executor对应一个，和driver通信运行或取消任务等

### 2.1 注册服务

下面是SparkEnv在初始化过程中注册MapMapOutputTrackerMasterEndpoint的代码：



```dart
def registerOrLookupEndpoint(
        name: String, endpointCreator: => RpcEndpoint):
      RpcEndpointRef = {
      if (isDriver) {
        logInfo("Registering " + name)
        rpcEnv.setupEndpoint(name, endpointCreator)
      } else {
        RpcUtils.makeDriverRef(name, conf, rpcEnv)
      }
    }

 
mapOutputTracker.trackerEndpoint = 
      registerOrLookupEndpoint(
             MapOutputTracker.ENDPOINT_NAME,
             new MapOutputTrackerMasterEndpoint(
                     rpcEnv, 
                     mapOutputTracker.asInstanceOf[MapOutputTrackerMaster], conf))
```

调用`registerOrLookupEndpoint`完成注册，并且返回一个endpointref，通过endpointref发送请求。registerOrLookupEndpoint接收一个参数name，用来标识一个rpc服务。

registerOrLookupEndpoint在driver端和worker上有不同的处理方式，在driver端创建出endpoint的实例，并注册该实例提供服务，在非driver端则创建一个endpointref返回供rpc请求端发送请求时使用。下面是RpcEndpointRef类的核心属性和方法：



```ruby
private[spark] abstract class RpcEndpointRef(conf: SparkConf)
  def address: RpcAddress
  def name: String
  def send(message: Any): Unit
  def ask[T: ClassTag](message: Any, timeout: RpcTimeout): Future[T]
  def askSync[T: ClassTag](message: Any, timeout: RpcTimeout): T 
```

- name返回的就是在注册rpc服务时的提供的名字。
- address 是服务提供方的host,port。
- send，ask方法用来发送请求，区别是send没有不需要response,ask则需要。

只看在driver上是如何注册服务的，调用rpcEnv.setupEndpoint注册服务，这里的rpcEnv实际上是实例NettyRpcEnv。

下面的图是NettyRpcEnv一张结构图：

![img](https://upload-images.jianshu.io/upload_images/3009881-777f794df8f0ca9d.png?imageMogr2/auto-orient/strip|imageView2/2/w/1200/format/webp)

spark网络.png

#### 2.1.1 服务端

创建SparkEnv时，调用`val rpcEnv = RpcEnv.create(...)`,这个方法调用NettyRpcEnvFactory#create创建NettyRpcEnv的实例。create方法判断如果实在driver端，则创建TransportServer，调用链路是：



```css
NettyRpcEnvFactory#create#创建nettyrpcenv -> NettyRpcEnv#startServer -> 
TransportContext#createServer()#创建TransportServer监听端口提供服务
```

**# NettyRpcEnv**
SparkEnv持有rpcEnv是NettyRpcEnv的实例，下面的NettyRpcEnv的核心的属性方法：



```kotlin
private val dispatcher: Dispatcher = new Dispatcher(this)

private val streamManager = new NettyStreamManager(this)

private val transportContext = new TransportContext(transportConf,
    new NettyRpcHandler(dispatcher, this, streamManager))

private val outboxes = new ConcurrentHashMap[RpcAddress, Outbox]()
```

1. dispatcher, endpoint服务注册到dispatcher上，请求服务时指定name请求服务，dispatcher根据name将消息转发到对应的endpoint。
2. transportContext，用来创建TransportServer监听端口接收消息。
3. outboxes，每一个endpointref都包装了RpcAddress表示endpoint地址，上图中通过send/ask请求某个endpoint的服务时，消息都会先发送到Outbox中，outboxes缓存了一个endpoint到其outbox的映射，方便查找，下面代码是Outbox类的一些成员。



```kotlin
private[netty] class Outbox(nettyEnv: NettyRpcEnv, val address: RpcAddress) {
 // 使用队列保存要发送出去的消息
  private val messages = new java.util.LinkedList[OutboxMessage]
// 本次发送者client，TransportClient下一节介绍
  private var client: TransportClient = null
```

**# Dispatcher**
endpointref注册在dispatcher上， TransportServer端最后的NettyRpcHandler接收到处理完消息后通过dispathcer转发到具体的endpoint上。下面是Dispatcher类：



```kotlin
private[netty] class Dispatcher(nettyEnv: NettyRpcEnv) extends Logging {

  private class EndpointData(
      val name: String,
      val endpoint: RpcEndpoint,
      val ref: NettyRpcEndpointRef) {
    val inbox = new Inbox(ref, endpoint)
  }


  private val endpoints: ConcurrentMap[String, EndpointData] =
    new ConcurrentHashMap[String, EndpointData]
  private val endpointRefs: ConcurrentMap[RpcEndpoint, RpcEndpointRef] =
    new ConcurrentHashMap[RpcEndpoint, RpcEndpointRef]

  // Track the receivers whose inboxes may contain messages.
  private val receivers = new LinkedBlockingQueue[EndpointData]
```

1. endpoints是name（注册时提供的服务名称）到endpointdata的映
   射。
2. Inbox, 前面的图中TransportServer端接收到的消息，dispatcher根据name从endpoints中检索到之后放到对应的inbox中
3. receivers，dispatcher接收到数据，dispatch到各自的inbox中之后，并不会马上调用endpoint处理，而是在另外一个线程MessageLoop中专门处理，receivers保存了收到消息的endpoint所属的endpointdata，MessageLoop即根据receivers中的成员知道要调用哪些endpoint的处理逻辑。

**# TransportServer**
TranportContext#createServer创建了一个基于Netty的server监听端口提供服务. 下面是创建TransportServer的过程：

1. transportContext的创建，这在NettyRpcEnv创建过程中创建，创建方式：



```cpp
  private val transportContext = new TransportContext(transportConf,
    new NettyRpcHandler(dispatcher, this, streamManager))
```

并使用了NettyRpcHandler的实例作参数，NettyRpcHandler是服务端管道最后一个handler，也就是在其handle方法中调用dispatcher完成消息转发

1. 调用 `transportContext#createServer(bindAddress, port, bootstraps)` ，bindAddress和port即rpc监听的地址和端口，这两个是由配置文件中`spark.driver.bindAddress`和`spark.driver.port`指定
2. 2中createServer最终调用TransportServer.init()初始化一个TransportServer，下面是init方法



```java
private void init(String hostToBind, int portToBind) {

    IOMode ioMode = IOMode.valueOf(conf.ioMode());
    EventLoopGroup bossGroup =
      NettyUtils.createEventLoop(ioMode, conf.serverThreads(), conf.getModuleName() + "-server");
    EventLoopGroup workerGroup = bossGroup;

    bootstrap = new ServerBootstrap()
      .group(bossGroup, workerGroup)
      .channel(NettyUtils.getServerChannelClass(ioMode))
      .option(ChannelOption.ALLOCATOR, allocator)
      .childOption(ChannelOption.ALLOCATOR, allocator);
...
...
...
    bootstrap.childHandler(new ChannelInitializer<SocketChannel>() {
      @Override
      protected void initChannel(SocketChannel ch) throws Exception {
        RpcHandler rpcHandler = appRpcHandler;
        for (TransportServerBootstrap bootstrap : bootstraps) {
          rpcHandler = bootstrap.doBootstrap(ch, rpcHandler);
        }
        context.initializePipeline(ch, rpcHandler);
      }
    });

    InetSocketAddress address = hostToBind == null ?
        new InetSocketAddress(portToBind): new InetSocketAddress(hostToBind, portToBind);
    channelFuture = bootstrap.bind(address);
    channelFuture.syncUninterruptibly();

    port = ((InetSocketAddress) channelFuture.channel().localAddress()).getPort();
    logger.debug("Shuffle server started on port: {}", port);
  }
```

这是netty创建服务端的用法，每一个client的链接被看作一个channel，channel上可以注册多个handler，消息从channel流进流出，被一个个注册在channel上的handler处理，到达用户层面或者被发送至网络。bootstrap.childHandler方法，就是用来初始化一个新的client连接生成的channel。

`context.initializePipeline(ch, rpcHandler);`（此处的rpcHandler就是NettyRpcHandler）对channel进行初始化，也就是注册handler，下面是initializePipeline的代码：



```cpp
public TransportChannelHandler initializePipeline(
      SocketChannel channel,
      RpcHandler channelRpcHandler) {
    try {
      TransportChannelHandler channelHandler = createChannelHandler(channel, channelRpcHandler);
      channel.pipeline()
        .addLast("encoder", ENCODER)
        .addLast(TransportFrameDecoder.HANDLER_NAME, NettyUtils.createFrameDecoder())
        .addLast("decoder", DECODER)
        .addLast("idleStateHandler", new IdleStateHandler(0, 0, conf.connectionTimeoutMs() / 1000))
        // NOTE: Chunks are currently guaranteed to be returned in the order of request, but this
        // would require more logic to guarantee if this were not part of the same event loop.
        .addLast("handler", channelHandler);
      return channelHandler;
    } catch (RuntimeException e) {
      logger.error("Error while initializing Netty pipeline", e);
      throw e;
    }
  }
```

注册ENCODER，DECODER，channelHandler（包含前图中TransportRequestHandler和TransportReponseHandler分别用来处理请求消息和回复消息）

** # 消息接收流程**
以`OneWayMessage`为例，这种消息不需要response。服务端接收到消息，经过如下处理步骤：

1. 由Decoder(MessageDecoder的实例)做decode处理，生成OneWayMessage
2. 交给TransportRequestHandler处理，这个handler直接交给rpcHandler#receive（NettyRpcHandler）处理
3. NettyRpcHandler#receive调用 `dispatcher.postOneWayMessage(messageToDispatch)`，消息转到Dispatcher。
4. Dispathcer#postOneWayMessage, 最终调用Dispatcher#postMessage,代码如下：



```kotlin
private def postMessage(
      endpointName: String,
      message: InboxMessage,
      callbackIfStopped: (Exception) => Unit): Unit = {
    val error = synchronized {
      // 根据请求的endpoint name找到endpoint
      val data = endpoints.get(endpointName)
      if (stopped) {
        Some(new RpcEnvStoppedException())
      } else if (data == null) {
        Some(new SparkException(s"Could not find $endpointName."))
      } else {
       // 向对应的endpoint的inbox中放入消息
        data.inbox.post(message)
      // 有消息待处理的endpoint
        receivers.offer(data)
        None
      }
    }
    // We don't need to call `onStop` in the `synchronized` block
    error.foreach(callbackIfStopped)
  }
```

上述代码只是向inbox中放入消息，然后在receiver中放入接收到消息待处理的endpoint，并没有处理消息，也就是调用endpoint的receive/receiveAndReply方法。在哪里处理的？Dispatcher是通过另启动的线程池来移步处理消息的，如下：



```kotlin
private val threadpool: ThreadPoolExecutor = {
    val numThreads = nettyEnv.conf.getInt("spark.rpc.netty.dispatcher.numThreads",
      math.max(2, Runtime.getRuntime.availableProcessors()))
    val pool = ThreadUtils.newDaemonFixedThreadPool(numThreads, "dispatcher-event-loop")
    for (i <- 0 until numThreads) {
      pool.execute(new MessageLoop)
    }
    pool
  }

  /** Message loop used for dispatching messages. */
  private class MessageLoop extends Runnable {
    override def run(): Unit = {
      try {
        while (true) {
          try {
            val data = receivers.take()
            if (data == PoisonPill) {
              // Put PoisonPill back so that other MessageLoops can see it.
              receivers.offer(PoisonPill)
              return
            }
            data.inbox.process(Dispatcher.this)
          } catch {
            case NonFatal(e) => logError(e.getMessage, e)
          }
        }
      } catch {
        case ie: InterruptedException => // exit
      }
    }
  }
```

MessageLoop从receiver中取下一个endpointdata，调用其所拥有的inbox#process处理，在process方法里调用endpoint的receive(OnewayMessage这种不需要回复的request调用)或者receiveAndReply(RpcMessage这种需要回复的消息调用)来根据消息作出不同处理。

#### 2.1.2 客户端

客户端通过RpcEndpointRef#send或者ask向这个rpcendpointref代表的远程服务发送请求，RpcEndpointRef是一个抽象类，使用NettyRpcEndpointRef实例化，以NettyRpcEndpointRef#send为例（send发送的消息不需要回复）：



```csharp
override def send(message: Any): Unit = {
    require(message != null, "Message is null")
    nettyEnv.send(new RequestMessage(nettyEnv.address, this, message))
  }
```

将消息包装成RequestMessage，调用netty#send进入NettyRpcEnv#send如下：



```kotlin
private[netty] def send(message: RequestMessage): Unit = {
    val remoteAddr = message.receiver.address
     
    // 请求的远程地址就是本地地址，直接使用dispatcher递交到本地endpointref的outbox处理
    if (remoteAddr == address) {
      // Message to a local RPC endpoint.
      try {
        dispatcher.postOneWayMessage(message)
      } catch {
        case e: RpcEnvStoppedException => logWarning(e.getMessage)
      }
    } else {
      // Message to a remote RPC endpoint.
      postToOutbox(message.receiver, OneWayOutboxMessage(message.serialize(this)))
    }
  }
```

调用`postToOutBox(receiver: NettyRpcEndpointRef, message: OutboxMessage）`,对于使用send发送到远端的消息则创建OneWayOutboxMessage。关于postToOutBox的message参数，其类型OutboxMessage是一个抽象类，结构如下：



```kotlin
private[netty] sealed trait OutboxMessage {

  def sendWith(client: TransportClient): Unit

  def onFailure(e: Throwable): Unit
}
```

最后的发送是调用sendWith发送，他有两个实现类：

- OneWayOutboxMessage， RpcEndpointRef#send发送的是此类消息，不用回复。
- RpcOutboxMessage， RpcEndpointRef#ask，askSync发送的是此类消息，需要等待回复。

postToOutbox会根据接收地址在outboxes中检索出对应的outbox，调用outbox#send将消息完成发送。

**# TransportClient**
OutboxMessage#sendWith(client:TransportClient)发送消息是通过TransportClient发送的，TransportClient是通过TransportClientFactory创建的，注册的handler与server一样。但是对于发送出去的消息只经过MessageEncoder#encode处理过一次。

**# RpcEndpointRef send 和ask的区别**
send和ask的区别前文多次提到，send发送完直接返回不需要回复，和ask是需要对端回复的，下面是NettyRpcEndpointRef的send和ask方法的签名：



```csharp
 override def ask[T: ClassTag](message: Any, timeout: RpcTimeout): Future[T] = {
    nettyEnv.ask(new RequestMessage(nettyEnv.address, this, message), timeout)
  }

  override def send(message: Any): Unit = {
    require(message != null, "Message is null")
    nettyEnv.send(new RequestMessage(nettyEnv.address, this, message))
  }
```

ask返回了Future用来异步的获取返回值，进入NettyRpcEnv#ask返回就会知道ask的message参数会被封装成RpcOutboxMessage，下面是RpcOutboxMessage#sendWith的实现：



```kotlin
 override def sendWith(client: TransportClient): Unit = {
    this.client = client
    this.requestId = client.sendRpc(content, this)
  }
```

调用`TransportClient#sendRpc(ByteBuffer message, RpcResponseCallback callback)`,接收一个callback作为本次rpc请求有返回结果是毁掉，返回的是一个标识一次rpc的独一无二的requestid。 下面是`TransportClient#sendRpc(ByteBuffer message, RpcResponseCallback callback)`的部分代码：



```cpp
public long sendRpc(ByteBuffer message, RpcResponseCallback callback) {
    long startTime = System.currentTimeMillis();
    if (logger.isTraceEnabled()) {
      logger.trace("Sending RPC to {}", getRemoteAddress(channel));
    }

    long requestId = Math.abs(UUID.randomUUID().getLeastSignificantBits());
    handler.addRpcRequest(requestId, callback);

    channel.writeAndFlush(new RpcRequest(requestId, new NioManagedBuffer(message)))
        .addListener(future -> {
         ...
         ... 
         ...
        });

    return requestId;
  }
```

上面代码中为本次rpc请求生成了唯一的requestId，然后调用writeAndFlush发送消息。还调用handler.addRpcRequest,这个handler是TransportResponseHandler的实例，TransportResponseHandler#addRpcRequest()如下：



```cpp
public void addRpcRequest(long requestId, RpcResponseCallback callback) {
    updateTimeOfLastRequest();
    // 将生成的requestId ，callback映射保存下来
    outstandingRpcs.put(requestId, callback);
  }
```

(requestId,callBack)映射被保存下来，显然是等待对端回复requestId之后，调用callBack用，前面图中回复经过Decode之后，流进TransportResponseHandler，在TransportResponseHandler#handle中处理decode之后的数据，handle中处理RpcResponse如下：



```java
public void handle(ResponseMessage message) throws Exception {
    if (message instanceof ChunkFetchSuccess) {
       ...
       ...
    } else if (message instanceof ChunkFetchFailure) {
       ... 
       ...
    } else if (message instanceof RpcResponse) {
      RpcResponse resp = (RpcResponse) message;
      RpcResponseCallback listener = outstandingRpcs.get(resp.requestId);
      if (listener == null) {
        logger.warn("Ignoring response for RPC {} from {} ({} bytes) since it is not outstanding",
          resp.requestId, getRemoteAddress(channel), resp.body().size());
      } else {
        outstandingRpcs.remove(resp.requestId);
        try {
          listener.onSuccess(resp.body().nioByteBuffer());
        } finally {
          resp.body().release();
        }
      }
    } else if (message instanceof RpcFailure) {
      ... 
      ...
    } else if (message instanceof StreamResponse) {
       ...
       ...
    } else if (message instanceof StreamFailure) {
       ...
       ...
  }
```

处理RpcResponse的分支中，根据requestId取出callback，然后调用onSuccess，填充Future的结果，关于这个callback是何处生成然后被传递的，最初RpcEndpointRef#ask方法调用的NettyRpcEnv#ask方法。

**# Scala的Future 和Promise**
上面介绍ask方法时，结果是异步返回的，ask只是返回了一个Future，这是使用scala异步编程的一种方式，下面是介绍Future和Promise的用法的文章

1. [Scala Future 和 Promise](https://link.jianshu.com/?t=http://udn.yyuap.com/doc/guides-to-scala-book/chp9-promises-and-futures-in-practice.html)