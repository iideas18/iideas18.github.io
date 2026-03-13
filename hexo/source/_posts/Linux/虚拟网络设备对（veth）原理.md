---
title: "虚拟网络设备对（veth）原理"
date: 2022-03-27 11:53:20
categories:
  - "Linux"
---

在容器化大行其道的今天，`Docker` 可谓是容器界的宠儿。比起笨重的虚拟机，Docker 可谓是身轻如燕。当然，本文不是介绍虚拟机与 Docker 之间的优缺点，而是介绍 Docker 网络中重要的组成部分之一：

> **虚拟网络设备对：veth**

在介绍 `veth` 前，我们先来介绍一下 `网络命名空间（network namespace）`。

## 1. 网络命名空间

`网络命名空间` 是 Linux 内核用来隔离不同容器间的网络资源（每个 Docker 容器都拥有一个独立的网络命名空间），网络命名空间主要隔离的资源包括：

- **iptables规则表**
- **路由规则表**
- **网络设备列表**

如下图所示，当系统中拥有 3 个网络命名空间：

![Image](%E8%99%9A%E6%8B%9F%E7%BD%91%E7%BB%9C%E8%AE%BE%E5%A4%87%E5%AF%B9%EF%BC%88veth%EF%BC%89%E5%8E%9F%E7%90%86/640-1648353036257.png)

由于不同的网络命名空间之间是相互隔离的，所以不同的网络命名空间之间并不能直接通信。比如在 `网络命名空间A` 配置了一个 IP 地址为 `172.17.42.1` 的设备，但在 `网络命名空间B` 里却不能访问，如下图所示：

![Image](%E8%99%9A%E6%8B%9F%E7%BD%91%E7%BB%9C%E8%AE%BE%E5%A4%87%E5%AF%B9%EF%BC%88veth%EF%BC%89%E5%8E%9F%E7%90%86/640-1648353038042.png)

就好比两台电脑，如果没有任何网线连接，它们之间是不能通信的。所以，Linux 内核提供了 `虚拟网络设备对（veth）` 这个功能，用于解决不同网络命名空间之间的通信。

## 2. 虚拟网络设备对（veth）

`虚拟网络设备对` 用于解决不同网络命名空间之间的通信，可以将其看成是两块有网线连接的网卡。只要将其中一块网卡放置到网络命名空间A，另外一块网卡放置到网络命名空间B，那么两个不同的网络命名空间就能够通信，如下图所示：

![Image](%E8%99%9A%E6%8B%9F%E7%BD%91%E7%BB%9C%E8%AE%BE%E5%A4%87%E5%AF%B9%EF%BC%88veth%EF%BC%89%E5%8E%9F%E7%90%86/640-1648353037013.png)

如上图所示，`veth0` 与 `veth1` 组成一个虚拟网络设备对。`虚拟网络设备对` 就像管道一样，只要向其中一端发送数据，就可以从另外一端接收到数据。

`Docker` 就是使用 `虚拟网络设备对` 来实现不同容器之间的通信，其原理如下图：

![Image](%E8%99%9A%E6%8B%9F%E7%BD%91%E7%BB%9C%E8%AE%BE%E5%A4%87%E5%AF%B9%EF%BC%88veth%EF%BC%89%E5%8E%9F%E7%90%86/640-1648353038245.png)

从上图可以看出，每个容器之间并不是直接通过 `虚拟网络设备对` 来进行连接的，而是在主机上创建一个名为 `docker0` 的 `网桥`，然后通过 `虚拟网络设备对` 来将各个容器连接到 `网桥` 上。`网桥` 有将多个 `网络设备` 连接起来的能力，就如现实中的 `交换机` 一样。

## 3. 虚拟网络设备对实现

在 Linux 内核中，使用 `net_device` 对象来表示一个网络设备。由于 `veth` 提供双向通信的功能，所以需要使用两个 `net_device` 对象来实现。由于 `net_device` 对象比较庞大，所以这里只列出本文相关的字段：

```c++
struct net_device
{
    char name[IFNAMSIZ];
    ...
    const struct net_device_ops *netdev_ops;
    ...
}
```

下面介绍一下这两个字段的作用：

- `name`：用来存储设备的名称，如 `eth0`。
- `netdev_ops`：设备相关的操作接口列表，如初始化设备的接口、关闭设备的接口和发送数据的接口等。

由于 `veth` 由两个 `net_device` 对象组成的，所以这两个 `net_device` 对象应该有指向对方的指针。但通过查阅代码，并没发现有指向对方的指针，那么内核是怎么实现 `veth` 的呢？

虽然 Linux 内核使用 `net_device` 对象来表示一个网络设备，但由于不同厂商的网络设备可能存在各种差异，所以为了让 Linux 内核能够适应各种网络设备，故为不同的网络设备提供私有数据的存储空间。

也就是说，一个网络设备除了拥有 `net_device` 部分外，还有其私有数据部分。不同的网络设备其私有数据部分不同，而网络设备的私有数据部分存一般放在 `net_device` 对象的结束位置，如下图所示：

![Image](%E8%99%9A%E6%8B%9F%E7%BD%91%E7%BB%9C%E8%AE%BE%E5%A4%87%E5%AF%B9%EF%BC%88veth%EF%BC%89%E5%8E%9F%E7%90%86/640-1648353037176.png)

上图展示了 `PCMCIA网卡` 和 `RTL-8139网卡` 对应的私有数据部分存储的位置，`PCMCIA网卡` 的私有数据部分对应的是 `pcnet_dev_t` 结构，而 `RTL-8139网卡` 的私有数据部分对应的是 `rtl8139_private` 结构。

