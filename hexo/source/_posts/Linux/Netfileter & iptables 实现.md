---
title: "Netfileter & iptables 实现"
date: 2022-03-27 12:39:08
cover: "/2022/03/27/Linux/Netfileter & iptables 实现/640-1648355509107.png"
categories:
  - "Linux"
---

# Netfileter & iptables 实现

`Netfilter` 可能了解的人比较少，但是 `iptables` 用过 Linux 的都应该知道。本文主要介绍 `Netfilter` 与 `iptables` 的原理，而下一篇将会介绍 `Netfilter` 与 `iptables` 的实现。

## 1.  Netfilter

`Netfilter` 顾名思义就是网络过滤器，其主要功能就是对进出内核协议栈的数据包进行过滤或者修改，有名的 `iptables` 就是建立在 `Netfilter` 之上。

`Netfilter` 通过向内核协议栈中不同的位置注册 `钩子函数（Hooks）` 来对数据包进行过滤或者修改操作，这些位置称为 `挂载点`，主要有 5 个：`PRE_ROUTING`、`LOCAL_IN`、`FORWARD`、`LOCAL_OUT` 和 `POST_ROUTING`，如下图所示：

![Image](640-1648355509107.png)

这 5 个 `挂载点` 的意义如下：

- `PRE_ROUTING`：路由前。数据包进入IP层后，但还没有对数据包进行路由判定前。
- `LOCAL_IN`：进入本地。对数据包进行路由判定后，如果数据包是发送给本地的，在上送数据包给上层协议前。
- `FORWARD`：转发。对数据包进行路由判定后，如果数据包不是发送给本地的，在转发数据包出去前。
- `LOCAL_OUT`：本地输出。对于输出的数据包，在没有对数据包进行路由判定前。
- `POST_ROUTING`：路由后。对于输出的数据包，在对数据包进行路由判定后。

从上图可以看出，路由判定是数据流向的关键点。

- 第一个路由判定通过查找输入数据包 `IP头部` 的目的 `IP地址` 是否为本机的 `IP地址`，如果是本机的 `IP地址`，说明数据是发送给本机的。否则说明数据包是发送给其他主机，经过本机只是进行中转。
- 第二个路由判定根据输出数据包 `IP头部` 的目的 `IP地址` 从路由表中查找对应的路由信息，然后根据路由信息获取下一跳主机（或网关）的 `IP地址`，然后进行数据传输。

通过向这些 `挂载点` 注册钩子函数，就能够对处于不同阶段的数据包进行过滤或者修改操作。由于钩子函数能够注册多个，所以内核使用链表来保存这些钩子函数，如下图所示：

![Image](640-1648355509691.png)

如上图所示，当数据包进入本地（`LOCAL_IN` 挂载点）时，就会相继调用 `ipt_hook` 和 `fw_confirm` 钩子函数来处理数据包。另外，钩子函数还有优先级，优先级越小越先执行。

正因为挂载点是通过链表来存储钩子函数，所以挂载点又被称为 `链`，挂载点对应的链名称如下所示：

- `LOCAL_IN` 挂载点：又称为 `INPUT链`。
- `LOCAL_OUT` 挂载点：又称为 `OUTPUT链`。
- `FORWARD` 挂载点：又称为 `PORWARD链`。
- `PRE_ROUTING` 挂载点：又称为 `PREROUTING链`。
- `POST_ROUTING` 挂载点：又称为 `POSTOUTING链`。

## 2.  iptables

`iptables` 是建立在 `Netfilter` 之上的数据包过滤器，也就是说，`iptables` 通过向 `Netfilter` 的挂载点上注册钩子函数来实现对数据包过滤的。`iptables` 的实现比较复杂，所以先要慢慢介绍一下它的一些基本概念。

### 表

从 `iptables` 这个名字可以看出，它一定包含了 `表` 这个概念。`表` 是指一系列规则，可以看成是规则表。`iptables` 通过把这些规则表挂载在 `Netfilter` 的不同链上，对进出内核协议栈的数据包进行过滤或者修改操作。

