---
title: "【Spark】Spark 存储原理--写数据过程"
date: 2020-06-05 17:09:02
categories:
  - "Spark note"
  - "spark md"
---

# 【Spark】Spark 存储原理--写数据过程

本篇结构：

- 写数据块过程
- 写内存
- 写磁盘
- 写远程

## 一、写数据块过程

分析读数据过程时，可以了解到 RDD.iterator -> RDD.getOrCompute -> BlockManager.getOrElseUpdate 既是读数据的入口，也是写数据的入口。

不同的是，读数据走 BlockManager.get 方法，而写数据走 doPutIterator 方法。

在 doPutIterator 方法中，如果缓存到内存中，则需要先判断数据是否进行了反序列化，如果已经反序列化，调用 putIteratorAsValues 直接把数据存入内存，读取时不需要再进行反序列化，如果没有反序列化，则调用 putIteratorAsBytes 方法将序列化数据缓存，读取时需要进行反序列化。在存入内存时，需要判断在内存中展开该数据大小是否足够，如果足够，MemoryStore 直接 存入 entries 中，如果不够，如果启用磁盘存储，则存入磁盘。

数据写入完成时，一方面把数据块的元数据发送给 Driver 端的 BlockManagerMasterEndpoint 终端点，更新元数据。另一方面判断是否需要创建数据副本，如果需要则调用 replicate 方法，把数据写到远程节点。

过程图如下：

