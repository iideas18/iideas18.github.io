---
title: "Dataset"
date: 2019-11-07 00:57:35
slug: "Untitled"
categories:
  - "Spark note"
  - "spark md"
  - "sparksql"
---

# Dataset

#### class **Dataset**[T] extends Serializable

A Dataset is a strongly typed collection of domain-specific objects that can be transformed in parallel using functional or relational operations. Each Dataset also has an untyped view called a `DataFrame`, which is a Dataset of [Row](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/Row.html).

()

Operations available on Datasets are divided into transformations and actions. Transformations are the ones that produce new Datasets, and actions are the ones that trigger computation and return results. Example transformations include map, filter, select, and aggregate (`groupBy`). Example actions count, show, or writing data out to file systems.

Datasets are "lazy", i.e. computations are only triggered when an action is invoked. Internally, a Dataset represents a logical plan that describes the computation required to produce the data. When an action is invoked, Spark's query optimizer optimizes the logical plan and generates a physical plan for efficient execution in a parallel and distributed manner. To explore the logical plan as well as optimized physical plan, use the `explain` function.

To efficiently support domain-specific objects, an [Encoder](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/Encoder.html) is required. The encoder maps the domain specific type `T` to Spark's internal type system. For example, given a class `Person` with two fields, `name` (string) and `age` (int), an encoder is used to tell Spark to generate code at runtime to serialize the `Person` object into a binary structure. This binary structure often has much lower memory footprint as well as are optimized for efficiency in data processing (e.g. in a columnar format). To understand the internal binary representation for data, use the `schema` function.

There are typically two ways to create a Dataset. The most common way is by pointing Spark to some files on storage systems, using the `read` function available on a `SparkSession`.

```
val people = spark.read.parquet("...").as[Person]  // Scala
Dataset<Person> people = spark.read().parquet("...").as(Encoders.bean(Person.class)); // Java
```

Datasets can also be created through transformations available on existing Datasets. For example, the following creates a new Dataset by applying a filter on the existing one:

```
val names = people.map(_.name)  // in Scala; names is a Dataset[String]
Dataset<String> names = people.map((Person p) -> p.name, Encoders.STRING));
```

Dataset operations can also be untyped, through various domain-specific-language (DSL) functions defined in: Dataset (this class), [Column](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/Column.html), and [functions](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/functions$.html). These operations are very similar to the operations available in the data frame abstraction in R or Python.

To select a column from the Dataset, use `apply` method in Scala and `col` in Java.

```
val ageCol = people("age")  // in Scala
Column ageCol = people.col("age"); // in Java
```

Note that the [Column](https://spark.apache.org/docs/latest/api/scala/org/apache/spark/sql/Column.html) type can also be manipulated through its various functions.

```
// The following creates a new column that increases everybody's age by 10.
people("age") + 10  // in Scala
people.col("age").plus(10);  // in Java
```

A more concrete example in Scala:

```
// To create Dataset[Row] using SparkSession
val people = spark.read.parquet("...")
val department = spark.read.parquet("...")

people.filter("age > 30")
  .join(department, people("deptId") === department("id"))
  .groupBy(department("name"), people("gender"))
  .agg(avg(people("salary")), max(people("age")))
```

and in Java:

```
// To create Dataset using SparkSession
Dataset<Row> people = spark.read().parquet("...");
Dataset<Row> department = spark.read().parquet("...");

people.filter(people.col("age").gt(30))
  .join(department, people.col("deptId").equalTo(department.col("id")))
  .groupBy(department.col("name"), people.col("gender"))
  .agg(avg(people.col("salary")), max(people.col("age")));
```