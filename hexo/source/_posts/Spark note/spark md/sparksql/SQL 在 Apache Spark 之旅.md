---
title: "[一条 SQL 在 Apache Spark 之旅（上）](https://www.iteblog.com/archives/2561.html)"
date: 2019-10-18 03:22:08
slug: "SQL 在 Apache Spark 之旅"
categories:
  - "Spark note"
  - "spark md"
  - "sparksql"
---

# [一条 SQL 在 Apache Spark 之旅（上）](https://www.iteblog.com/archives/2561.html)

[Spark](https://www.iteblog.com/archives/tag/spark/) SQL 是 [Spark](https://www.iteblog.com/archives/tag/spark/) 众多组件中技术最复杂的组件之一，它同时支持 SQL 查询和 DataFrame DSL。通过引入了 SQL 的支持，大大降低了开发人员的学习和使用成本。目前，整个 SQL 、[Spark](https://www.iteblog.com/archives/tag/spark/) ML、Spark Graph 以及 Structured Streaming 都是运行在 Catalyst Optimization & Tungsten Execution 之上的，如下图所示：

[![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_architecture-iteblog.png)](https://s.iteblog.com/pic/spark/spark_architecture-iteblog.png)

所以，正常的 SQL 执行先会经过 SQL Parser 解析 SQL，然后经过 Catalyst 优化器处理，最后到 Spark 执行。而 Catalyst 的过程又分为很多个过程，其中包括：

- **Analysis**：主要利用 Catalog 信息将 Unresolved Logical Plan 解析成 Analyzed logical plan；
- **Logical Optimizations**：利用一些 Rule （规则）将 Analyzed logical plan 解析成 Optimized Logical Plan；
- **Physical Planning**：前面的 logical plan 不能被 Spark 执行，而这个过程是把 logical plan 转换成多个 physical plans，然后利用代价模型（cost model）选择最佳的 physical plan；
- **Code Generation**：这个过程会把 SQL 查询生成 Java 字节码。

所以整个 SQL 的执行过程可以使用下图表示：

[![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_catalyst-iteblog.jpg)](https://s.iteblog.com/pic/spark/spark_catalyst-iteblog.jpg)其中蓝色部分就是 Catalyst 优化器处理的部分，也是本文重点介绍的部分。下面我们以一条简单的 SQL 为例，从 High-level 角度介绍 一条 SQL 在 Spark 之旅。本文我们用到的 SQL 查询语句如下：

```sql
`SELECT` `sum``(v)``    ``FROM` `(``      ``SELECT``        ``t1.id,``    ``1 + 2 + t1.value ``AS` `v``    ``FROM` `t1 ``JOIN` `t2``      ``WHERE``    ``t1.id = t2.id ``AND``    ``t1.cid = 1 ``AND``    ``t1.did = t1.cid + 1 ``AND``      ``t2.id > 5) iteblog`
```

## SQL 解析阶段 - SparkSqlParser

为了能够在 Spark 中运行 SQL 查询，第一步肯定是需要解析这条 SQL。在 Spark 1.x 版本中，SQL 的解析有两种方法：

- 基于 Scala parser combinator 实现
- 基于 Hive 的 SQL 解析

可以通过 `spark.sql.dialect` 来设置。虽然 SQL 的解析引擎可以选择，但是这种方案有以下几个问题：Scala parser combinator 解析器有时候会给出错误信息，而且在定义语法中存在冲突不会发出警告；而 Hive SQL 解析引擎依赖于 Hive，这导致扩展性不好。

为了解决这个问题，从 Spark 2.0.0 版本开始引入了第三方语法解析器工具 ANTLR（详情参见 [SPARK-12362](https://www.iteblog.com/redirect.php?url=aHR0cHM6Ly9pc3N1ZXMuYXBhY2hlLm9yZy9qaXJhL2Jyb3dzZS9TUEFSSy0xMjM2Mg==&article=true)），Antlr 是一款强大的语法生成器工具，可用于读取、处理、执行和翻译结构化的文本或二进制文件，是当前 Java 语言中使用最为广泛的语法生成器工具，我们常见的大数据 SQL 解析都用到了这个工具，包括 Hive、Cassandra、Phoenix、Pig 以及 presto 等。目前最新版本的 Spark 使用的是 ANTLR4，通过这个对 SQL 进行词法分析并构建语法树。

具体的，Spark 基于 presto 的语法文件定义了 Spark SQL 语法文件 SqlBase.g4（路径 spark-2.4.3\sql\catalyst\src\main\antlr4\org\apache\spark\sql\catalyst\parser\SqlBase.g4），这个文件定义了 Spark SQL 支持的 SQL 语法。如果我们需要自定义新的语法，需要在这个文件定义好相关语法。然后使用 ANTLR4 对 SqlBase.g4 文件自动解析生成几个 Java 类，其中就包含重要的**词法分析器** SqlBaseLexer.java 和**语法分析器**SqlBaseParser.java。运行上面的 SQL 会使用 SqlBaseLexer 来解析关键词以及各种标识符等；然后使用 SqlBaseParser 来构建语法树。整个过程就类似于下图。

[![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/antlr4_iteblog.jpg)](https://s.iteblog.com/pic/spark/antlr4_iteblog.jpg)生成语法树之后，使用 AstBuilder 将语法树转换成 LogicalPlan，这个 LogicalPlan 也被称为 Unresolved LogicalPlan。解析后的逻辑计划如下：

```sql
== Parsed Logical Plan ==
'Project [unresolvedalias('sum('v), None)]
+- 'SubqueryAlias `iteblog`
   +- 'Project ['t1.id, ((1 + 2) + 't1.value) AS v#16]
      +- 'Filter ((('t1.id = 't2.id) && ('t1.cid = 1)) && (('t1.did = ('t1.cid + 1)) && ('t2.id > 5)))
         +- 'Join Inner
            :- 'UnresolvedRelation `t1`
            +- 'UnresolvedRelation `t2`
```

图片表示如下：

[![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_unresolved_logical_plan-iteblog.jpg)](https://s.iteblog.com/pic/spark/spark_unresolved_logical_plan-iteblog.jpg)

Unresolved LogicalPlan 是从下往上看的，t1 和 t2 两张表被生成了 UnresolvedRelation，过滤的条件、选择的列以及聚合字段都知道了，SQL 之旅的第一个过程就算完成了。

## 绑定逻辑计划阶段 - Analyzer

在 SQL 解析阶段生成了 Unresolved LogicalPlan，从上图可以看出逻辑算子树中包含了 UnresolvedRelation 和 unresolvedalias 等对象。Unresolved LogicalPlan 仅仅是一种数据结构，不包含任何数据信息，比如不知道数据源、数据类型，不同的列来自于哪张表等。Analyzer 阶段会使用事先定义好的 Rule 以及 SessionCatalog 等信息对 Unresolved LogicalPlan 进行 transform。SessionCatalog 主要用于各种函数资源信息和元数据信息（数据库、数据表、数据视图、数据分区与函数等）的统一管理。而Rule 是定义在 Analyzer 里面的，如下具体如下：

```sql
lazy val batches: Seq[Batch] = Seq(
    Batch("Hints", fixedPoint,
      new ResolveHints.ResolveBroadcastHints(conf),
      ResolveHints.ResolveCoalesceHints,
      ResolveHints.RemoveAllHints),
    Batch("Simple Sanity Check", Once,
      LookupFunctions),
    Batch("Substitution", fixedPoint,
      CTESubstitution,
      WindowsSubstitution,
      EliminateUnions,
      new SubstituteUnresolvedOrdinals(conf)),
    Batch("Resolution", fixedPoint,
      ResolveTableValuedFunctions ::                    //解析表的函数
      ResolveRelations ::                               //解析表或视图
      ResolveReferences ::                              //解析列
      ResolveCreateNamedStruct ::
      ResolveDeserializer ::                            //解析反序列化操作类
      ResolveNewInstance ::
      ResolveUpCast ::                                  //解析类型转换
      ResolveGroupingAnalytics ::
      ResolvePivot ::
      ResolveOrdinalInOrderByAndGroupBy ::
      ResolveAggAliasInGroupBy ::
      ResolveMissingReferences ::
      ExtractGenerator ::
      ResolveGenerate ::
      ResolveFunctions ::                               //解析函数
      ResolveAliases ::                                 //解析表别名
      ResolveSubquery ::                                //解析子查询
      ResolveSubqueryColumnAliases ::
      ResolveWindowOrder ::
      ResolveWindowFrame ::
      ResolveNaturalAndUsingJoin ::
      ResolveOutputRelation ::
      ExtractWindowExpressions ::
      GlobalAggregates ::
      ResolveAggregateFunctions ::
      TimeWindowing ::
      ResolveInlineTables(conf) ::
      ResolveHigherOrderFunctions(catalog) ::
      ResolveLambdaVariables(conf) ::
      ResolveTimeZone(conf) ::
      ResolveRandomSeed ::
      TypeCoercion.typeCoercionRules(conf) ++
      extendedResolutionRules : _*),
    Batch("Post-Hoc Resolution", Once, postHocResolutionRules: _*),
    Batch("View", Once,
      AliasViewChild(conf)),
    Batch("Nondeterministic", Once,
      PullOutNondeterministic),
    Batch("UDF", Once,
      HandleNullInputsForUDF),
    Batch("FixNullability", Once,
      FixNullability),
    Batch("Subquery", Once,
      UpdateOuterReferences),
    Batch("Cleanup", fixedPoint,
      CleanupAliases)
)
```

从上面代码可以看出，多个性质类似的 Rule 组成一个 Batch，比如上面名为 Hints 的 Batch就是由很多个 Hints Rule 组成；而多个 Batch 构成一个 batches。这些 batches 会由 RuleExecutor 执行，先按一个一个 Batch 顺序执行，然后对 Batch 里面的每个 Rule 顺序执行。每个 Batch 会之心一次（Once）或多次（FixedPoint，由
`spark.sql.optimizer.maxIterations` 参数决定），执行过程如下：

[![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_batch_ruleexecutor-iteblog.jpg)](https://s.iteblog.com/pic/spark/spark_batch_ruleexecutor-iteblog.jpg)

所以上面的 SQL 经过这个阶段生成的 Analyzed Logical Plan 如下：

```sql
`== Analyzed Logical Plan ==``sum``(``v``): bigint``Aggregate [``sum``(cast(``v``#16 as bigint)) AS sum(v)#22L]``+- SubqueryAlias `iteblog```   ``+- Project [``id``#0, ((1 + 2) + value#1) AS v#16]``      ``+- Filter (((``id``#0 = id#8) && (cid#2 = 1)) && ((did#3 = (cid#2 + 1)) && (id#8 > 5)))``         ``+- Join Inner``            ``:- SubqueryAlias `t1```            ``:  +- Relation[``id``#0,value#1,cid#2,did#3] csv``            ``+- SubqueryAlias `t2```               ``+- Relation[``id``#8,value#9,cid#10,did#11] csv`
```

从上面的结果可以看出，t1 和 t2 表已经解析成带有 id、value、cid 以及 did 四个列的表，其中这个表的数据源来自于 csv 文件。而且每个列的位置和数据类型已经确定了，sum 被解析成 Aggregate 函数了。下面是从 Unresolved LogicalPlan 转换到 Analyzed Logical Plan 对比图。

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_analyzed_logical_plan-iteblog.jpg)

到这里， Analyzed LogicalPlan 就完全生成了。由于篇幅的原因，剩余的 SQL 处理我将在下一篇文章进行介绍，包括逻辑计划优化、代码生成等东西，敬请关注。





# [一条 SQL 在 Apache Spark 之旅（中）](https://www.iteblog.com/archives/2562.html)

在 [《一条 SQL 在 Apache Spark 之旅（上）》](https://www.iteblog.com/archives/2561.html) 文章中我们介绍了一条 SQL 在 Apache [Spark](https://www.iteblog.com/archives/tag/spark/) 之旅的 Parser 和 Analyzer 两个过程，本文接上文继续介绍。

文章目录

- 1 优化逻辑计划阶段 - Optimizer
  - [1.1 谓词下推](https://www.iteblog.com/archives/2562.html#i)
  - [1.2 列裁剪](https://www.iteblog.com/archives/2562.html#i-2)
  - [1.3 常量替换](https://www.iteblog.com/archives/2562.html#i-3)
  - [1.4 常量累加](https://www.iteblog.com/archives/2562.html#i-4)
- [2 生成可执行的物理计划阶段 - SparkPlanner](https://www.iteblog.com/archives/2562.html#_-_SparkPlanner)

## 优化逻辑计划阶段 - Optimizer

在前文的绑定逻辑计划阶段对 Unresolved LogicalPlan 进行相关 transform 操作得到了 Analyzed Logical Plan，这个 Analyzed Logical Plan 是可以直接转换成 Physical Plan 然后在 [Spark](https://www.iteblog.com/archives/tag/spark/) 中执行。但是如果直接这么弄的话，得到的 Physical Plan 很可能不是最优的，因为在实际应用中，很多低效的写法会带来执行效率的问题，需要进一步对Analyzed Logical Plan 进行处理，得到更优的逻辑算子树。于是， 针对 SQL 逻辑算子树的优化器 Optimizer 应运而生。

这个阶段的优化器主要是基于规则的（Rule-based Optimizer，简称 RBO），而绝大部分的规则都是启发式规则，也就是基于直观或经验而得出的规则，比如列裁剪（过滤掉查询不需要使用到的列）、谓词下推（将过滤尽可能地下沉到数据源端）、常量累加（比如 1 + 2 这种事先计算好） 以及常量替换（比如 SELECT * FROM table WHERE i = 5 AND j = i + 3 可以转换成 SELECT * FROM table WHERE i = 5 AND j = 8）等等。

与前文介绍绑定逻辑计划阶段类似，这个阶段所有的规则也是实现 Rule 抽象类，多个规则组成一个 Batch，多个 Batch 组成一个 batches，同样也是在 RuleExecutor 中进行执行，由于前文已经介绍了 Rule 的执行过程，本节就不再赘述。

那么针对前文的 SQL 语句，这个过程都会执行哪些优化呢？这里按照 Rule 执行顺序一一进行说明。

### 谓词下推

谓词下推在 [Spark](https://www.iteblog.com/archives/tag/spark/) SQL 是由 `PushDownPredicate` 实现的，这个过程主要将过滤条件尽可能地下推到底层，最好是数据源。所以针对我们上面介绍的 SQL，使用谓词下推优化得到的逻辑计划如下：

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_pushdownpredicate-iteblog.jpg)

从上图可以看出，谓词下推将 Filter 算子直接下推到 Join 之前了（注意，上图是从下往上看的）。也就是在扫描 t1 表的时候会先使用 ((((isnotnull(cid#2) && isnotnull(did#3)) && (cid#2 = 1)) && (did#3 = 2)) && (id#0 > 50000)) && isnotnull(id#0) 过滤条件过滤出满足条件的数据；同时在扫描 t2 表的时候会先使用 isnotnull(id#8) && (id#8 > 50000) 过滤条件过滤出满足条件的数据。经过这样的操作，可以大大减少 Join 算子处理的数据量，从而加快计算速度。

### 列裁剪

列裁剪在 Spark SQL 是由 `ColumnPruning` 实现的。因为我们查询的表可能有很多个字段，但是每次查询我们很大可能不需要扫描出所有的字段，这个时候利用列裁剪可以把那些查询不需要的字段过滤掉，使得扫描的数据量减少。所以针对我们上面介绍的 SQL，使用列裁剪优化得到的逻辑计划如下：

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_columnpruning-iteblog.jpg)

从上图可以看出，经过列裁剪后，t1 表只需要查询 id 和 value 两个字段；t2 表只需要查询 id 字段。这样减少了数据的传输，而且如果底层的文件格式为列存（比如 Parquet），可以大大提高数据的扫描速度的。

### 常量替换

常量替换在 Spark SQL 是由 `ConstantPropagation` 实现的。也就是将变量替换成常量，比如 SELECT * FROM table WHERE i = 5 AND j = i + 3 可以转换成 SELECT * FROM table WHERE i = 5 AND j = 8。这个看起来好像没什么的，但是如果扫描的行数非常多可以减少很多的计算时间的开销的。经过这个优化，得到的逻辑计划如下：

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_constantpropagation-iteblog.jpg)

我们的查询中有 `t1.cid = 1 AND t1.did = t1.cid + 1` 查询语句，从里面可以看出 t1.cid 其实已经是确定的值了，所以我们完全可以使用它计算出 t1.did。

### 常量累加

常量累加在 Spark SQL 是由 `ConstantFolding` 实现的。这个和常量替换类似，也是在这个阶段把一些常量表达式事先计算好。这个看起来改动的不大，但是在数据量非常大的时候可以减少大量的计算，减少 CPU 等资源的使用。经过这个优化，得到的逻辑计划如下：

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_constantfolding-iteblog.jpg)

所以经过上面四个步骤的优化之后，得到的优化之后的逻辑计划为：

```sql
== Optimized Logical Plan ==
Aggregate [sum(cast(v#16 as bigint)) AS sum(v)#22L]
+- Project [(3 + value#1) AS v#16]
   +- Join Inner, (id#0 = id#8)
      :- Project [id#0, value#1]
      :  +- Filter (((((isnotnull(cid#2) && isnotnull(did#3)) && (cid#2 = 1)) && (did#3 = 2)) && (id#0 > 5)) && isnotnull(id#0))
      :     +- Relation[id#0,value#1,cid#2,did#3] csv
      +- Project [id#8]
         +- Filter (isnotnull(id#8) && (id#8 > 5))
            +- Relation[id#8,value#9,cid#10,did#11] csv
```

对应的图如下：

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_optimizedlogicalplan-iteblog.jpg)

到这里，优化逻辑计划阶段就算完成了。另外，Spark 内置提供了多达70个优化 Rule，详情请参见 [这里](https://www.iteblog.com/redirect.php?url=aHR0cHM6Ly9naXRodWIuY29tL2FwYWNoZS9zcGFyay9ibG9iL21hc3Rlci9zcWwvY2F0YWx5c3Qvc3JjL21haW4vc2NhbGEvb3JnL2FwYWNoZS9zcGFyay9zcWwvY2F0YWx5c3Qvb3B0aW1pemVyL09wdGltaXplci5zY2FsYSNMNTk=&article=true)。

## 生成可执行的物理计划阶段 - SparkPlanner

前面介绍的逻辑计划在 Spark 里面其实并不能被执行的，为了能够执行这个 SQL，一定需要翻译成物理计划，到这个阶段 Spark 就知道如何执行这个 SQL 了。和前面逻辑计划绑定和优化不一样，这里使用的是策略（Strategy），而且前面介绍的逻辑计划绑定和优化经过 Transformations 动作之后，树的类型并没有改变，也就是说：Expression 经过 Transformations 之后得到的还是 Transformations ；Logical Plan 经过 Transformations 之后得到的还是 Logical Plan。而到了这个阶段，经过 Transformations 动作之后，树的类型改变了，由 Logical Plan 转换成 Physical Plan 了。

一个逻辑计划（Logical Plan）经过一系列的策略处理之后，得到多个物理计划（Physical Plans），物理计划在 Spark 是由 SparkPlan 实现的。多个物理计划再经过代价模型（Cost Model）得到选择后的物理计划（Selected Physical Plan），整个过程如下所示：

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_cost_model-iteblog.png)

Cost Model 对应的就是基于代价的优化（Cost-based Optimizations，CBO，主要由华为的大佬们实现的，详见 [SPARK-16026](https://www.iteblog.com/redirect.php?url=aHR0cHM6Ly9pc3N1ZXMuYXBhY2hlLm9yZy9qaXJhL2Jyb3dzZS9TUEFSSy0xNjAyNg==&article=true) ），核心思想是计算每个物理计划的代价，然后得到最优的物理计划。但是在目前最新版的 Spark 2.4.3，这一部分并没有实现，直接返回多个物理计划列表的第一个作为最优的物理计划，如下：

```scala
lazy val sparkPlan: SparkPlan = {
    SparkSession.setActiveSession(sparkSession)
    // TODO: We use next(), i.e. take the first plan returned by the planner, here for now,
    //       but we will implement to choose the best plan.
    planner.plan(ReturnAnswer(optimizedPlan)).next()
}
```

而 [SPARK-16026](https://www.iteblog.com/redirect.php?url=aHR0cHM6Ly9pc3N1ZXMuYXBhY2hlLm9yZy9qaXJhL2Jyb3dzZS9TUEFSSy0xNjAyNg==&article=true) 引入的 CBO 优化主要是在前面介绍的**优化逻辑计划阶段 - Optimizer** 阶段进行的，对应的 Rule 为 `CostBasedJoinReorder`，并且默认是关闭的，需要通过 `spark.sql.cbo.enabled` 或 `spark.sql.cbo.joinReorder.enabled` 参数开启。
所以到了这个节点，最后得到的物理计划如下：

```scala
== Physical Plan ==
*(3) HashAggregate(keys=[], functions=[sum(cast(v#16 as bigint))], output=[sum(v)#22L])
+- Exchange SinglePartition
   +- *(2) HashAggregate(keys=[], functions=[partial_sum(cast(v#16 as bigint))], output=[sum#24L])
      +- *(2) Project [(3 + value#1) AS v#16]
         +- *(2) BroadcastHashJoin [id#0], [id#8], Inner, BuildRight
            :- *(2) Project [id#0, value#1]
            :  +- *(2) Filter (((((isnotnull(cid#2) && isnotnull(did#3)) && (cid#2 = 1)) && (did#3 = 2)) && (id#0 > 5)) && isnotnull(id#0))
            :     +- *(2) FileScan csv [id#0,value#1,cid#2,did#3] Batched: false, Format: CSV, Location: InMemoryFileIndex[file:/iteblog/t1.csv], PartitionFilters: [], PushedFilters: [IsNotNull(cid), IsNotNull(did), EqualTo(cid,1), EqualTo(did,2), GreaterThan(id,5), IsNotNull(id)], ReadSchema: struct<id:int,value:int,cid:int,did:int>
            +- BroadcastExchange HashedRelationBroadcastMode(List(cast(input[0, int, true] as bigint)))
               +- *(1) Project [id#8]
                  +- *(1) Filter (isnotnull(id#8) && (id#8 > 5))
                     +- *(1) FileScan csv [id#8] Batched: false, Format: CSV, Location: InMemoryFileIndex[file:/iteblog/t2.csv], PartitionFilters: [], PushedFilters: [IsNotNull(id), GreaterThan(id,5)], ReadSchema: struct<id:int>
```

从上面的结果可以看出，物理计划阶段已经知道数据源是从 csv 文件里面读取了，也知道文件的路径，数据类型等。而且在读取文件的时候，直接将过滤条件（PushedFilters）加进去了。同时，这个 Join 变成了 BroadcastHashJoin，也就是将 t2 表的数据 Broadcast 到 t1 表所在的节点。图表示如下：

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_physical_plan-iteblog.png)

到这里， Physical Plan 就完全生成了。由于篇幅的原因，剩余的 SQL 处理我将在下一篇文章进行介绍，包括代码生成（WholeStageCodeGen）以及执行相关的等东西，敬请关注。







# [一条 SQL 在 Apache Spark 之旅（下）](https://www.iteblog.com/archives/2563.html)

终于到最后一篇了，我们在前面两篇文章中[《一条 SQL 在 Apache Spark 之旅（上）》](https://www.iteblog.com/archives/2561.html) 和 [《一条 SQL 在 Apache Spark 之旅（中）》](https://www.iteblog.com/archives/2562.html) 介绍了 [Spark](https://www.iteblog.com/archives/tag/spark/) SQL 之旅的 SQL 解析、逻辑计划绑定、逻辑计划优化以及物理计划生成阶段，本文我们将继续接上文，介绍 [Spark](https://www.iteblog.com/archives/tag/spark/) SQL 的全阶段代码生成以及最后的执行过程。

文章目录

- 1 全阶段代码生成阶段 - WholeStageCodegen
  - [1.1 为什么需要代码生成](https://www.iteblog.com/archives/2563.html#i)
  - [1.2 表达式代码生成（expression codegen）](https://www.iteblog.com/archives/2563.html#expression_codegen)
  - [1.3 全阶段代码生成（Whole-stage Code Generation）](https://www.iteblog.com/archives/2563.html#Whole-stage_Code_Generation)
  - [1.4 代码编译](https://www.iteblog.com/archives/2563.html#i-2)
- [2 SQL 执行](https://www.iteblog.com/archives/2563.html#SQL)

## 全阶段代码生成阶段 - WholeStageCodegen

前面我们已经介绍了从逻辑计划生成物理计划（Physical Plan），但是这个物理计划还是不能直接交给 Spark 执行的，Spark 最后仍然会用一些 Rule 对 SparkPlan 进行处理，这个过程是 prepareForExecution 过程，这些 Rule 如下：

```scala
`protected` `def preparations: Seq[Rule[SparkPlan]] = Seq(``   ``PlanSubqueries(sparkSession),                          ``//特殊子查询物理计划处理``   ``EnsureRequirements(sparkSession.sessionState.conf),    ``//确保执行计划分区与排序正确性``   ``CollapseCodegenStages(sparkSession.sessionState.conf), ``//代码生成``   ``ReuseExchange(sparkSession.sessionState.conf),         ``//节点重用``   ``ReuseSubquery(sparkSession.sessionState.conf))         ``//子查询重用`
```

上面的 Rule 中 `CollapseCodegenStages` 是重头戏，这就是大家熟知的全代码阶段生成，Catalyst 全阶段代码生成的入口就是这个规则。当然，如果需要 Spark 进行全阶段代码生成，需要将 `spark.sql.codegen.wholeStage` 设置为 true（默认）。

### 为什么需要代码生成

在介绍代码生成之前，我们先来了解一下 Spark SQL 为什么需要引入代码生成。在 Apache Spark 2.0 之前，Spark SQL 的底层实现是基于 Volcano Iterator Model（参见 [《Volcano-An Extensible and Parallel Query Evaluation System》](https://www.iteblog.com/redirect.php?url=aHR0cDovL3BhcGVyaHViLnMzLmFtYXpvbmF3cy5jb20vZGFjZTUyYTQyYzA3ZjdmODM0OGIwOGRjMmIxODYwNjEucGRm&article=true)） 的，这个是由 Goetz Graefe 在 1993 年提出的，当今绝大多数数据库系统处理 SQL 在底层都是基于这个模型的。这个模型的执行可以概括为：首先数据库引擎会将 SQL 翻译成一系列的关系代数算子或表达式，然后依赖这些关系代数算子逐条处理输入数据并产生结果。每个算子在底层都实现同样的接口，比如都实现了 next() 方法，然后最顶层的算子 next() 调用子算子的 next()，子算子的 next() 在调用孙算子的 next()，直到最底层的 next()，具体过程如下图表示：

Volcano Iterator Model 的优点是抽象起来很简单，很容易实现，而且可以通过任意组合算子来表达复杂的查询。但是缺点也很明显，存在大量的虚函数调用，会引起 CPU 的中断，最终影响了执行效率。[数砖的官方博客](https://www.iteblog.com/redirect.php?url=aHR0cHM6Ly9kYXRhYnJpY2tzLmNvbS9ibG9nLzIwMTYvMDUvMjMvYXBhY2hlLXNwYXJrLWFzLWEtY29tcGlsZXItam9pbmluZy1hLWJpbGxpb24tcm93cy1wZXItc2Vjb25kLW9uLWEtbGFwdG9wLmh0bWw=&article=true)对比过使用 Volcano Iterator Model 和手写代码的执行效率，结果发现手写的代码执行效率要高出十倍！

基于上面的发现，从 Apache Spark 2.0 开始，社区开始引入了 Whole-stage Code Generation，参见 [SPARK-12795](https://www.iteblog.com/redirect.php?url=aHR0cHM6Ly9pc3N1ZXMuYXBhY2hlLm9yZy9qaXJhL2Jyb3dzZS9TUEFSSy0xMjc5NQ==&article=true)，主要就是想通过这个来模拟手写代码，从而提升 Spark SQL 的执行效率。Whole-stage Code Generation 来自于2011年 Thomas Neumann 发表的 [Efficiently Compiling Efficient Query Plans for Modern Hardware](https://www.iteblog.com/redirect.php?url=aHR0cDovL3d3dy52bGRiLm9yZy9wdmxkYi92b2w0L3A1MzktbmV1bWFubi5wZGY=&article=true) 论文，这个也是 Tungsten 计划的一部分。

Tungsten 代码生成分为三部分：

- 表达式代码生成（expression codegen）
- 全阶段代码生成（Whole-stage Code Generation）
- 加速序列化和反序列化（speed up serialization/deserialization）

### 表达式代码生成（expression codegen）

这个其实在 Spark 1.x 就有了。表达式代码生成的基类是 org.apache.spark.sql.catalyst.expressions.codegen.CodeGenerator，其下有七个子类：

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_expression_evaluation-iteblog.png)

我们前文的 SQL 生成的逻辑计划中的 `isnotnull(id#8) && (id#8 > 5)` 就是最基本的表达式。它也是一种 Predicate，所以会调用 org.apache.spark.sql.catalyst.expressions.codegen.GeneratePredicate 来生成表达式的代码，生成的代码如下：

```scala
19/06/18 16:47:15 DEBUG GeneratePredicate: Generated predicate '(isnotnull(input[0, int, true]) && (input[0, int, true] > 5))':
/* 001 */ public SpecificPredicate generate(Object[] references) {
/* 002 */   return new SpecificPredicate(references);
/* 003 */ }
/* 004 */
/* 005 */ class SpecificPredicate extends org.apache.spark.sql.catalyst.expressions.codegen.Predicate {
/* 006 */   private final Object[] references;
/* 007 */
/* 008 */
/* 009 */   public SpecificPredicate(Object[] references) {
/* 010 */     this.references = references;
/* 011 */
/* 012 */   }
/* 013 */
/* 014 */   public void initialize(int partitionIndex) {
/* 015 */
/* 016 */   }
/* 017 */
/* 018 */   public boolean eval(InternalRow i) {
/* 019 */     boolean isNull_2 = i.isNullAt(0);         //判断id是否为空
/* 020 */     int value_2 = isNull_2 ?
/* 021 */     -1 : (i.getInt(0));
/* 022 */     boolean isNull_0 = false;
/* 023 */     boolean value_0 = false;
/* 024 */
/* 025 */     if (!false && !(!isNull_2)) {             //如果id为空那么整个表达式就是false
/* 026 */     } else {
/* 027 */       boolean isNull_3 = true;
/* 028 */       boolean value_3 = false;
/* 029 */       boolean isNull_4 = i.isNullAt(0);       //继续判断id是否为空
/* 030 */       int value_4 = isNull_4 ?                //根据id值为空获取对应的值
/* 031 */       -1 : (i.getInt(0));
/* 032 */       if (!isNull_4) {                    //如果id对应的值不为空，那么判断这个值是否大于5
/* 033 */
/* 034 */
/* 035 */         isNull_3 = false; // resultCode could change nullability.
/* 036 */         value_3 = value_4 > 5;
/* 037 */
/* 038 */       }
/* 039 */       if (!isNull_3 && !value_3) {
/* 040 */       } else if (!false && !isNull_3) {      //id之大于5
/* 041 */         value_0 = true;
/* 042 */       } else {
/* 043 */         isNull_0 = true;
/* 044 */       }
/* 045 */     }
/* 046 */     return !isNull_0 && value_0;   //这个就是表达式isnotnull(id#8) && (id#8 > 5)对每行执行的结果          
/* 047 */   }
/* 048 */
/* 049 */
/* 050 */ }
```

上面就是对表达式 `isnotnull(id#8) && (id#8 > 5)` 生成的代码，里面用到了 org.apache.spark.sql.catalyst.expressions.And、org.apache.spark.sql.catalyst.expressions.IsNotNull 以及 org.apache.spark.sql.catalyst.expressions.GreaterThan 三个 Predicate 的代码生成，然后组成了上面的 SpecificPredicate 。SpecificPredicate 会对每行应用 `eval` 函数去判断是否满足条件，上面生成的 SpecificPredicate 类逻辑并不复杂，大家可以去细细品味。

表达式代码生成主要是想解决大量虚函数调用（Virtual Function Calls），泛化的代价等。需要注意的是，上面通过表达式生成完整的类代码只有在将 `spark.sql.codegen.wholeStage` 设置为 false 才会进行的，否则只会生成一部分代码，并且和其他代码组成 Whole-stage Code。

### 全阶段代码生成（Whole-stage Code Generation）

全阶段代码生成（Whole-stage Code Generation），用来将多个处理逻辑整合到单个代码模块中，其中也会用到上面的表达式代码生成。和前面介绍的表达式代码生成不一样，这个是对整个 SQL 过程进行代码生成，前面的表达式代码生成仅对于表达式的。全阶段代码生成都是继承自 org.apache.spark.sql.execution.BufferedRowIterator 的，生成的代码需要实现 processNext() 方法，这个方法会在 org.apache.spark.sql.execution.WholeStageCodegenExec 里面的 doExecute 方法里面被调用。而这个方法里面的 rdd 会将数据传进生成的代码里面 ，比如我们上文 SQL 这个例子的数据源是 csv 文件，底层使用 org.apache.spark.sql.execution.FileSourceScanExec 这个类读取文件，然后生成 inputRDD，这个 rdd 在 WholeStageCodegenExec 类中的 doExecute 方法里面调用生成的代码，然后执行我们各种判断得到最后的结果。WholeStageCodegenExec 类中的 doExecute 方法部分代码如下：

```scala
// rdds 可以从 FileSourceScanExec 的 inputRDDs 方法获取
val rdds = child.asInstanceOf[CodegenSupport].inputRDDs()
 
rdds.head.mapPartitionsWithIndex { (index, iter) =>
    // 编译生成好的代码
    val (clazz, _) = CodeGenerator.compile(cleanedSource)
    // 前面说了所有生成的代码都是继承自 BufferedRowIterator
    val buffer = clazz.generate(references).asInstanceOf[BufferedRowIterator]
    // 调用生成代码的 init 方法，主要传入 iter 迭代器，这里面就是我们要的数据
    buffer.init(index, Array(iter))
    new Iterator[InternalRow] {
      override def hasNext: Boolean = {
        // 这个会调用生成的代码中 processNext() 方法，这里面就会感觉表达式对每行数据进行判断
        val v = buffer.hasNext
        if (!v) durationMs += buffer.durationMs()
        v
      }
      override def next: InternalRow = buffer.next()
    }
｝
```

那么我们生成的代码长什么样呢？我们还是对前面文章的 SQL 进行分析，这个 SQL 生成的物理计划如下

```
== Physical Plan ==
*(3) HashAggregate(keys=[], functions=[sum(cast(v#16 as bigint))], output=[sum(v)#22L])
+- Exchange SinglePartition
   +- *(2) HashAggregate(keys=[], functions=[partial_sum(cast(v#16 as bigint))], output=[sum#24L])
      +- *(2) Project [(3 + value#1) AS v#16]
         +- *(2) BroadcastHashJoin [id#0], [id#8], Inner, BuildRight
            :- *(2) Project [id#0, value#1]
            :  +- *(2) Filter (((((isnotnull(cid#2) && isnotnull(did#3)) && (cid#2 = 1)) && (did#3 = 2)) && (id#0 > 5)) && isnotnull(id#0))
            :     +- *(2) FileScan csv [id#0,value#1,cid#2,did#3] Batched: false, Format: CSV, Location: InMemoryFileIndex[file:/iteblog/t1.csv], PartitionFilters: [], PushedFilters: [IsNotNull(cid), IsNotNull(did), EqualTo(cid,1), EqualTo(did,2), GreaterThan(id,5), IsNotNull(id)], ReadSchema: struct<id:int,value:int,cid:int,did:int>
            +- BroadcastExchange HashedRelationBroadcastMode(List(cast(input[0, int, true] as bigint)))
               +- *(1) Project [id#8]
                  +- *(1) Filter (isnotnull(id#8) && (id#8 > 5))
                     +- *(1) FileScan csv [id#8] Batched: false, Format: CSV, Location: InMemoryFileIndex[file:/iteblog/t2.csv], PartitionFilters: [], PushedFilters: [IsNotNull(id), GreaterThan(id,5)], ReadSchema: struct<id:int>
```

从上面的物理计划可以看出，整个 SQL 的执行分为三个阶段。为了简便起见，我们仅仅分析第一个阶段的代码生成，也就是下面物理计划：

```
+- *(1) Project [id#8]
   +- *(1) Filter (isnotnull(id#8) && (id#8 > 5))
      +- *(1) FileScan csv [id#8] Batched: false, Format: CSV, Location: InMemoryFileIndex[file:/iteblog/t2.csv], PartitionFilters: [], PushedFilters: [IsNotNull(id), GreaterThan(id,5)], ReadSchema: struct<id:int>
```

通过全阶段代码生成，上面过程得到的代码如下：

```scala
Generated code:
/* 001 */ public Object generate(Object[] references) {
/* 002 */   return new GeneratedIteratorForCodegenStage1(references);
/* 003 */ }
/* 004 */
/* 005 */ // codegenStageId=1
/* 006 */ final class GeneratedIteratorForCodegenStage1 extends org.apache.spark.sql.execution.BufferedRowIterator {
/* 007 */   private Object[] references;
/* 008 */   private scala.collection.Iterator[] inputs;
/* 009 */   private org.apache.spark.sql.catalyst.expressions.codegen.UnsafeRowWriter[] filter_mutableStateArray_0 = new org.apache.spark.sql.catalyst.expressions.codegen.UnsafeRowWriter[2];
/* 010 */   private scala.collection.Iterator[] scan_mutableStateArray_0 = new scala.collection.Iterator[1];
/* 011 */
/* 012 */   public GeneratedIteratorForCodegenStage1(Object[] references) {
/* 013 */     this.references = references;
/* 014 */   }
/* 015 */
/* 016 */   public void init(int index, scala.collection.Iterator[] inputs) {   //在WholeStageCodegenExec类中的doExecute被调用
/* 017 */     partitionIndex = index;
/* 018 */     this.inputs = inputs;
/* 019 */     scan_mutableStateArray_0[0] = inputs[0];
/* 020 */     filter_mutableStateArray_0[0] = new org.apache.spark.sql.catalyst.expressions.codegen.UnsafeRowWriter(1, 0);
/* 021 */     filter_mutableStateArray_0[1] = new org.apache.spark.sql.catalyst.expressions.codegen.UnsafeRowWriter(1, 0);
/* 022 */
/* 023 */   }
/* 024 */
/* 025 */   protected void processNext() throws java.io.IOException {  //处理每行数据，这个就是isnotnull(id#8) && (id#8 > 5)表达式的判断
/* 026 */     while (scan_mutableStateArray_0[0].hasNext()) {
/* 027 */       InternalRow scan_row_0 = (InternalRow) scan_mutableStateArray_0[0].next();
/* 028 */       ((org.apache.spark.sql.execution.metric.SQLMetric) references[0] /* numOutputRows */).add(1);
/* 029 */       do {
/* 030 */         boolean scan_isNull_0 = scan_row_0.isNullAt(0);     //判断id是否为空
/* 031 */         int scan_value_0 = scan_isNull_0 ?                  //如果为空则scan_value_0等于－1，否则就是id的值
/* 032 */         -1 : (scan_row_0.getInt(0));
/* 033 */
/* 034 */         if (!(!scan_isNull_0)) continue;                   //如果id为空这行数据就不要了
/* 035 */
/* 036 */         boolean filter_value_2 = false;
/* 037 */         filter_value_2 = scan_value_0 > 5;                 //id是否大于5
/* 038 */         if (!filter_value_2) continue;                     //如果id不大于5，则这行数据不要了
/* 039 */
/* 040 */         ((org.apache.spark.sql.execution.metric.SQLMetric) references[1] /* numOutputRows */).add(1);
/* 041 */
/* 042 */         filter_mutableStateArray_0[1].reset();
/* 043 */
/* 044 */         if (false) {
/* 045 */           filter_mutableStateArray_0[1].setNullAt(0);
/* 046 */         } else {
/* 047 */           filter_mutableStateArray_0[1].write(0, scan_value_0);  //这个就是符合isnotnull(id#8) && (id#8 > 5)表达式的id
/* 048 */         }
/* 049 */         append((filter_mutableStateArray_0[1].getRow()));        //得到符号条件的行
/* 050 */
/* 051 */       } while(false);
/* 052 */       if (shouldStop()) return;
/* 053 */     }
/* 054 */   }
/* 055 */
/* 056 */ }
```

上面代码逻辑很好理解，大部分代码我都注释了，其实就是对每行的 id 进行 isnotnull(id#8) && (id#8 > 5) 表达式判断，然后拿到符合条件的行。剩余的其他阶段的代码生成和这个类似，生成的代码有点多，我就不贴出来了，感兴趣的同学可以自己去看下。相比 Volcano Iterator Model，全阶段代码生成的执行过程如下：

![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_wholesagecodegen-iteblog.png)

通过引入全阶段代码生成，大大减少了虚函数的调用，减少了 CPU 的调用，使得 SQL 的执行速度有很大提升。

### 代码编译

生成代码之后需要解决的另一个问题是如何将生成的代码进行编译然后加载到同一个 JVM 中去。在早期 Spark 版本是使用 Scala 的 Reflection 和 Quasiquotes 机制来实现代码生成的。Quasiquotes 是一个简洁的符号，可以让我们轻松操作 Scala 语法树，具体参见 [这里](https://www.iteblog.com/redirect.php?url=aHR0cHM6Ly9kb2NzLnNjYWxhLWxhbmcub3JnL292ZXJ2aWV3cy9xdWFzaXF1b3Rlcy9pbnRyby5odG1s&article=true)。虽然 Quasiquotes 可以很好的为我们解决代码生成等相关的问题，但是带来的新问题是编译代码时间比较长（大约 50ms - 500ms）！所以社区不得不默认关闭表达式代码生成。

为了解决这个问题，Spark 引入了 Janino 项目，参见 [SPARK-7956](https://www.iteblog.com/redirect.php?url=aHR0cHM6Ly9pc3N1ZXMuYXBhY2hlLm9yZy9qaXJhL2Jyb3dzZS9TUEFSSy03OTU2&article=true)。Janino 是一个超级小但又超级快的 Java™ 编译器. 它不仅能像 javac 工具那样将一组源文件编译成字节码文件，还可以对一些 Java 表达式，代码块，类中的文本(class body)或者内存中源文件进行编译，并把编译后的字节码直接加载到同一个 JVM 中运行。Janino 不是一个开发工具, 而是作为运行时的嵌入式编译器，比如作为表达式求值的翻译器或类似于 JSP 的服务端页面引擎，关于 Janino 的更多知识请参见[这里](https://www.iteblog.com/redirect.php?url=aHR0cHM6Ly9qYW5pbm8tY29tcGlsZXIuZ2l0aHViLmlvL2phbmluby8=&article=true)。通过引入了 Janino 来编译生成的代码，结果显示 SQL 表达式的编译时间减少到 5ms。在 Spark 中使用了 `ClassBodyEvaluator` 来编译生成之后的代码，参见 org.apache.spark.sql.catalyst.expressions.codegen.CodeGenerator。

**需要主要的是，代码生成是在 Driver 端进行的，而代码编译是在 Executor 端进行的。**

## SQL 执行

终于到了 SQL 真正执行的地方了。这个时候 Spark 会执行上阶段生成的代码，然后得到最终的结果，DAG 执行图如下：

[![一条SQL在Spark之旅](https://s.iteblog.com/pic/spark/spark_dag-iteblog.png)](https://s.iteblog.com/pic/spark/spark_dag-iteblog.png)