![img](https://upload-images.jianshu.io/upload_images/7017386-a7c96952c6a33118.jpg?imageMogr2/auto-orient/strip|imageView2/2/w/825/format/webp)

BlockManager # doPutIterator：

```scala
private def doPutIterator[T](
    blockId: BlockId,
    iterator: () => Iterator[T],
    level: StorageLevel,
    classTag: ClassTag[T],
    tellMaster: Boolean = true,
    keepReadLock: Boolean = false): Option[PartiallyUnrolledIterator[T]] = {
  doPut(blockId, level, classTag, tellMaster = tellMaster, keepReadLock = keepReadLock) { info =>
    val startTimeMs = System.currentTimeMillis
    var iteratorFromFailedMemoryStorePut: Option[PartiallyUnrolledIterator[T]] = None
    // Size of the block in bytes
    var size = 0L
    // 缓存到内存中
    if (level.useMemory) {
      // Put it in memory first, even if it also has useDisk set to true;
      // We will drop it to disk later if the memory store can't hold it.
      if (level.deserialized) {
        memoryStore.putIteratorAsValues(blockId, iterator(), classTag) match {
          // 写入内存成功，返回数据块大小
          case Right(s) =>
            size = s
          // 写入失败，运行存入磁盘则进行写磁盘操作，否则返回结果
          case Left(iter) =>
            // Not enough space to unroll this block; drop to disk if applicable
            if (level.useDisk) {
              logWarning(s"Persisting block $blockId to disk instead.")
              diskStore.put(blockId) { channel =>
                val out = Channels.newOutputStream(channel)
                serializerManager.dataSerializeStream(blockId, out, iter)(classTag)
              }
              size = diskStore.getSize(blockId)
            } else {
              iteratorFromFailedMemoryStorePut = Some(iter)
            }
        }
      } else { // !level.deserialized
        memoryStore.putIteratorAsBytes(blockId, iterator(), classTag, level.memoryMode) match {
          case Right(s) =>
            size = s
          case Left(partiallySerializedValues) =>
            // Not enough space to unroll this block; drop to disk if applicable
            if (level.useDisk) {
              logWarning(s"Persisting block $blockId to disk instead.")
              diskStore.put(blockId) { channel =>
                val out = Channels.newOutputStream(channel)
                partiallySerializedValues.finishWritingToStream(out)
              }
              size = diskStore.getSize(blockId)
            } else {
              iteratorFromFailedMemoryStorePut = Some(partiallySerializedValues.valuesIterator)
            }
        }
      }
    // 写入磁盘
    } else if (level.useDisk) {
      diskStore.put(blockId) { channel =>
        val out = Channels.newOutputStream(channel)
        serializerManager.dataSerializeStream(blockId, out, iterator())(classTag)
      }
      size = diskStore.getSize(blockId)
    }

    val putBlockStatus = getCurrentBlockStatus(blockId, info)
    val blockWasSuccessfullyStored = putBlockStatus.storageLevel.isValid
    if (blockWasSuccessfullyStored) {
      // Now that the block is in either the memory or disk store, tell the master about it.
      // 写入成功，向 Driver 上报元数据信息
      info.size = size
      if (tellMaster && info.tellMaster) {
        reportBlockStatus(blockId, putBlockStatus)
      }
      addUpdatedBlockStatusToTaskMetrics(blockId, putBlockStatus)
      logDebug("Put block %s locally took %s".format(blockId, Utils.getUsedTimeMs(startTimeMs)))
      // 如果需要创建副本，则复制到其他节点
      if (level.replication > 1) {
        val remoteStartTime = System.currentTimeMillis
        val bytesToReplicate = doGetLocalBytes(blockId, info)
        // [SPARK-16550] Erase the typed classTag when using default serialization, since
        // NettyBlockRpcServer crashes when deserializing repl-defined classes.
        // TODO(ekl) remove this once the classloader issue on the remote end is fixed.
        val remoteClassTag = if (!serializerManager.canUseKryo(classTag)) {
          scala.reflect.classTag[Any]
        } else {
          classTag
        }
        try {
          replicate(blockId, bytesToReplicate, level, remoteClassTag)
        } finally {
          bytesToReplicate.dispose()
        }
        logDebug("Put block %s remotely took %s"
          .format(blockId, Utils.getUsedTimeMs(remoteStartTime)))
      }
    }
    assert(blockWasSuccessfullyStored == iteratorFromFailedMemoryStorePut.isEmpty)
    iteratorFromFailedMemoryStorePut
  }
}
```

## 二、写内存

RDD 在缓存到内存之前，Partition 中的数据一般以迭代器( Iterator )的数据结构来访问，通过 Iterator 可以获得分区中每一条序列化或者非序列化的 Record，这些Record 在访问的时候占用的是 JVM 堆内存中 other 部分的内存区域，同一个Partition 的不同 Record 的空间并不是连续的。RDD 被缓存之后，会由 Partition 转化为 Block，并且存储位置变为了 Storage Memory 区域，此时 Block 中的 Record 所占用的内存空间是连续的。

Unroll 意思是展开，在 Spark 当中的意义就是将存储在 Partition 中的 Record 由不连续的存储空间转换为连续存储空间的过程。Unroll 操作的时候需要在 Storage Memory 当中通过`reserveUnrollMemoryForThisTask`来申请 Unroll 操作所需要的内存，使用完毕之后，又通过`releaseUnrollMemoryForThisTask`方法来释放这部分内存。

因为不能保证存储空间可以一次容纳 Iterator 中的所有数据，当前的计算任务在 Unroll 时要向 MemoryManager 申请足够的 Unroll 空间来临时占位，空间不足则 Unroll 失败，空间足够时可以继续进行。

Unroll 并不是一下子把数据展开到内存，而是分布进行，在每步中都先检查内存是否足够，如果内存不足，则尝试将内存中的数据写入磁盘，释放空间存放新写入的数据，当计算释放空间足够时，则把内存中释放的数据写入到磁盘并返回内存足够的结果，而当计算出释放所有空间都不足时，则返回内存不足的结果。

前面已经分析，写内存因数据类型不同，有 putIteratorAsValues 和 putIteratorAsBytes 两种方法，原理类似。择其一而观。

MemoryStore # putIteratorAsBytes：

```scala
private[storage] def putIteratorAsValues[T](
    blockId: BlockId,
    values: Iterator[T],
    classTag: ClassTag[T]): Either[PartiallyUnrolledIterator[T], Long] = {

  require(!contains(blockId), s"Block $blockId is already present in the MemoryStore")

  // Number of elements unrolled so far
  // 内存中展开元素的数量
  var elementsUnrolled = 0
  // Whether there is still enough memory for us to continue unrolling this block
  // 是否存在足够的内存用于继续展开该 Block
  var keepUnrolling = true
  // Initial per-task memory to request for unrolling blocks (bytes).
  // 每个展开线程初始化内存大小，可由 spark.storage.unrollMemoryThreshold 配置
  val initialMemoryThreshold = unrollMemoryThreshold
  // How often to check whether we need to request more memory
  // Block 在内存中展开，设置每经过给定的次数后检查是否需要申请内存，默认 16 次
  val memoryCheckPeriod = conf.get(UNROLL_MEMORY_CHECK_PERIOD)
  // Memory currently reserved by this task for this particular unrolling operation
  // 记录展开操作保留的内存大小，初始为 initialMemoryThreshold
  var memoryThreshold = initialMemoryThreshold
  // Memory to request as a multiple of current vector size
  // 内存增长因子
  val memoryGrowthFactor = conf.get(UNROLL_MEMORY_GROWTH_FACTOR)
  // Keep track of unroll memory used by this particular block / putIterator() operation
  // 展开该 Block 已使用内存大小
  var unrollMemoryUsedByThisBlock = 0L
  // Underlying vector for unrolling the block
  // 追踪该 Block 展示所使用的内存大小
  var vector = new SizeTrackingVector[T]()(classTag)

  // Request enough memory to begin unrolling
  // Block unroll 前，尝试获取初始化内存
  keepUnrolling =
    reserveUnrollMemoryForThisTask(blockId, initialMemoryThreshold, MemoryMode.ON_HEAP)

  if (!keepUnrolling) {
    logWarning(s"Failed to reserve initial memory threshold of " +
      s"${Utils.bytesToString(initialMemoryThreshold)} for computing block $blockId in memory.")
  } else {
    // 获取成功
    unrollMemoryUsedByThisBlock += initialMemoryThreshold
  }

  // Unroll this block safely, checking whether we have exceeded our threshold periodically
  // 在内存中迭代展开该 Block，定期判断是否超过分配内存大小
  while (values.hasNext && keepUnrolling) {
    vector += values.next()
    // 每 memoryCheckPeriod 进行一次检查，展开内存是否超过当前分配内存
    if (elementsUnrolled % memoryCheckPeriod == 0) {
      // If our vector's size has exceeded the threshold, request more memory
      val currentSize = vector.estimateSize()
      // 不足，申请内存
      if (currentSize >= memoryThreshold) {
        val amountToRequest = (currentSize * memoryGrowthFactor - memoryThreshold).toLong
        keepUnrolling =
          reserveUnrollMemoryForThisTask(blockId, amountToRequest, MemoryMode.ON_HEAP)
        // 申请成功，加入已使用内存
        if (keepUnrolling) {
          unrollMemoryUsedByThisBlock += amountToRequest
        }
        // New threshold is currentSize * memoryGrowthFactor
        memoryThreshold += amountToRequest
      }
    }
    elementsUnrolled += 1
  }

  // 成功展开 Block
  if (keepUnrolling) {
    // We successfully unrolled the entirety of this block
    val arrayValues = vector.toArray
    vector = null
    val entry =
      new DeserializedMemoryEntry[T](arrayValues, SizeEstimator.estimate(arrayValues), classTag)
    // 计算该 Block 在内存中的存储大小
    val size = entry.size
      
    // 定义内部方法，先释放 Block 在内存展开的空间，然后再判断内存是否足够用于写入数据
    def transferUnrollToStorage(amount: Long): Unit = {
      // Synchronize so that transfer is atomic
      memoryManager.synchronized {
        releaseUnrollMemoryForThisTask(MemoryMode.ON_HEAP, amount)
        val success = memoryManager.acquireStorageMemory(blockId, amount, MemoryMode.ON_HEAP)
        assert(success, "transferring unroll memory to storage memory failed")
      }
    }
    // Acquire storage memory if necessary to store this block in memory.
    // 计算内存是否足够空间保存该 Block
    val enoughStorageMemory = {
      // 比较展开内存和 Block 所需内存大小
      if (unrollMemoryUsedByThisBlock <= size) {
        // 展开内存不够，则需申请还差的内存
        val acquiredExtra =
          memoryManager.acquireStorageMemory(
            blockId, size - unrollMemoryUsedByThisBlock, MemoryMode.ON_HEAP)
        // 申请成功，进入 transferUnrollToStorage
        if (acquiredExtra) {
          transferUnrollToStorage(unrollMemoryUsedByThisBlock)
        }
        acquiredExtra
      } else { // unrollMemoryUsedByThisBlock > size
        // If this task attempt already owns more unroll memory than is necessary to store the
        // block, then release the extra memory that will not be used.
        // 展开的内存大于 Block 所需内存，则释放多余的内存
        val excessUnrollMemory = unrollMemoryUsedByThisBlock - size
        releaseUnrollMemoryForThisTask(MemoryMode.ON_HEAP, excessUnrollMemory)
        transferUnrollToStorage(size)
        true
      }
    }
    // 如果有足够的内存，把 Block 放到内存的 entries 中，并返回占用内存大小
    if (enoughStorageMemory) {
      entries.synchronized {
        entries.put(blockId, entry)
      }
      logInfo("Block %s stored as values in memory (estimated size %s, free %s)".format(
        blockId, Utils.bytesToString(size), Utils.bytesToString(maxMemory - blocksMemoryUsed)))
      Right(size)
    } else {
      // 内存不足，则返回该数据块在内存部分展开的消息及大小等信息
      assert(currentUnrollMemoryForThisTask >= unrollMemoryUsedByThisBlock,
        "released too much unroll memory")
      Left(new PartiallyUnrolledIterator(
        this,
        MemoryMode.ON_HEAP,
        unrollMemoryUsedByThisBlock,
        unrolled = arrayValues.toIterator,
        rest = Iterator.empty))
    }
  } else {
    // We ran out of space while unrolling the values for this block
    logUnrollFailureMessage(blockId, vector.estimateSize())
    Left(new PartiallyUnrolledIterator(
      this,
      MemoryMode.ON_HEAP,
      unrollMemoryUsedByThisBlock,
      unrolled = vector.iterator,
      rest = values))
  }
}
```

- 1.首先获取初始化内存，大小为 unrollMemoryThreshold ，获取完毕后，返回是否成功的结果 keepUnrolling 。

```scala
// Initial per-task memory to request for unrolling blocks (bytes).
val initialMemoryThreshold = unrollMemoryThreshold
```

unrollMemoryThreshold 可由配置控制。

```scala
// Initial memory to request before unrolling any block
private val unrollMemoryThreshold: Long =
  conf.getLong("spark.storage.unrollMemoryThreshold", 1024 * 1024)
```

- 2.循环遍历 Iterator[T] ，如果 hasNext 为 true 并且 keepUnrolling 为 true，则 elementsUnrolled 自增加 1，如果 hasNext 为 false 或者 keepUnrolling 为 false，调到 4。
- 3.在循环遍历的过程中，每 memoryCheckPerriod （memoryCheckPerriod 可由 spark.storage.unrollMemoryCheckPeriod 设置，默认为 16）即进行一次展开内存大小是否超过当前分配内存的检查，没有超出继续展开，超出了则需要申请内存，申请增加的内存为：val amountToRequest = (currentSize * memoryGrowthFactor - memoryThreshold).toLong（即当前展开大小*内存增长因子-当前分配的内存大小），若申请成功，则加入已使用的内存。
- 4.判断数据是否在内存中成功展开（keepUnrolling ？ true），如果失败，则记录内存不足并退出；如果成功，继续往下。
- 5.先估算该数据块在内存中存储的大小，因为是每隔 memoryCheckPerriod 检查展开内存是否足够，所以在最终分配前还需再进行判断，如果数据块展开的内存小于等于数据块存储的大小（unrollMemoryUsedByThisBlock <= size），说明展开内存的大小不够，还需申请内存，申请成功，调用 transferUnrollToStorage 进入 6；而如果展开的内存大于数据块的内存，则需要释放多余的内存，再调用 transferUnrollToStorage 进入 6。
- 6.transferUnrollToStorage 中，释放该数据块在内存展开的空间，然后再申请一块连续的内存，大小为数据块内存大小，如果成功，则把数据放到内存的 entries 中，否则返回内存不足，写入失败的消息。

## 三、写磁盘

将 Block 写入磁盘，调用 DiskStore 的 put 方法。

DiskStore # put：

```scala
def put(blockId: BlockId)(writeFunc: WritableByteChannel => Unit): Unit = {
  if (contains(blockId)) {
    throw new IllegalStateException(s"Block $blockId is already present in the disk store")
  }
  logDebug(s"Attempting to put block $blockId")
  val startTime = System.currentTimeMillis
  val file = diskManager.getFile(blockId)
  val out = new CountingWritableChannel(openForWrite(file))
  var threwException: Boolean = true
  try {
    writeFunc(out)
    blockSizes.put(blockId, out.getCount)
    threwException = false
  } finally {
    try {
      out.close()
    } catch {
      case ioe: IOException =>
        if (!threwException) {
          threwException = true
          throw ioe
        }
    } finally {
       if (threwException) {
        remove(blockId)
      }
    }
  }
  val finishTime = System.currentTimeMillis
  logDebug("Block %s stored as %s file on disk in %d ms".format(
    file.getName,
    Utils.bytesToString(file.length()),
    finishTime - startTime))
}
```

该方法中，先获取 Block 存入文件句柄，然后把数据序列化为数据流，最后根据传递进来的回调方法 writeFunc 把数据写入文件。

## 四、写远程

如何需要备份数据，则需进行远程数据写入，整个过程和读数据中分析的远程读取差不多，就不再赘述。