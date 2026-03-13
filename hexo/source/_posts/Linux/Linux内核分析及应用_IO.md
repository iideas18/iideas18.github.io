---
title: "第5章 输入输出"
date: 2022-04-27 15:32:04
slug: "Linux内核分析及应用_IO"
categories:
  - "Linux"
---



# 第5章 输入输出

从操作系统层面来讲是广义的I/O架构，主要围绕read/write系统调用，从读写文件到最终转换成block块写入磁盘等设备。

本章将介绍以下内容：

> -  I/O在Linux中的生命周期，以及在如下层中完成的任务：vfs、文件系统、页面缓存、block、scsi层等
> - I/O相关的调度器，以及不同场景应该选择哪个调度器
> - 多队列机制
> - I/O多路复用实现
> - 一些开源系统和操作系统中与I/O相关调用的实现

## 1. I/O在Linux中的生命周期

现在我们已经知道输入输出对计算机的重要性，那么下面就介绍Linux的I/O实现，并分析一个I/O是如何产生并且是如何完成使命的。

### 1.1 vfs层

要了解I/O的产生，最直观的就是read、write等系统调用。在这里，我们需要注意一个比较重要的概念：对于Linux来讲，一切都是文件，所以进行I/O读写操作的时候，如读写磁盘或其他设备，都会和vfs层挂钩。

![image-20220427152410287](Linux%E5%86%85%E6%A0%B8%E5%88%86%E6%9E%90%E5%8F%8A%E5%BA%94%E7%94%A8_IO/image-20220427152410287.png)

Linux为了屏蔽底层文件系统和驱动程序等细节，对文件的操作首先通过vfs接口层来转发系统调用的open、read、write、close等请求，如图5-2所示。限于篇幅，下面仅围绕read和write请求来分析读I/O的来龙去脉。下面是read调用的实现（代码详见：Linux/fs/red_write.c）：

![image-20220427152437404](Linux%E5%86%85%E6%A0%B8%E5%88%86%E6%9E%90%E5%8F%8A%E5%BA%94%E7%94%A8_IO/image-20220427152437404.png)

sys_read执行的时候，首先获取当前文件已经读取的位置，然后调用vfs层的vfs_read，在vfs_read中校验文件是否可读，要访问的buf内存块是否可用，文件读取的位置是否越界，权限检测等。然后__vfs_read调用真正的文件系统层进行read操作：

![image-20220427152527250](Linux%E5%86%85%E6%A0%B8%E5%88%86%E6%9E%90%E5%8F%8A%E5%BA%94%E7%94%A8_IO/image-20220427152527250.png)

在新版本的内核中，vfs_read操作的逻辑在new_sync_read中，因为ext4文件系统注册的是read_iter方法，具体过程我们后面分析，在new_sync_read中最终执行了file-＞f_op-＞read_iter，把控制权交给了ext4之类的文件系统。所以可以把vfs理解为是Linux对上层提供的统一文件系统的抽象，底层有不同的实现，比如ext4、proc、sysfs等，这也是Linux一切皆是文件的原因。

### 1.2 文件系统层

通过read在vfs层中的执行，我们发现最终会调用具体文件系统的操作。这里我们以ext4文件系统为例，其文件操作函数在/linux-4.5.2/fs/ext4/file.c中注册：

![image-20220427152601920](Linux%E5%86%85%E6%A0%B8%E5%88%86%E6%9E%90%E5%8F%8A%E5%BA%94%E7%94%A8_IO/image-20220427152601920.png)

在ext4_iget初始化inode的时候会进行注册：

![image-20220427152620993](Linux%E5%86%85%E6%A0%B8%E5%88%86%E6%9E%90%E5%8F%8A%E5%BA%94%E7%94%A8_IO/image-20220427152620993.png)

然后在vfs_open打开文件的时候调用了do_dentry_open：

![image-20220427152638685](Linux%E5%86%85%E6%A0%B8%E5%88%86%E6%9E%90%E5%8F%8A%E5%BA%94%E7%94%A8_IO/image-20220427152638685.png)

至此彻底搞清楚了，ext4的read和write文件最终委托给了：

![image-20220427152655324](Linux%E5%86%85%E6%A0%B8%E5%88%86%E6%9E%90%E5%8F%8A%E5%BA%94%E7%94%A8_IO/image-20220427152655324.png)

同理，sys_write的系统调用过程为：sys_write-＞vfs_write-＞__vfs_write-＞new_sync_write，并且在new_sync_write函数中的filp-＞f_op-＞write_iter其实就是ext4_file_write_iter。其实现为：

上述过程看起来很长，其实总结出来就以下几步：

1. 状态、权限校验。

2. 把数据写入文件。

3. 同步数据到磁盘。

在上述代码中，__generic_file_write_iter可谓承上启下，尤其重要：

![image-20220427153037223](Linux%E5%86%85%E6%A0%B8%E5%88%86%E6%9E%90%E5%8F%8A%E5%BA%94%E7%94%A8_IO/image-20220427153037223.png)