`iptables` 定义了 4 种表，每种表都有其不同的用途：

#### **1. Filter表**

`Filter表` 用于过滤数据包。是 `iptables` 的默认表，因此如果你配置规则时没有指定表，那么就默认使用 `Filter表`，它分别挂载在以下 3 个链上：

- `INPUT链`
- `OUTPUT链`
- `PORWARD链`

#### **2. NAT表**

`NAT表` 用于对数据包的网络地址转换(IP、端口)，它分别挂载在以下 3 个链上：

- `PREROUTING链`
- `POSTOUTING链`
- `OUTPUT链`

#### **3. Mangle表**

`Mangle表` 用于修改数据包的服务类型或TTL，并且可以配置路由实现QOS，它分别挂载在以下 5 个链上：

- `PREROUTING链`
- `INPUT链`
- `PORWARD链`
- `OUTPUT链`
- `POSTOUTING链`

#### **4. Raw表**

`Raw表` 用于判定数据包是否被状态跟踪处理，它分别挂载在以下 2 个链上：

- `PREROUTING链`
- `OUTPUT链`

我们通过下图来展示各个表所挂载的链：

![Image](640-1648355508801.png)

上图展示了，数据包从网络中进入到内核协议栈的过程中，要执行的 `iptables` 规则，如果在执行某条 `iptables` 规则失败后，会直接把数据包丢弃，不会继续执行下面的规则。

拿其中一个链来看，如下图所示：

![Image](640-1648355509700.png)

也就是说，当数据包从网络中进入到内核协议栈后，在路由判定前会分别执行 `Raw表`、`Mangle表` 和 `NAT表` 中的规则。如果在执行规则时，某一条规则拒绝了数据包，那么数据包便会被丢弃，从而不会继续执行下面的规则。

## 3. 添加 iptables 规则

上面介绍了 `iptables` 的原理，下面主要介绍怎么向 `iptables` 中添加规则。要向 `iptables` 中添加规则，可以使用 `iptables` 命令，其使用格式如下：

```
iptables [选项 参数] ...
```

可选的选项如下：

```
-t <表>：指定要操纵的表；
-A <链>：向规则链中添加条目；
-D <链>：从规则链中删除条目；
-I <链>：向规则链中插入条目；
-R <链>：替换规则链中的条目；
-L：显示规则链中已有的条目；
-F：清楚规则链中已有的条目；
-Z：清空规则链中的数据包计算器和字节计数器；
-N：创建新的用户自定义规则链；
-P：定义规则链中的默认目标；
-h：显示帮助信息；
-p：指定要匹配的数据包协议类型；
-s：指定要匹配的数据包源ip地址；
-j <动作>：指定要进行的动作行为；
-i <网络接口>：指定数据包进入本机的网络接口；
-o <网络接口>：指定数据包要离开本机所使用的网络接口。
--dport <端口>：匹配目标端口号。
--sport <端口>：匹配来源端口号。
```

`iptables` 规则的选项比较多，一般来说，一条 `iptables` 规则主要由四个部分组成，如下图所示：

![Image](640-1648355509107.png)



- 第一部分可以通过 `-t` 选项来指定操作的表，如 `filter`、`nat`、`mangle` 或 `raw`。
- 第二部分可以通过 `-A`、`-D`、`-I` 或 `-R` 选项来指定操作的链，如 `INPUT`、`OUTPUT`、`FORWARD`、`PREROUTING` 或 `POSTOUTING`。
- 第三部分主要设置规则的匹配条件，如匹配源IP地址或者端口等。
- 第四部分主要设置规则匹配成功后进行的动作，如接收或拒绝等。

第一和第二部分比较简单，我们详细介绍一下第三和第四部分。

### 1. 匹配条件

`匹配条件` 分为 `基本匹配条件` 与 `扩展匹配条件`，基本匹配条件包括 `源IP地址` 和 `目标IP地址` 等，扩展匹配条件包括 `源端口` 和 `目标端口` 等。

