---
title: "Apache Kafka 基本操作"
date: 2020-12-06 23:10:59
categories:
  - "Spark note"
  - "spark md"
---

# Apache Kafka 基本操作

2020-10-20 10:15 更新

首先让我们开始实现单节点单代理配置，然后我们将我们的设置迁移到单节点多代理配置。

希望你现在可以在你的机器上安装 Java，ZooKeeper 和 Kafka 。 在迁移到 `Kafka Cluster Setup` 之前，首先需要启动 ZooKeeper，因为 `Kafka Cluster` 使用 ZooKeeper。

## 启动ZooKeeper

打开一个新终端并键入以下命令 -

```
bin/zookeeper-server-start.sh config/zookeeper.properties
```

要启动 `Kafka Broker`，请键入以下命令 -

```
bin/kafka-server-start.sh config/server.properties
```

启动 `Kafka Broker`后，在 ZooKeeper 终端上键入命令 `jps` ，您将看到以下响应 -

```
821 QuorumPeerMain
928 Kafka
931 Jps
```

现在你可以看到两个守护进程运行在终端上，`QuorumPeerMain` 是 ZooKeeper 守护进程，另一个是 `Kafka 守护进程。

Apache Kafka 基本操作_w3cschool
首先让我们开始实现单节点单代理配置，然后我们将我们的设置迁移到单节点多代理配置。
首先让我们开始实现单节点单代理配置，然后我们将我们的设置迁移到单节点多代理配置。

希望你现在可以在你的机器上安装 Java，ZooKeeper 和 Kafka 。 在迁移到 Kafka Cluster Setup 之前，首先需要启动 ZooKeeper，因为 Kafka Cluster 使用 ZooKeeper。

启动 ZooKeeper
打开一个新终端并键入以下命令 -

```
bin/zookeeper-server-start.sh config/zookeeper.properties
```

要启动 Kafka Broker，请键入以下命令 -

bin/kafka-server-start.sh config/server.properties

启动 Kafka Broker后，在 ZooKeeper 终端上键入命令 jps ，您将看到以下响应 -

821 QuorumPeerMain
928 Kafka
931 Jps

现在你可以看到两个守护进程运行在终端上，QuorumPeerMain 是 ZooKeeper 守护进程，另一个是 Kafka 守护进程。


单节点 - 单代理配置
在此配置中，您有一个 ZooKeeper 和代理 id 实例。 以下是配置它的步骤 -

创建 Kafka 主题 - Kafka 提供了一个名为 kafka-topics.sh 的命令行实用程序，用于在服务器上创建主题。 打开新终端并键入以下示例。

语法

bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 
--partitions 1 --topic topic-name

示例

bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1   
--partitions 1 --topic Hello-Kafka

我们刚刚创建了一个名为 Hello-Kafka 的主题，其中包含一个分区和一个副本因子。 上面创建的输出将类似于以下输出 -

输出 - 创建主题 Hello-Kafka 

创建主题后，您可以在 Kafka 代理终端窗口中获取通知，并在 config / server.properties 文件中的“/ tmp / kafka-logs /"中指定的创建主题的日志。

主题列表
要获取 Kafka 服务器中的主题列表，可以使用以下命令 -

语法

bin/kafka-topics.sh --list --zookeeper localhost:2181

输出

Hello-Kafka

由于我们已经创建了一个主题，它将仅列出 Hello-Kafka 。 假设，如果创建多个主题，您将在输出中获取主题名称。

启动生产者以发送消息
语法

bin/kafka-console-producer.sh --broker-list localhost:9092 --topic topic-name

从上面的语法，生产者命令行客户端需要两个主要参数 -

代理列表 - 我们要发送邮件的代理列表。 在这种情况下，我们只有一个代理。 Config / server.properties 文件包含代理端口 ID，因为我们知道我们的代理正在侦听端口 9092，因此您可以直接指定它。

主题名称 - 以下是主题名称的示例。

示例

bin/kafka-console-producer.sh --broker-list localhost:9092 --topic Hello-Kafka

生产者将等待来自 stdin 的输入并发布到 Kafka 集群。 默认情况下，每个新行都作为新消息发布，然后在 config / producer.properties 文件中指定默认生产者属性。 现在，您可以在终端中键入几行消息，如下所示。

输出

$ bin/kafka-console-producer.sh --broker-list localhost:9092 
--topic Hello-Kafka[2016-01-16 13:50:45,931] 
WARN property topic is not valid (kafka.utils.Verifia-bleProperties)
Hello
My first message

My second message

启动消费者以接收消息
与生产者类似，在config / consumer.proper-ties 文件中指定了缺省使用者属性。 打开一个新终端并键入以下消息消息语法。

语法

bin/kafka-console-consumer.sh --zookeeper localhost:2181 —topic topic-name 
--from-beginning

示例

bin/kafka-console-consumer.sh --zookeeper localhost:2181 —topic Hello-Kafka 
--from-beginning

输出

Hello
My first message
My second message

最后，您可以从制作商的终端输入消息，并看到他们出现在消费者的终端。 到目前为止，您对具有单个代理的单节点群集有非常好的了解。 现在让我们继续讨论多个代理配置。

单节点多代理配置
在进入多个代理集群设置之前，首先启动 ZooKeeper 服务器。

创建多个Kafka Brokers - 我们在配置/ server.properties 中已有一个 Kafka 代理实例。 现在我们需要多个代理实例，因此将现有的 server.prop-erties 文件复制到两个新的配置文件中，并将其重命名为 server-one.properties 和 server-two.properties。 然后编辑这两个新文件并分配以下更改 -

config / server-one.properties
# The id of the broker. This must be set to a unique integer for each broker.
broker.id=1
# The port the socket server listens on
port=9093
# A comma seperated list of directories under which to store log files
log.dirs=/tmp/kafka-logs-1

config / server-two.properties
# The id of the broker. This must be set to a unique integer for each broker.
broker.id=2
# The port the socket server listens on
port=9094
# A comma seperated list of directories under which to store log files
log.dirs=/tmp/kafka-logs-2

启动多个代理 - 在三台服务器上进行所有更改后，打开三个新终端，逐个启动每个代理。

Broker1
bin/kafka-server-start.sh config/server.properties
Broker2
bin/kafka-server-start.sh config/server-one.properties
Broker3
bin/kafka-server-start.sh config/server-two.properties

现在我们有三个不同的经纪人在机器上运行。 自己尝试，通过在 ZooKeeper 终端上键入 jps 检查所有守护程序，然后您将看到响应。

创建主题
让我们为此主题将复制因子值指定为三个，因为我们有三个不同的代理运行。 如果您有两个代理，那么分配的副本值将是两个。

语法

bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 3 
-partitions 1 --topic topic-name

示例

bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 3 
-partitions 1 --topic Multibrokerapplication

输出

created topic “Multibrokerapplication"

 Describe 命令用于检查哪个代理正在侦听当前创建的主题，如下所示 -

bin/kafka-topics.sh --describe --zookeeper localhost:2181 
--topic Multibrokerappli-cation

输出

bin/kafka-topics.sh --describe --zookeeper localhost:2181 
--topic Multibrokerappli-cation

Topic:Multibrokerapplication    PartitionCount:1 
ReplicationFactor:3 Configs:

Topic:Multibrokerapplication Partition:0 Leader:0 
Replicas:0,2,1 Isr:0,2,1

从上面的输出，我们可以得出结论，第一行给出所有分区的摘要，显示主题名称，分区数量和我们已经选择的复制因子。 在第二行中，每个节点将是分区的随机选择部分的领导者。

在我们的例子中，我们看到我们的第一个 broker(with broker.id 0)是领导者。 然后 Replicas:0,2,1 意味着所有代理复制主题最后 Isr 是 in-sync 副本的集合。 那么，这是副本的子集，当前活着并被领导者赶上。

启动生产者以发送消息
此过程保持与单代理设置中相同。

示例

bin/kafka-console-producer.sh --broker-list localhost:9092 
--topic Multibrokerapplication

输出

bin/kafka-console-producer.sh --broker-list localhost:9092 --topic Multibrokerapplication
[2016-01-20 19:27:21,045] WARN Property topic is not valid (kafka.utils.Verifia-bleProperties)
This is single node-multi broker demo
This is the second message

启动消费者以接收消息
此过程保持与单代理设置中所示的相同。

示例

bin/kafka-console-consumer.sh --zookeeper localhost:2181 
—topic Multibrokerapplica-tion --from-beginning

输出

bin/kafka-console-consumer.sh --zookeeper localhost:2181 
—topic Multibrokerapplica-tion —from-beginning
This is single node-multi broker demo
This is the second message

基本主题操作
在本章中，我们将讨论各种基本主题操作。

修改主题
您已经了解如何在 Kafka Cluster 中创建主题。 现在让我们使用以下命令修改已创建的主题

语法

bin/kafka-topics.sh —zookeeper localhost:2181 --alter --topic topic_name 
--parti-tions count

示例

We have already created a topic “Hello-Kafka" with single partition count and one replica factor. 
Now using “alter" command we have changed the partition count.
bin/kafka-topics.sh --zookeeper localhost:2181 
--alter --topic Hello-kafka --parti-tions 2

输出

WARNING: If partitions are increased for a topic that has a key, 
the partition logic or ordering of the messages will be affected
Adding partitions succeeded!

删除主题
要删除主题，可以使用以下语法。

语法

bin/kafka-topics.sh --zookeeper localhost:2181 --delete --topic topic_name

示例

bin/kafka-topics.sh --zookeeper localhost:2181 --delete --topic Hello-kafka

输出

> Topic Hello-kafka marked for deletion

注意 - 如果 delete.topic.enable 未设置为 true，则此操作不会产生任何影响

```

```