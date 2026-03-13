---
title: "体系化认识 RPC"
date: 2020-06-07 17:53:13
categories:
  - "Spark note"
  - "spark md"
---

# 体系化认识 RPC

- 张旭

发布于：2017 年 10 月 24 日 18:09

**RPC**（Remote Procedure Call），即远程过程调用，是一个分布式系统间通信的必备技术，本文体系性地介绍了 RPC 包含的核心概念和技术，希望读者读完文章，一提到 RPC，脑中不是零碎的知识，而是具体的一个脑图般的体系。本文并不会深入到每一个主题剖析，只做提纲挈领的介绍。

RPC 最核心要解决的问题就是在分布式系统间，如何执行另外一个地址空间上的函数、方法，就仿佛在本地调用一样，个人总结的 RPC 最核心的概念和技术包括如下，如图所示：

(点击放大图像)

[![体系化认识RPC](https://static001.infoq.cn/resource/image/59/60/59eebc21768e6d654ef4337642de5360.jpg)](https://www.infoq.cn/mag4media/repositories/fs/articles/get-to-know-rpc/zh/resources/261-1508862334950.jpg)

下面依次展开每个部分。

## 传输（Transport）

TCP 协议是 RPC 的 **基石**，一般来说通信是建立在 TCP 协议之上的，而且 RPC 往往需要可靠的通信，因此不采用 UDP。

这里重申下 TCP 的关键词：**面向连接的，全双工，可靠传输（按序、不重、不丢、容错），流量控制（滑动窗口）**。

另外，要理解 RPC 中的**嵌套 header+body**，协议栈每一层都包含了下一层协议的全部数据，只不过包了一个头而已，如下图所示的 TCP segment 包含了应用层的数据，套了一个头而已。

(点击放大图像)

[![体系化认识RPC](https://static001.infoq.cn/resource/image/d2/b4/d2d79264b0259bc0fabb2d0f5aeddbb4.jpg)](https://www.infoq.cn/mag4media/repositories/fs/articles/get-to-know-rpc/zh/resources/192-1508862334949.jpg)

那么 RPC 传输的 message 也就是 TCP body 中的数据，这个 message 也同样可以包含 header+body。body 也经常叫做 payload。

TCP 就是可靠地把数据在不同的地址空间上搬运，例如在传统的阻塞 I/O 模型中，当有数据过来的时候，操作系统内核把数据从 I/O 中读出来存放在 kernal space，然后内核就通知 user space 可以拷贝走数据，用以腾出空间，让 TCP 滑动窗口向前移动，接收更多的数据。

TCP 协议栈存在端口的概念，端口是进程获取数据的渠道。

## I/O 模型（I/O Model）

做一个高性能 /scalable 的 RPC，需要能够满足：

- 第一，服务端尽可能多的处理并发请求
- 第二，同时尽可能短的处理完毕。

CPU 和 I/O 之间天然存在着差异，网络传输的延时不可控，最简单的模型下，如果有线程或者进程在调用 I/O，I/O 没响应时，CPU 只能选择挂起，线程或者进程也被 I/O 阻塞住。

而 CPU 资源宝贵，要让 CPU 在该忙碌的时候尽量忙碌起来，而不需要频繁地挂起、唤醒做切换，同时很多宝贵的线程和进程占用系统资源也在做无用功。

Socket I/O 可以看做是二者之间的桥梁，如何更好地协调二者，去满足前面说的两点要求，有一些模式（pattern）是可以应用的。

RPC 框架可选择的 I/O 模型严格意义上有 5 种，这里不讨论基于 **信号驱动** 的 I/O（Signal Driven I/O）。这几种模型在《UNIX 网络编程》中就有提到了，它们分别是：

1. **传统的阻塞 I/O**（Blocking I/O）
2. **非阻塞 I/O**（Non-blocking I/O）
3. **I/O 多路复用**（I/O multiplexing）
4. **异步 I/O**（Asynchronous I/O）

这里不细说每种 I/O 模型。这里举一个形象的例子，读者就可以领会这四种 I/O 的区别，就用 **银行办业务** 这个生活的场景描述。

下图是使用 **传统的阻塞 I/O 模型**。一个柜员服务所有客户，可见当客户填写单据的时候也就是发生网络 I/O 的时候，柜员，也就是宝贵的线程或者进程就会被阻塞，白白浪费了 CPU 资源，无法服务后面的请求。

![体系化认识RPC](https://static001.infoq.cn/resource/image/44/96/44cf6921b92aaf8f933f45cd7c51b196.jpg)

下图是上一个的进化版，如果一个柜员不够，那么就 **并发处理**，对应采用线程池或者多进程方案，一个客户对应一个柜员，这明显加大了并发度，在并发不高的情况下性能够用，但是仍然存在柜员被 I/O 阻塞的可能。

![体系化认识RPC](https://static001.infoq.cn/resource/image/95/fe/95949973f0219c8faf75b4678d3706fe.jpg)

下图是 **I/O 多路复用**，存在一个大堂经理，相当于代理，它来负责所有的客户，只有当客户写好单据后，才把客户分配一个柜员处理，可以想象柜员不用阻塞在 I/O 读写上，这样柜员效率会非常高，这也就是 I/O 多路复用的精髓。

![体系化认识RPC](https://static001.infoq.cn/resource/image/2e/fe/2eb0f8c42808eaf1e300cf2a1ee4bffe.jpg)

下图是 **异步 I/O**，完全不存在大堂经理，银行有一个天然的“**高级的分配机器**”，柜员注册自己负责的业务类型，例如 I/O 可读，那么由这个“高级的机器”负责 I/O 读，当可读时候，通过 **回调机制**，把客户已经填写完毕的单据主动交给柜员，回调其函数完成操作。

![体系化认识RPC](https://static001.infoq.cn/resource/image/04/36/04f8543d7eeaf80bba41179f4377be36.jpg)

重点说下高性能，并且工业界普遍使用的方案，也就是后两种。

### I/O 多路复用

基于内核，建立在 epoll 或者 kqueue 上实现，I/O 多路复用最大的优势是用户可以在一个线程内同时处理多个 Socket 的 I/O 请求。用户可以订阅事件，包括文件描述符或者 I/O 可读、可写、可连接事件等。

通过一个线程监听全部的 TCP 连接，有任何事件发生就通知用户态处理即可，这么做的目的就是 **假设 I/O 是慢的，CPU 是快的**，那么要让用户态尽可能的忙碌起来去，也就是最大化 CPU 利用率，避免传统的 I/O 阻塞。

### 异步 I/O

这里重点说下同步 I/O 和异步 I/O，理论上前三种模型都叫做同步 I/O，同步是指用户线程发起 I/O 请求后需要等待或者轮询内核 I/O 完成后再继续，而异步是指用户线程发起 I/O 请求直接退出，当内核 I/O 操作完成后会通知用户线程来调用其回调函数。

## 进程 / 线程模型（Thread/Process Model）

进程 / 线程模型往往和 I/O 模型有联系，当 Socket I/O 可以很高效的工作时候，真正的业务逻辑如何利用 CPU 更快地处理请求，也是有 pattern 可寻的。这里主要说 Scalable I/O 一般是如何做的，它的 I/O 需要经历 5 个环节：

复制代码

```
Read -> Decode -> Compute -> Encode -> Send
```

使用传统的阻塞 I/O + 线程池的方案（Multitasks）会遇 **C10k 问题。**

[**https://en.wikipedia.org/wiki/C10k_problem**](https://en.wikipedia.org/wiki/C10k_problem)

但是业界有很多实现都是这个方式，比如 Java web 容器 Tomcat/Jetty 的默认配置就采用这个方案，可以工作得很好。

但是从 I/O 模型可以看出 I/O Blocking is killer to performance，它会让工作线程卡在 I/O 上，而一个系统内部可使用的线程数量是有限的（本文暂时不谈协程、纤程的概念），所以才有了 I/O 多路复用和异步 I/O。

**I/O 多路复用往往对应 Reactor 模式，异步 I/O 往往对应 Proactor**。

Reactor 一般使用 **epoll+ 事件驱动** 的经典模式，通过 **分治** 的手段，把耗时的网络连接、安全认证、编码等工作交给专门的线程池或者进程去完成，然后再去调用真正的核心业务逻辑层，这在 *nix 系统中被广泛使用。

著名的 Redis、Nginx、Node.js 的 Socket I/O 都用的这个，而 Java 的 NIO 框架 Netty 也是，Spark 2.0 RPC 所依赖的同样采用了 Reactor 模式。

Proactor 在 *nix 中没有很好的实现，但是在 Windows 上大放异彩（例如 IOCP 模型）。

关于 Reactor 可以参考 **Doug Lea 的 PPT**

[**http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf**](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf)

以及 **这篇 paper**

[**http://www.dre.vanderbilt.edu/~schmidt/PDF/reactor-siemens.pdf**](http://www.dre.vanderbilt.edu/~schmidt/PDF/reactor-siemens.pdf)

关于 Proactor 可以参考 **这篇 paper**

[**http://www.cs.wustl.edu/~schmidt/PDF/proactor.pdf**](http://www.cs.wustl.edu/~schmidt/PDF/proactor.pdf)

说个具体的例子，Thrift 作为一个融合了 **序列化 +RPC** 的框架，提供了很多种 Server 的构建选项，从名称中就可以看出他们使用哪种 I/O 和线程模型。

(点击放大图像)

[![体系化认识RPC](https://static001.infoq.cn/resource/image/3a/f6/3adc0b262cc99db1e6ce5fc52874e8f6.jpg)](https://www.infoq.cn/mag4media/repositories/fs/articles/get-to-know-rpc/zh/resources/87-1508862334956.jpg)

## Schema 和序列化（Schema & Data Serialization）

当 I/O 完成后，数据可以由程序处理，那么如何识别这些二进制的数据，是下一步要做的。序列化和反序列化，是做对象到二进制数据的转换，程序是可以理解对象的，对象一般含有 schema 或者结构，基于这些语义来做特定的业务逻辑处理。

考察一个序列化框架一般会关注以下几点：

- **Encoding format**。是 human readable 还是 binary。
- **Schema declaration**。也叫作契约声明，基于 IDL，比如 Protocol Buffers/Thrift，还是自描述的，比如 JSON、XML。另外还需要看是否是强类型的。
- **语言平台的中立性**。比如 Java 的 Native Serialization 就只能自己玩，而 Protocol Buffers 可以跨各种语言和平台。
- **新老契约的兼容性**。比如 IDL 加了一个字段，老数据是否还可以反序列化成功。
- **和压缩算法的契合度**。跑 benchmark 和实际应用都会结合各种压缩算法，例如 gzip、snappy。
- **性能**。这是最重要的，序列化、反序列化的时间，序列化后数据的字节大小是考察重点。

序列化方式非常多，常见的有 **Protocol Buffers， Avro，Thrift，XML，JSON，MessagePack，Kyro，Hessian，Protostuff，Java Native Serialize，FST**。

下面详细展开 Protocol Buffers（简称 PB），看看为什么作为工业界用得最多的高性能序列化类库，好在哪里。

首先去官网查看它的 **Encoding format**

[**https://developers.google.com/protocol-buffers/docs/encoding**](https://developers.google.com/protocol-buffers/docs/encoding)

**紧凑高效** 是 PB 的特点，使用字段的序号作为标识，而不是包名类名（Java 的 Native Serialization 序列化后数据大就在于什么都一股脑放进去），使用 varint 和 zigzag 对整型做特殊处理。

PB 可以跨各种语言，但是前提是使用 IDL 编写描述文件，然后 codegen 工具生成各种语言的代码。

举个例子，有个 Person 对象，包含内容如下图所示，经过 PB 序列化后只有 33 个字节，可以对比 XML、JSON 或者 Java 的 Native Serialization 都会大非常多，而且序列化、反序列化的速度也不会很好。记住这个数据，后面 demo 的时候会有用。

(点击放大图像)

[![体系化认识RPC](https://static001.infoq.cn/resource/image/14/22/1496478c1b2d956ef30142c7ccf32522.jpg)](https://www.infoq.cn/mag4media/repositories/fs/articles/get-to-know-rpc/zh/resources/98-1508862334957.jpg)

图片来源

[**https://www.slideshare.net/SergeyPodolsky/google-protocol-buffers-56085699**](https://www.slideshare.net/SergeyPodolsky/google-protocol-buffers-56085699)

再举个例子，使用 Thrift 做同样的序列化，采用 Binary Protocol 和 Compact Protocol 的大小是不一样的，但是 Compact Protocol 和 PB 虽然序列化的编码不一样，但是同样是非常高效的。

(点击放大图像)

[![体系化认识RPC](https://static001.infoq.cn/resource/image/8a/3d/8a0ddfc7979f048c24d9c78f247be93d.jpg)](https://www.infoq.cn/mag4media/repositories/fs/articles/get-to-know-rpc/zh/resources/49-1508862334962.jpg)

图片来源

[**https://www.slideshare.net/SergeyPodolsky/google-protocol-buffers-56085699**](https://www.slideshare.net/SergeyPodolsky/google-protocol-buffers-56085699)

这里给一个 **Uber 做的序列化框架比较**

[**https://eng.uber.com/trip-data-squeeze/**](https://eng.uber.com/trip-data-squeeze/)

可以看出 Protocol Buffers 和 Thrift 都是名列前茅的，但是这些 benchmark 看看就好，知道个大概，没必要细究，因为样本数据、测试环境、版本等都可能会影响结果。

## 协议结构（Wire Protocol）

Socket 范畴里讨论的包叫做 Frame、Packet、Segment 都没错，但是一般把这些分别映射为数据链路层、IP 层和 TCP 层的数据包，应用层的暂时没有，所以下文不必计较包怎么翻译。

**协议结构**，英文叫做 wire protocol 或者 wire format。TCP 只是 binary stream 通道，是 binary 数据的可靠搬用工，它不懂 RPC 里面包装的是什么。而在一个通道上传输 message，势必涉及 message 的识别。

举个例子，正如下图中的例子，ABC+DEF+GHI 分 3 个 message，也就是分 3 个 Frame 发送出去，而接收端分四次收到 4 个 Frame。

![体系化认识RPC](https://static001.infoq.cn/resource/image/9b/56/9b0c88ec3d77cb25492d2a0952829d56.png)

Socket I/O 的工作完成得很好，可靠地传输过去，这是 TCP 协议保证的，但是接收到的是 4 个 Frame，不是原本发送的 3 个 message 对应的 3 个 Frame。

这种情况叫做发生了 **TCP 粘包和半包** 现象，AB、H、I 的情况叫做半包，CDEFG 的情况叫做粘包。虽然顺序是对的，但是分组完全和之前对应不上。

这时候应用层如何做语义级别的 message 识别是个问题，只有做好了协议的结构，才能把一整个数据片段做序列化或者反序列化处理。

一般采用的方式有三种：

**方式 1：分隔符**。

**方式 2：换行符**。比如 memcache 由客户端发送的命令使用的是文本行\r\n 做为 mesage 的分隔符，组织成一个有意义的 message。

![体系化认识RPC](https://static001.infoq.cn/resource/image/51/b6/51061c3c00f28771482d29de0522d4b6.jpg)

图片来源

[**https://www.kancloud.cn/kancloud/essential-netty-in-action/52643**](https://www.kancloud.cn/kancloud/essential-netty-in-action/52643)

图中的说明：

1. 字节流
2. 第一帧
3. 第二帧

**方式 3：固定长度**。RPC 经常采用这种方式，使用 header+payload 的方式。

比如 HTTP 协议，建立在 TCP 之上最广泛使用的 RPC，HTTP 头中肯定有一个 body length 告知应用层如何去读懂一个 message，做 HTTP 包的识别。

![体系化认识RPC](https://static001.infoq.cn/resource/image/0a/0e/0ac201a72ec11ace3e41fc0d12eaad0e.jpg)

在 HTTP/2 协议中，详细见 **Hypertext Transfer Protocol Version 2 (HTTP/2)**

[**https://tools.ietf.org/html/rfc7540**](https://tools.ietf.org/html/rfc7540)

虽然精简了很多，加入了流的概念，但是 header+payload 的方式是绝对不能变的。

![体系化认识RPC](https://static001.infoq.cn/resource/image/bd/dd/bda23845686fa71baba12b8e8fa634dd.jpg)

图片来源

[**https://tools.ietf.org/html/rfc7540**](https://tools.ietf.org/html/rfc7540)

下面展示的是作者自研的一个 RPC 框架，可以在 github 上找到这个工程 

**neoremind/navi-pbrpc**：

[**https://github.com/neoremind/navi-pbrpc**](https://github.com/neoremind/navi-pbrpc)

![体系化认识RPC](https://static001.infoq.cn/resource/image/6b/ba/6b4dd284f25286d2053fd348ff2bf9ba.jpg)

可以看出它的协议栈 header+payload 方式的，header 固定 36 个字节长度，最后 4 个字节是 body length，也就是 payload length，可以使用大尾端或者小尾端编码。

## 可靠性（Reliability）

RPC 框架不光要处理 Network I/O、序列化、协议栈。还有很多不确定性问题要处理，这里的不确定性就是由 **网络的不可靠** 带来的麻烦。

例如如何保持长连接心跳？网络闪断怎么办？重连、重传？连接超时？这些都非常的细碎和麻烦，所以说开发好一个稳定的 RPC 类库是一个非常系统和细心的工程。

但是好在工业界有一群人就致力于提供平台似的解决方案，例如 Java 中的 Netty，它是一个强大的异步、事件驱动的网络 I/O 库，使用 I/O 多路复用的模型，做好了上述的麻烦处理。

它是面向对象设计模式的集大成者，使用方只需要会使用 Netty 的各种类，进行扩展、组合、插拔，就可以完成一个高性能、可靠的 RPC 框架。

著名的 gRPC Java 版本、Twitter 的 Finagle 框架、阿里巴巴的 Dubbo、新浪微博的 Motan、Spark 2.0 RPC 的网络层（可以参考 **kraps-rpc**：[ **https://github.com/neoremind/kraps-rpc**](https://github.com/neoremind/kraps-rpc)）都采用了这个类库。

## 易用性（Ease of use）

RPC 是需要让上层写业务逻辑来实现功能的，如何优雅地启停一个 server，注入 endpoint，客户端怎么连，重试调用，超时控制，同步异步调用，SDK 是否需要交换等等，都决定了基于 RPC 构建服务，甚至 SOA 的工程效率与生产力高低。这里不做展开，看各种 RPC 的文档就知道他们的易用性如何了。

## 工业界的 RPC 框架一览

### 国内

- **Dubbo**。来自阿里巴巴 [http://dubbo.I/O/](http://dubbo.i/O/)
- **Motan**。新浪微博自用 https://github.com/weibocom/motan
- **Dubbox**。当当基于 dubbo 的 https://github.com/dangdangdotcom/dubbox
- **rpcx**。基于 Golang 的 https://github.com/smallnest/rpcx
- **Navi & Navi-pbrpc**。作者开源的 [https://github.com/neoremind/navi ](https://github.com/neoremind/navi)https://github.com/neoremind/navi-pbrpc

### 国外

- **Thrift from facebook** [https://thrift.apache.org](https://thrift.apache.org/)
- **Avro from hadoop** [https://avro.apache.org](https://avro.apache.org/)
- **Finagle by twitter** [https://twitter.github.I/O/finagle](https://twitter.github.i/O/finagle)
- **gRPC by Google** [http://www.grpc.I/O ](http://www.grpc.i/O)(Google inside use Stuppy)
- **Hessian from cuacho** [http://hessian.caucho.com](http://hessian.caucho.com/)
- **Coral Service inside amazon** (not open sourced)

上述列出来的都是现在互联网企业常用的解决方案，暂时不考虑传统的 SOAP，XML-RPC 等。这些是有网络资料的，实际上很多公司内部都会针对自己的业务场景，以及和公司内的平台相融合（比如监控平台等），自研一套框架，但是殊途同归，都逃不掉刚刚上面所列举的 RPC 的要考虑的各个部分。

## Demo 展示

为了使读者更好地理解上面所述的各个章节，下面做一个简单例子分析。使用 **neoremind/navi-pbrpc**：[ **https://github.com/neoremind/navi-pbrpc**](https://github.com/neoremind/navi-pbrpc) 来做 demo，使用 Java 语言来开发。

假设要开发一个服务端和客户端，服务端提供一个请求响应接口，请求是 **user_id**，响应是一个 user 的数据结构对象。

首先定义一个 IDL，使用 PB 来做 Schema 声明，IDL 描述如下，第一个 Request 是请求，第二个 Person 是响应的对象结构。

![体系化认识RPC](https://static001.infoq.cn/resource/image/a3/4a/a3d7abbd4bd4debb51701c352118c84a.jpg)

然后使用 codegen 生成对应的代码，例如生成了 PersonPB.Request 和 PersonPB.Person 两个 class。

server 端需要开发请求响应接口，API 是 **PersonPB.Person doSmth(PersonPB.Request req)**，实现如下，包含一个 Interface 和一个实现 class。

![体系化认识RPC](https://static001.infoq.cn/resource/image/dd/19/dd6cb9d6befae5989a2919d1cc947f19.jpg)

server 返回的是一个 Person 对象，里面的内容主要就是上面讲到的 PB 例子里面的。

启动 server。在 8098 端口开启服务，客户端需要靠 id=100 这个标识来路由到这个服务。

![体系化认识RPC](https://static001.infoq.cn/resource/image/60/f3/60ab0bc002aa95a54fd1d7b0c837bcf3.jpg)

至此，服务端开发完毕，可以看出使用一个完善的 RPC 框架，只需要定义好 Schema 和业务逻辑就可以发布一个 RPC，而 I/O model、线程模型、序列化 / 反序列化、协议结构均由框架服务。

navi-pbrpc 底层使用 Netty，在 Linux 下会使用 epoll 做 I/O 多路复用，线程模型默认采用 Reactor 模式，序列化和反序列化使用 PB，协议结构见上文部分介绍的，是一个标准的 header+payload 结构。

下面开发一个 client，调用刚刚开发的 RPC。

client 端代码实现如下。首先构造 PbrpcClient，然后构造 PersonPB.Request，也就是请求，设置好 user_id，构造 PbrpcMsg 作为 TCP 层传输的数据 payload，这就是协议结构中的 body 部分。

通过 asyncTransport 进行通信，返回一个 Future 句柄，通过 Future.get 阻塞获取结果并且打印。

![体系化认识RPC](https://static001.infoq.cn/resource/image/21/2c/21617e8f3f38766cfa4b8e6970c8c02c.jpg)

至此，可以看出作为一个 RPC client 易用性是很简单的，同时可靠性，例如重试等会由 navi-pbrpc 框架负责完成，用户只需要聚焦到真正的业务逻辑即可。

下面继续深入到 binary stream 级别观察，使用嗅探工具来看看 TCP 包。一般使用 **wireshark** 或者 **tcpdump**。

客户端的一次请求调用如下图所示，第一个包就是 TCP 三次握手的 SYN 包。

(点击放大图像)

[![体系化认识RPC](https://static001.infoq.cn/resource/image/74/ab/74e5262f6ea420576f6d64daae7a45ab.jpg)](https://www.infoq.cn/mag4media/repositories/fs/articles/get-to-know-rpc/zh/resources/519-1508862874795.jpg)

根据 TCP 头协议，可看出来。

- ff 15 = 65301 是客户端的端口
- 1f a2 = 8098 是服务端的端口
- header 的长度 44 字节是 20 字节头 +20 字节 option+padding 构成的。

三次握手成功后，下面客户端发起了 RPC 请求，如下图所示。

(点击放大图像)

[![体系化认识RPC](https://static001.infoq.cn/resource/image/4c/b4/4c4200a5a88f6dbff06543e882e806b4.jpg)](https://www.infoq.cn/mag4media/repositories/fs/articles/get-to-know-rpc/zh/resources/520-1508862874795.jpg)

可以看出 TCP 包含了一个 message，由 navi-pbrpc 的协议栈规定的 header+payload 构成，

继续深入分析 message 中的内容，如下图所示：

(点击放大图像)

[![体系化认识RPC](https://static001.infoq.cn/resource/image/ec/f2/ec9f852f3cf648bfeff30ab1c9f6a9f2.jpg)](https://www.infoq.cn/mag4media/repositories/fs/articles/get-to-know-rpc/zh/resources/421-1508862874796.jpg)

其中

- 61 70 = ap 是头中的的 provider 标识
- body length 是 2，注意 navi-pbrpc 采用了小尾端。
- payload 是 08 7f，08 在 PB 中理解为第一个属性，是 varint 整型，7f 表示传输的是 127 这个整型。

服务端响应 RPC 请求，还是由 navi-pbrpc 的协议栈规定的 header+payload 构成，可以看出 body 就是 PB 例子里面的二进制数据。

(点击放大图像)

[![体系化认识RPC](https://static001.infoq.cn/resource/image/ed/fb/edc0977a0c54a74b367dadf65ce9eefb.jpg)](https://www.infoq.cn/mag4media/repositories/fs/articles/get-to-know-rpc/zh/resources/422-1508862874796.jpg)

最后，客户端退出，四次分手结束。

## 总结

本文系统性地介绍了 RPC 包含的核心概念和技术，带着读者从一个实际的例子去映射理解。很多东西都是蜻蜓点水，每一个关键字都能成为一个很大的话题，希望这个提纲挈领的介绍可以让读者在大脑里面有一个系统的体系去看待 RPC。

欢迎访问作者的博客 [**http://neoremind.com**](http://neoremind.com/)。

## 作者介绍

**张旭**，目前工作在 Hulu，从事 Big data 领域的研发工作，曾经在百度 ECOM 和程序化广告部从事系统架构工作，热爱开源，在 github 贡献多个开源软件，id:neoremind，关注大数据、Web 后端技术、广告系统技术以及致力于编写高质量的代码。

感谢[雨多田光](http://www.infoq.com/cn/profile/雨多田光)对本文的审校。