### 2. 处理动作

`处理动作` 是指当匹配条件成功后要进行的一系列操作过程，动作也可以分为 `基本动作` 和 `扩展动作`。

此处列出一些常用的动作：

- `ACCEPT`：允许数据包通过。
- `DROP`：直接丢弃数据包，不给任何回应信息。
- `REJECT`：拒绝数据包通过，必要时会给数据发送端一个响应的信息，客户端刚请求就会收到拒绝的信息。
- `SNAT`：源IP地址转换。
- `MASQUERADE`：是SNAT的一种特殊形式，适用于动态IP上。
- `DNAT`：目标IP地址转换。
- `REDIRECT`：在本机做端口映射。
- `LOG`：在 `/var/log/messages` 文件中记录日志信息，然后将数据包传递给下一条规则，也就是说除了记录以外不对数据包做任何其他操作，仍然让下一条规则去匹配。

下面我们通过几个简单的例子来阐明 `iptables` 命令的使用：

**1. 允许本地回环接口(即运行本机访问本机)**

```
iptables -A INPUT -s 127.0.0.1 -d 127.0.0.1 -j ACCEPT  # 不指定表名时, 默认为filter表
```

**2. 允许访问80端口**

```
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
```

**3. 禁止数据转发**

```
iptables -A FORWARD -j REJECT
```

**4. 禁止IP段访问**

```
iptables -I INPUT -s 124.45.0.0/16 -j DROP   # 禁止IP段从123.45.0.1到123.45.255.254访问
```

**5. 查看已添加的 iptables 规则**

```
iptables -L -n -v
```



## 一、Netfilter 挂载点

我们先来回顾一下 Netfilter 的原理，Netfilter 是通过在网络协议栈的不同阶段注册钩子函数来实现对数据包的处理与过滤，如 图1 所示：

![Image](640.png)

在 图1 中，蓝色部分就是 Netfilter 挂载钩子函数的位置，所以 Netfilter 定义了 5 个常量来表示这 5 个位置，如下代码：

```c++
// 文件：include/linux/netfilter_ipv4.h

#define NF_IP_PRE_ROUTING   0
#define NF_IP_LOCAL_IN      1
#define NF_IP_FORWARD       2
#define NF_IP_LOCAL_OUT     3
#define NF_IP_POST_ROUTING  4
```

上面代码中的常量与 图1 中挂载钩子函数的位置一一对应，如常量 `NF_IP_PRE_ROUTING` 对应着 图1 的 `PRE_ROUTING` 处。

## 二、Netfilter 钩子函数链

前面说过，Netfilter 是通过在网络协议中的不同位置挂载钩子函数来对数据包进行过滤和处理，而且每个挂载点能够挂载多个钩子函数，所以 Netfilter 使用链表结构来存储这些钩子函数，如 图2 所示：

![Image](640-1648355375895.png)

如 图2 所示，Netfilter 的每个挂载点都使用一个链表来存储钩子函数列表。在内核中，定义了一个名为 `nf_hooks` 的数组来存储这些链表，如下代码：

```c++
// 文件：net/core/netfilter.c
struct list_head nf_hooks[32][5];
```

`struct list_head` 结构是内核的通用链表结构。

从 `nf_hooks` 变量定义为一个二维数组，第一维是用来表示不同的协议（如 IPv4 或者 IPv6，本文只讨论 IPv4，所以可以把 `nf_hooks` 当成是一维数组），而第二维用于表示不同的挂载点，如 图2 中的 5 个挂载点。

## 三、钩子函数

接下来我们介绍一下钩子函数在 Netfilter 中的存储方式。

前面我们介绍过，Netfilter 通过链表来存储钩子函数，而钩子函数是通过结构 `nf_hook_ops` 来描述的，其定义如下：

```c++
// 文件：include/linux/netfilter.h

struct nf_hook_ops
{
    struct list_head list; // 连接相同挂载点的钩子函数
    nf_hookfn *hook;       // 钩子函数指针
    int pf;                // 协议类型
    int hooknum;           // 钩子函数所在链
    int priority;          // 优先级
};
```