回到我们的主题，`虚拟网络设备对` 的私有数据部分由 `veth_priv` 结构表示，其定义如下：

```c++
struct veth_priv {
    struct net_device *peer;
    struct veth_net_stats *stats;
    ...
};
```

下面介绍一下 `veth_priv` 结构各个字段的作用：

- `peer`：由于 `虚拟网络设备对` 是由一对网络设备组成，所以此字段用于指向设备对的另外一个设备。
- `stats`：用于保存统计信息。

从 `veth_priv` 结构可以看出，`虚拟网络设备对` 所属的两个设备对象是由 `peer` 字段来关联起来的，如下图所示：

![Image](%E8%99%9A%E6%8B%9F%E7%BD%91%E7%BB%9C%E8%AE%BE%E5%A4%87%E5%AF%B9%EF%BC%88veth%EF%BC%89%E5%8E%9F%E7%90%86/640-1648353036937.png)

### 1. 创建虚拟网络设备对

当使用 `ip` 命令创建一对 `虚拟网络设备对` 时，会触发调用 `veth_newlink` 函数来完成创建工作，其实现如下：

```c++
static int veth_newlink(struct net_device *dev, struct nlattr *tb[], struct nlattr *data[])
{
    int err;
    struct net_device *peer;
    struct veth_priv *priv;
    char ifname[IFNAMSIZ];
    ...

    // 由于虚拟网络设备对是由两个网络设备组成,
    // dev 是虚拟网络设备对的其中一个网络设备,
    // 所以需要调用 rtnl_create_link() 函数创建的另外一个网络设备并保存到 peer 变量中.
    peer = rtnl_create_link(dev_net(dev), ifname, &veth_link_ops, tbp);
    ...

    priv = netdev_priv(dev);  // 获取 dev 的私有数据部分
    priv->peer = peer;        // 将其 peer 字段指向 peer

    priv = netdev_priv(peer); // 获取 peer 的私有数据部分
    priv->peer = dev;         // 将其 peer 字段指向 dev

    return 0;
}
```

上面代码经过精简后，保留了主要逻辑，所以 `veth_newlink` 主要完成以下工作：

- 由于虚拟网络设备对是由两个网络设备组成，而 `dev` 是虚拟网络设备对的其中一个网络设备，所以需要调用 `rtnl_create_link` 函数创建的另外一个网络设备，并保存到 `peer` 变量中。
- 将其 `dev` 设备对象的 `peer` 字段指向 `peer` 设备对象。
- 将其 `peer` 设备对象的 `peer` 字段指向 `dev` 设备对象。

就这样，一对 `虚拟网络设备对` 的创建就完成了。

### 2. 初始化虚拟网络设备对

当然，在创建 `虚拟网络设备对` 时还需要对其进行初始化，初始化过程由 `veth_setup` 函数完成，其实现如下：

```c++
static const struct net_device_ops veth_netdev_ops = {
    ...
    .ndo_start_xmit = veth_xmit,
    ...
};

static void veth_setup(struct net_device *dev)
{
    ...
    dev->netdev_ops = &veth_netdev_ops;
    ...
}
```

在初始化 `虚拟网络设备对` 时，最重要的是设置其操作函数集。而 `net_device_ops` 结构是网络设备的操作函数集结构，当向设备发送数据时，将会触发调用设备操作函数集的 `ndo_start_xmit` 方法。

而 `veth_setup` 函数将此方法设置为 `veth_xmit`，也就是说，当向 `虚拟网络设备对` 的其中一端发送数据时，将会调用 `veth_xmit` 函数来发送数据。

### 3. 向虚拟网络设备对发送数据

当向 `虚拟网络设备对` 的其中一端发送数据时，将会调用 `veth_xmit` 函数来完成发送过程，其实现如下：

```c++
static netdev_tx_t veth_xmit(struct sk_buff *skb, struct net_device *dev)
{
    struct net_device *rcv = NULL;
    struct veth_priv *priv, *rcv_priv;
    ...

    // 获取发送数据设备的对端设备
    priv = netdev_priv(dev); 
    rcv = priv->peer;
    ...

    skb->tstamp.tv64 = 0;
    skb->pkt_type = PACKET_HOST;
    // 将数据包的接收设备设置为对端设备
    skb->protocol = eth_type_trans(skb, rcv);
    ...

    // 将数据包上送给内核协议栈
    netif_rx(skb);

    return NETDEV_TX_OK;
}
```

我们先来介绍一下 `veth_xmit` 函数各个参数的意义：

- `skb`：要发送的数据包对象。
- `dev`：发送数据的设备。

`veth_xmit` 函数的实现比较简单，主要完成以下工作：

- 获取发送数据设备的对端设备。
- 将数据包的接收设备设置为对端设备。
- 将数据包上送给内核协议栈。

我们通过下图来展示发送数据的过程：

![Image](%E8%99%9A%E6%8B%9F%E7%BD%91%E7%BB%9C%E8%AE%BE%E5%A4%87%E5%AF%B9%EF%BC%88veth%EF%BC%89%E5%8E%9F%E7%90%86/640-1648353037008.png)



如上图所示，当一个数据包从 `虚拟网络设备对` 的一端发送出去，会从其另外一端被接收，并上送到内核协议栈处理。

## 总结

由于 `虚拟网络设备对` 的出现，解决了容器间的通信问题。而本文主要分析了 `虚拟网络设备对` 的实现原理，但是有些细节并没有详细分析，如果有不懂的地方可以加我微信一起探讨。