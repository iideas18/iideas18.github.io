---
title: "Spark高效数据结构"
date: 2019-11-22 22:31:44
categories:
  - "Spark note"
  - "spark md"
  - "scala"
---

# Spark高效数据结构

(https://www.jianshu.com/u/cda766963c7e)

[我要大声告诉你](https://www.jianshu.com/u/cda766963c7e)关注

2017.01.23 04:00:31字数 981阅读 1,095

> Spark Streaming在状态管理时应用了一些高效的数据结构，本文我们就来看下这些数据结构的实现。

- BitSet
- OpenHashSet
- OpenHashMap

# 1. BitSet

> `org.apache.spark.util.collection.BitSet`是一个简单，大小不可变的bit set实现。

## 1. 基本思想

我们先来看一个例子：假设我们要对3，5存储到一个byte(8个字节)当中。
我们先开辟一个Byte空间，并将这些bit位全都置为0。如下图：

![img](https://upload-images.jianshu.io/upload_images/1381055-d4312b1f7967af0b.png?imageMogr2/auto-orient/strip|imageView2/2/w/792/format/webp)

我们需要将3存储到这个bit数组当中，那么我们只要将下标为3的空间置为1。
记整个数为`s`，欲存储的数3为`i1`。那么我们就可以通过下列代码来实现。

```scala
var s = 0
val i1 = 3
s |= 1 << i1
println(s"${s}的二进制表达式: [ ${Integer.toBinaryString(s)} ]")
```

输出结果：

```css
8的二进制表达式: [ 1000 ]
```

![img](https://upload-images.jianshu.io/upload_images/1381055-08209f4821d6dbf4.png?imageMogr2/auto-orient/strip|imageView2/2/w/792/format/webp)

同样，我们要存储5，只要将下标5的空间置为1.

![img](https://upload-images.jianshu.io/upload_images/1381055-b240ddd25512a6d0.png?imageMogr2/auto-orient/strip|imageView2/2/w/792/format/webp)

代码实现：

```scala
val i2 = 5
s |= 1 << i2
println(s"${s}的二进制表达式: [ ${Integer.toBinaryString(s)} ]")
```

输出结果：

```css
40的二进制表达式: [ 101000 ]
```

读取过程：

我们可以通过判断某index位的bit是否为0来判定该空间是否有值。
例如，我们可以判断index = 3位是否为0来判断3是否存储在该byte值当中。

```scala
println(s & (1 << 3))
8
println(s & (1 << 4))
0
```

## 2. BitSet实现

有上诉的知识基础只是之后我们再来看下`org.apache.spark.util.collection.BitSet`的具体实现。

BitSet利用一个Long型words数组来存储数值

![img](https://upload-images.jianshu.io/upload_images/1381055-6f2898bd5baa06ae.png?imageMogr2/auto-orient/strip|imageView2/2/w/1200/format/webp)

我们先来看下他的构造函数：

```scala
private val words = new Array[Long](bit2words(numBits))
// Long型个数
private val numWords = words.length
// 计算存储numBits数值需要多少个Long型
private def bit2words(numBits: Int) = ((numBits - 1) >> 6) + 1
```

我们可以看到：

> - BitSet通过Long来存储正真的数据，原因是Java中，Long类型为8个字节，那么一个Long型可以存储(8 * 8 = 64)个数值。
> - `bit2words`方法是计算存储`numBits`个数值最少需要多少个Long型。
> - 所能容纳个数：`((numBits - 1) / 64) + 1) * 64`

再来看下其他一些重要方法的实现：

### **2.1 set**方法

```scala
def set(index: Int) {
  val bitmask = 1L << (index & 0x3f)
  words(index >> 6) |= bitmask     
}
```

> - `index & 0x3f`等于保留index二进制的前六位。因为在Scala中，Long型为8个字节，一个字节8个bit，共64bit，而从上述知识我们可以知道，我们是利用bit下标来存储数值的，所以我们需要对index保留前六位的操作。
> - `index >> 6`等于`index / 64`。这是为了算出index在words数组中的位置。
> - `words(index >> 6) |= bitmask`是将index存储到words(index >> 6)所在的Long型当中。

### **2.2 get**方法:

```scala
def get(index: Int): Boolean = {
  val bitmask = 1L << (index & 0x3f)  
  (words(index >> 6) & bitmask) != 0 
}
```

从上面我们就可以看到，我们可以这样理解，words是个大的二维数组，整个set过程就是将index置为1的过程，而get过程就是判断index是否为0。

### 2.3 iterator

```scala
  def iterator: Iterator[Int] = new Iterator[Int] {
    var ind = nextSetBit(0)
    override def hasNext: Boolean = ind >= 0
    override def next(): Int = {
      val tmp = ind
      ind = nextSetBit(ind + 1)
      tmp
    }
  }
  def nextSetBit(fromIndex: Int): Int = {
    var wordIndex = fromIndex >> 6
    if (wordIndex >= numWords) {
      return -1
    }

    val subIndex = fromIndex & 0x3f
    var word = words(wordIndex) >> subIndex
    // 如果当前word的剩余位还有值，说明下个bit在该word当中。
    if (word != 0) {
      // 下一个bit所在的下标 = wordIndex * 64 + 当前word已经移动的下标个数 + word剩余位第一个非0位下标
      return (wordIndex << 6) + subIndex + java.lang.Long.numberOfTrailingZeros(word)
    }

    // 下个bit位不和fromIndex在同一个word中的情况
    wordIndex += 1
    while (wordIndex < numWords) {
      word = words(wordIndex)
      if (word != 0) {
        // 下一个bit所在的下标 = wordIndex * 64 + word第一个非0位下标
        return (wordIndex << 6) + java.lang.Long.numberOfTrailingZeros(word)
      }
      wordIndex += 1
    }

    -1
  }
```

### 2.4 优点

> - **运算效率高。** get和set过程都采用移位运算，提高运算效率。
> - **占有的存储空间少。** 一个Long型可以存储64个数值。那么如果N = 10,000,000，需要N/8 = 10,000,000/8 Byte 约等 1.25M

完整代码请访问[GitHub](https://link.jianshu.com/?t=https://github.com/apache/spark/blob/master/core/src/main/scala/org/apache/spark/util/collection/BitSet.scala)

# 2. OpenHashSet

- A simple, fast hash set optimized for non-null insertion-only use case, where keys are never removed.

看完BitSet实现之后，我们再来看下`org.apache.spark.util.collection.OpenHashSet`的实现。

```scala
  protected val hasher: Hasher[T] = 
  protected var _capacity = nextPowerOf2(initialCapacity)
  protected var _mask = _capacity - 1
  protected var _size = 0
  protected var _growThreshold = (loadFactor * _capacity).toInt
  protected var _bitset = new BitSet(_capacity)
  protected var _data: Array[T] = _
  _data = new Array[T](_capacity)
```

> - OpenHashSet利用一个var _bitset = new BitSet(_capacity)来存储hash值，var _data = new Array[T] (_capacity)来存储真正的数。

```scala
def add(k: T) {
  // 将元素添加到set当中，并且不触发扩容
  addWithoutResize(k)
  // 检查是否需要扩容，如果是则进行扩容
  rehashIfNeeded(k, grow, move)
}
```

> rehash的判断条件是当前set的size是否大于阀值_growThreshold

我们再来具体看下`addWithoutResize`的实现。

```scala
def addWithoutResize(k: T): Int = {
  // 获取元素k的hash值。采用对k的hashCode做murmur3_32，为了获取一个k的随机分布，减少hash冲突。
  var pos = hashcode(hasher.hash(k)) & _mask
  var delta = 1
  while (true) {
    if (!_bitset.get(pos)) {
      // 当前bitset没值
      _data(pos) = k
      _bitset.set(pos)
      _size += 1
      return pos | NONEXISTENCE_MASK
    } else if (_data(pos) == k) {
      // 当前bitset位有值，而且元素与k相等，则直接返回pos
      return pos
    } else {
      // 发生hash冲突，则每次递增1进行hash冲突解决。& _mask保证0 < pos + delta < _capacity
      pos = (pos + delta) & _mask
      delta += 1
    }
  }
  throw new RuntimeException("Should never reach here.")
}
```

### rehash

```scala
  private def rehash(k: T, allocateFunc: (Int) => Unit, moveFunc: (Int, Int) => Unit) {
    // 扩容为原容量两倍
    val newCapacity = _capacity * 2
    allocateFunc(newCapacity)
    val newBitset = new BitSet(newCapacity)
    val newData = new Array[T](newCapacity)
    val newMask = newCapacity - 1

    var oldPos = 0
    while (oldPos < capacity) {
      if (_bitset.get(oldPos)) {
        val key = _data(oldPos)
        var newPos = hashcode(hasher.hash(key)) & newMask
        var i = 1
        var keepGoing = true
        while (keepGoing) {
          if (!newBitset.get(newPos)) {
            // 将key插入新的位置
            newData(newPos) = key
            newBitset.set(newPos)
            moveFunc(oldPos, newPos)
            keepGoing = false
          } else { // 无需检查key的相等性，无重复数据。
            // 哈希冲突解决
            val delta = i
            newPos = (newPos + delta) & newMask
            i += 1
          }
        }
      }
      oldPos += 1
    }
```

> - rehash的是将原来的容量扩大为两倍，并将bitset中的hash值和_data中的真正的元素都插入到新的newBitset和newData当中。
> - 提供了两个回调函数`allocateFunc(newSize: Int)`和`moveFunc(oldPos: Int, newPos: Int)`。OpenHashSet的默认回调函数实现为空，即什么都不操作。

> **NOET:** 完整代码访问[GitHub](https://link.jianshu.com/?t=https://github.com/apache/spark/blob/master/core/src/main/scala/org/apache/spark/util/collection/OpenHashSet.scala)

# 3. OpenHashMap

```scala
protected var _keySet = new OpenHashSet[K](initialCapacity)
private var _values: Array[V] = _
// 临时数组，用于扩容时_values的拷贝
private var _oldValues: Array[V] = null
```

> - `var _keySet: OpenHashSet[K]`存储key，`var _value: Array[V]`存储value

## updata

```scala
  def update(k: K, v: V) {
    if (k == null) {
      haveNullValue = true
      nullValue = v
    } else {
      val pos = _keySet.addWithoutResize(k) & OpenHashSet.POSITION_MASK
      _values(pos) = v
      _keySet.rehashIfNeeded(k, grow, move)
      _oldValues = null
    }
  }
  protected var grow = (newCapacity: Int) => {
    _oldValues = _values
    _values = new Array[V](newCapacity)
  }

  protected var move = (oldPos: Int, newPos: Int) => {
    _values(newPos) = _oldValues(oldPos)
  }
```

> **NOET:** 完整代码访问[GitHub](https://link.jianshu.com/?t=https://github.com/apache/spark/blob/master/core/src/main/scala/org/apache/spark/util/collection/OpenHashMap.scala)