下面我们对 `nf_hook_ops` 结构的各个字段进行说明：

- `list`：用于把处于相同挂载点的钩子函数链接起来。
- `hook`：钩子函数指针，就是用于处理或者过滤数据包的函数。
- `pf`：协议类型，用于指定钩子函数挂载在 `nf_hooks` 数组第一维的位置，如 IPv4 协议设置为 `PF_INET`。
- `hooknum`：钩子函数所在链（挂载点），如 `NF_IP_PRE_ROUTING`。
- `priority`：钩子函数的优先级，用于管理钩子函数的调用顺序。

其中 `hook` 字段的类型为 `nf_hookfn`，`nf_hookfn` 类型的定义如下：

```c++
// 文件：include/linux/netfilter.h

typedef unsigned int nf_hookfn(unsigned int hooknum,
                               struct sk_buff **skb,
                               const struct net_device *in,
                               const struct net_device *out,
                               int (*okfn)(struct sk_buff *));
```

我们也介绍一下 `nf_hookfn` 函数的各个参数的作用：

- `hooknum`：钩子函数所在链（挂载点），如 `NF_IP_PRE_ROUTING`。
- `skb`：数据包对象，就是要处理或者过滤的数据包。
- `in`：接收数据包的设备对象。
- `out`：发送数据包的设备对象。
- `okfn`：当挂载点上所有的钩子函数都处理过数据包后，将会调用这个函数来对数据包进行下一步处理。

## 四、注册钩子函数

当定义好一个钩子函数结构后，需要调用 `nf_register_hook` 函数来将其注册到 `nf_hooks` 数组中，`nf_register_hook` 函数的实现如下：

```c++
// 文件：net/core/netfilter.c

int nf_register_hook(struct nf_hook_ops *reg)
{
    struct list_head *i;

    br_write_lock_bh(BR_NETPROTO_LOCK); // 对 nf_hooks 进行上锁
    // priority 字段表示钩子函数的优先级
    // 所以通过 priority 字段来找到钩子函数的合适位置
    for (i = nf_hooks[reg->pf][reg->hooknum].next;
         i != &nf_hooks[reg->pf][reg->hooknum];
         i = i->next)
    {
        if (reg->priority < ((struct nf_hook_ops *)i)->priority)
            break;
    }
    list_add(&reg->list, i->prev); // 把钩子函数添加到链表中
    br_write_unlock_bh(BR_NETPROTO_LOCK); // 对 nf_hooks 进行解锁
    return 0;
}
```

`nf_register_hook` 函数的实现比较简单，步骤如下：

- 对 `nf_hooks` 进行上锁操作，用于保护 `nf_hooks` 变量不受并发竞争。
- 通过钩子函数的优先级来找到其在钩子函数链表中的正确位置。
- 把钩子函数插入到链表中。
- 对 `nf_hooks` 进行解锁操作。

插入过程如 图3 所示：

![Image](640-1648355375599.png)

(图3 钩子函数插入过程)

如 图3 所示，我们要把优先级为 20 的钩子函数插入到 `PRE_ROUTING` 这个链中，而 `PRE_ROUTING` 链已经存在两个钩子函数，一个优先级为 10， 另外一个优先级为 30。

通过与链表中的钩子函数的优先级进行对比，发现新的钩子函数应该插入到优先级为 10 的钩子函数后面，所以就 如图3 所示就把新的钩子函数插入到优先级为 10 的钩子函数后面。

## 五、触发调用钩子函数

钩子函数已经被保存到不同的链上，那么什么时候才会触发调用这些钩子函数来处理数据包呢？

要触发调用某个挂载点上（链）的所有钩子函数，需要使用 `NF_HOOK` 宏来实现，其定义如下：

