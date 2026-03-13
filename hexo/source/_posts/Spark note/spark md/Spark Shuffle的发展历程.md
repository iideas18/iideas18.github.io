---
title: "图解Spark Shuffle的发展历程"
date: 2019-10-17 03:38:14
slug: "Spark Shuffle的发展历程"
categories:
  - "Spark note"
  - "spark md"
---

# 图解Spark Shuffle的发展历程

2018-09-12 15:31:02  更多



版权声明：本文为博主原创文章，遵循[ CC 4.0 BY-SA ](http://creativecommons.org/licenses/by-sa/4.0/)版权协议，转载请附上原文出处链接和本声明。本文链接：https://blog.csdn.net/dmy1115143060/article/details/82661801

# 一、Spark Hash Shuffle

​       基于Hash的Shuffle Write操作较为简单，这种Shuffle方式中，Shuffle Map Task会根据下游生成的Partition个数来创建中间文件来存储对应的Partition数据。如下图所示，下游生成3个Partition，此时每个Shuffle Map Task会生成3个中间文件来存储3个Partition中的数据。如一个Shuffle Map Task在处理数据<1, 1>, <2, 1>, <3, 1>时，会分别将<1, 1>, <2, 2>, <3,3>写入到Partition 1（1 % 3 = 1）, Partition 2（2 % 3 = 2）和Partition 0（3 % 3 = 0）对应的文件中。

​       基于Hash的Shuffle Write操作虽然较为简单，但是带来的问题是会创建大量的中间文件，假设Shuffle Map Task个数记为 M, 下游生成的Partition个数为 P，此时生成的**中间文件个数为 M * P**。而对于这种Shuffle中间文件比较小的情况，多次的磁盘IO开销是不容忽视的。

![img](https://img-blog.csdn.net/20180912150108866?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L2RteTExMTUxNDMwNjA=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

#  二、Spark Consolidate Shuffle

​        Spark Consolidate Shuffle是对Spark Hash Shuffle的优化，相比较于Spark Hash Shuffle中的每个Shuffle Map Task都会生成多个Shuffle中间文件的问题，Spark Consolidate Shuffle采用同一个Core上运行的Shuffle Map Task输出的中间数据放在相同的中间文件中。具体做法如下图所示：Core 1上先运行一个Shuffle Map Task，然后改Shuffle Map Task会创建3个Shuffle中间文件并完成Shuffle中间数据的写入（此步骤和Spark Hash Shuffle一样）。而对于Core 1上接下来运行的Shuffle Map Task则不会继续创建Shuffle中间文件，此时后继的Shuffle Map Task会在已创建的Shuffle中间文件中追加数据。

​        Spark Consolidate Shuffle将同一个Core上的Shuffle Map Task输出的中间数据保存到相同的Shuffle中间文件中，有效的减少了中间的个数。假设参与Shuffle运算的核数记为 C，下游生成的Partition个数记为 P，则Shuffle过程生成的中间文件个数为 C * P。这种方式虽然在一定程度上减少了Shuffle中间文件的个数，但是当并行度较大时，仍然会带来大量的磁盘IO。

![img](https://img-blog.csdn.net/20180912150209535?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L2RteTExMTUxNDMwNjA=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)

# 三、 Spark Sort Based Shuffle

​       为了解决Shuffle过程中生成大量Shuffle中间文件问题，Spark采用了Sort Based Shuffle。这种方式下，上游的每个Shuffle Map Task只会生成一个Shuffle中间文件和一个Index索引文件。Shuffle Map Task在处理数据时，借助一个AppendOnlyMap数据结构来保存中间数据，当达到阈值时，会将AppendOnlyMap中的数据溢写到磁盘上生成一个SpillMap文件，当Shuffle Map Task完成时，则会将生成的SpillMap文件和内存中剩余的数据进行合并成一个文件。在此过程实际上会涉及到排序，但是Spark为了避免不必要的排序，只会在需要进行聚集运算时才会对数据进行排序，否则只会按照Partition ID进行排序。

​        Spar Sort Based Shuffle有效地解决了Shuffle过程中生成大量中间文件的问题，假设Shuffle Map Task的个数为 M，则最终生成的中间文件个数为 2 * M。

![img](https://img-blog.csdn.net/201809121504157?watermark/2/text/aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L2RteTExMTUxNDMwNjA=/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70)