```c++
// 文件：include/linux/netfilter.h

#define NF_HOOK(pf, hook, skb, indev, outdev, okfn)    \
    (list_empty(&nf_hooks[(pf)][(hook)])               \
        ? (okfn)(skb)                                  \
        : nf_hook_slow((pf), (hook), (skb), (indev), (outdev), (okfn)))
```

首先介绍一下 `NF_HOOK` 宏的各个参数的作用：

- `pf`：协议类型，就是 `nf_hooks` 数组的第一个维度，如 IPv4 协议就是 `PF_INET`。
- `hook`：要调用哪一条链（挂载点）上的钩子函数，如 `NF_IP_PRE_ROUTING`。
- `indev`：接收数据包的设备对象。
- `outdev`：发送数据包的设备对象。
- `okfn`：当链上的所有钩子函数都处理完成，将会调用此函数继续对数据包进行处理。

而 `NF_HOOK` 宏的实现也比较简单，首先判断一下钩子函数链表是否为空，如果是空的话，就直接调用 `okfn` 函数来处理数据包，否则就调用 `nf_hook_slow` 函数来处理数据包。我们来看看 `nf_hook_slow` 函数的实现：

```c++
// 文件：net/core/netfilter.c

int nf_hook_slow(int pf, unsigned int hook, struct sk_buff *skb,
                 struct net_device *indev, struct net_device *outdev,
                 int (*okfn)(struct sk_buff *))
{
    struct list_head *elem;
    unsigned int verdict;
    int ret = 0;

    elem = &nf_hooks[pf][hook]; // 获取要调用的钩子函数链表

    // 遍历钩子函数链表，并且调用钩子函数对数据包进行处理
    verdict = nf_iterate(&nf_hooks[pf][hook], &skb, hook, indev, outdev, &elem, okfn);
    ...
    // 如果处理结果为 NF_ACCEPT, 表示数据包通过所有钩子函数的处理, 那么就调用 okfn 函数继续处理数据包
    // 如果处理结果为 NF_DROP, 表示数据包被拒绝, 应该丢弃此数据包
    switch (verdict) {
    case NF_ACCEPT:
        ret = okfn(skb);
        break;
    case NF_DROP:
        kfree_skb(skb);
        ret = -EPERM;
        break;
    }

    return ret;
}
```

`nf_hook_slow` 函数的实现也比较简单，过程如下：

- 首先调用 `nf_iterate` 函数来遍历钩子函数链表，并调用链表上的钩子函数来处理数据包。
- 如果处理结果为 `NF_ACCEPT`，表示数据包通过所有钩子函数的处理, 那么就调用 `okfn` 函数继续处理数据包。
- 如果处理结果为 `NF_DROP`，表示数据包没有通过钩子函数的处理，应该丢弃此数据包。

既然 Netfilter 是通过调用 `NF_HOOK` 宏来调用钩子函数链表上的钩子函数，那么内核在什么地方调用这个宏呢？

比如数据包进入 IPv4 协议层的处理函数 `ip_rcv` 函数中就调用了 `NF_HOOK` 宏来处理数据包，代码如下：

```c++
// 文件：net/ipv4/ip_input.c

int ip_rcv(struct sk_buff *skb, struct net_device *dev, struct packet_type *pt)
{
    ...
    return NF_HOOK(PF_INET, NF_IP_PRE_ROUTING, skb, dev, NULL, ip_rcv_finish);
}
```

如上代码所示，在 `ip_rcv` 函数中调用了 `NF_HOOK` 宏来处理输入的数据包，其调用的钩子函数链（挂载点）为 `NF_IP_PRE_ROUTING`。而 `okfn` 设置为 `ip_rcv_finish`，也就是说，当 `NF_IP_PRE_ROUTING` 链上的所有钩子函数都成功对数据包进行处理后，将会调用 `ip_rcv_finish` 函数来继续对数据包进行处理。

## 六、总结

本文主要介绍了 Netfilter 的实现，因为 Netfilter 是 Linux 网络数据包过滤的框架，而 iptables 就是建立在 Netfilter 之上的。所以，先了解 Netfilter 的实现对分析 iptables 的实现有非常大的帮助。