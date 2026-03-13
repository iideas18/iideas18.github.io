---
title: "Docker镜像管理"
date: 2022-03-29 16:24:50
slug: "Docker 镜像管理"
categories:
  - "Docker"
---

# Docker镜像管理

当需要进行容器迁移，对容器的运行环境进行全盘打包时，libcontainer就束手无策了。Docker的设计很好地考虑到了这一点，它采用了神奇的“镜像”技术，作为Docker管理文件系统以及运行环境的强有力补充。

## 1. Docker镜像

Docker镜像是一个只读的Docker容器模板，含有启动Docker容器所需的**文件系统结构及其内容**，因此是启动一个Docker容器的基础。Docker镜像的文件内容以及一些运行Docker容器的配置文件组成了Docker容器的静态文件系统运行环境——rootfs。可以这么理解，Docker镜像是Docker容器的静态视角，Docker容器是Docker镜像的运行状态。

### 1. rootfs

rootfs是Docker容器在**启动时内部进程可见的文件系统**，**即Docker容器的根目录**。rootfs通常包含一个操作系统运行所需的文件系统，例如可能包含典型的类Unix操作系统中的目录系统，如/dev、/proc、/bin、/etc、/lib、/usr、/tmp及运行Docker容器所需的配置文件、工具等。

在传统的Linux操作系统内核启动时，首先挂载一个只读（read-only）的rootfs，当系统检测其完整性之后，再将其切换为读写（read-write）模式。

而在Docker架构中，当Docker daemon为Docker容器挂载rootfs时，沿用了Linux内核启动时的方法，即将rootfs设为只读模式。在挂载完毕之后，利用联合挂载（union mount）技术在已有的只读rootfs上再挂载一个读写层。这样，可读写层处于Docker容器文件系统的最顶层，其下可能联合挂载多个只读层，只有在Docker容器运行过程中文件系统发生变化时，才会把变化的文件内容写到可读写层，并隐藏只读层中的老版本文件。

### 2. Docker镜像的主要特点

为了更好地理解Docker镜像的结构，下面介绍一下Docker镜像设计上的关键技术。

#### 1. 分层

Docker镜像是采用分层的方式构建的，每个镜像都由一系列的“镜像层”组成。分层结构是Docker镜像如此轻量的重要原因，当需要修改容器镜像内的某个文件时，只对处于最上方的读写层进行变动，不覆写下层已有文件系统的内容，已有文件在只读层中的原始版本仍然存在，但会被读写层中的新版文件所隐藏。当使用docker commit提交这个修改过的容器文件系统为一个新的镜像时，保存的内容仅为最上层读写文件系统中被更新过的文件。**分层达到了在不同镜像之间共享镜像层的效果。**

#### 2. 写时复制

Docker镜像使用了写时复制（copy-on-write）策略，在多个容器之间共享镜像，每个容器在启动的时候并不需要单独复制一份镜像文件，而是将所有镜像层以只读的方式挂载到一个挂载点，再在上面覆盖一个可读写的容器层。在未更改文件内容时，所有容器共享同一份数据，只有在Docker容器运行过程中文件系统发生变化时，才会把变化的文件内容写到可读写层，并隐藏只读层中的老版本文件。写时复制配合分层机制减少了镜像对磁盘空间的占用和容器启动时间。

#### 3. 内容寻址

在Docker 1.10版本后，Docker镜像改动较大，其中最重要的特性便是引入了内容寻址存储（content-addressable storage）的机制，根据文件内容来索引镜像和镜像层。与之前版本对每一个镜像层随机生成一个UUID不同，新模型对镜像层的内容计算校验和，生成一个内容哈希值，并以此哈希值代替之前的UUID作为镜像层的唯一标志。该机制主要提高了镜像的安全性，并在pull、push、load和save操作后检测数据的完整性。另外，基于内容哈希来索引镜像层，在一定程度上减少了ID的冲突并且增强了镜像层的共享。对于来自不同构建的镜像层，只要拥有相同的内容哈希，也能被不同的镜像共享。

#### 4. 联合挂载

通俗地讲，联合挂载技术可以在一个挂载点同时挂载多个文件系统，将挂载点的原目录与被挂载内容进行整合，使得最终可见的文件系统将会包含整合之后的各层的文件和目录。实现这种联合挂载技术的文件系统通常被称为联合文件系统（union filesystem）。如图3-11所示，以运行Ubuntu:14.04镜像后容器中的aufs文件系统为例。由于初始挂载时读写层为空，所以从用户的角度看，该容器的文件系统与底层的rootfs没有差别；然而从内核的角度来看，则是显式区分开来的两个层次。当需要修改镜像内的某个文件时，只对处于最上方的读写层进行了变动，不覆写下层已有文件系统的内容，已有文件在只读层中的原始版本仍然存在，但会被读写层中的新版文件所隐藏，当docker commit这个修改过的容器文件系统为一个新的镜像时，保存的内容仅为最上层读写文件系统中被更新过的文件。

![image-20220329154630846](image-20220329154630846.png)

联合挂载是用于将多个镜像层的文件系统挂载到一个挂载点来实现一个统一文件系统视图的途径，是下层存储驱动（如aufs、overlay等）实现分层合并的方式。所以严格来说，联合挂载并不是Docker镜像的必需技术，比如我们在使用Device Mapper存储驱动时，其实是使用了快照技术来达到分层的效果，没有联合挂载这一概念。

### 3. Docker镜像的存储组织方式

综合考虑镜像的层级结构，以及volume、init-layer、可读写层这些概念，一个完整的、在运行的容器的所有文件系统结构可以用图来描述。从图中我们不难看到，除了echo hello进程所在的cgroups和namespace环境之外，容器文件系统其实是一个相对独立的组织。可读写部分（read-write layer以及volumes）、init-layer、只读层（read-only layer）这3部分结构共同组成了一个容器所需的下层文件系统，它们通过联合挂载的方式巧妙地表现为一层，使得容器进程对这些层的存在一点都不知道。

![image-20220329154734026](image-20220329154734026.png)

## 2 Docker镜像关键概念

### 1. registry

我们知道，每个Docker容器都从Docker镜像生成。俗话说，“巧妇难为无米之炊”，当使用docker run命令启动一个容器时，从哪里获取需要的镜像呢？答案是，如果头一次基于某个镜像启动容器，宿主机上并不存在需要的镜像，那么Docker将从registry中下载该镜像并保存到宿主机；否则，直接从宿主机镜像完成启动。那么，registry是什么呢？**registry用以保存Docker镜像，其中还包括镜像层次结构和关于镜像的元数据。可以将registry简单地想象成类似于Git仓库之类的实体。**

用户可以在自己的数据中心搭建私有的registry，也可以使用Docker官方的公用registry服务，即Docker Hub。它是由Docker公司维护的一个公共镜像仓库，供用户下载使用。Docker Hub中有两种类型的仓库，即用户仓库（user repository）与顶层仓库（top-level repository）。用户仓库由普通的Docker Hub用户创建，顶层仓库则由Docker公司负责维护，提供官方版本镜像。理论上，顶层仓库中的镜像经过Docker公司验证，被认为是架构良好且安全的。

### 2. repository

repository即由**具有某个功能的Docker镜像的所有迭代版本构成的镜像组**。由上文可知，registry由一系列经过命名的repository组成，repository通过命名规范对用户仓库和顶层仓库进行组织。用户仓库的命名由用户名和repository名两部分组成，中间以“/”隔开，即username/repository_name的形式，repository名通常表示镜像所具有的功能，如ansible/ubuntu14.04-ansible；而顶层仓库则只包含repository名的部分，如ubuntu。

读者也许会产生疑问，通常将ubuntu视为镜像名称，这里却解释为repository，那么repository和镜像之间是什么关系呢？事实上，repository是一个镜像集合，其中包含了多个不同版本的镜像，使用标签进行版本区分，如ubuntu:14.04、ubuntu:12.04等，它们均属于ubuntu这个repository。

一言以蔽之，registry是repository的集合，repository是镜像的集合。

### 3. manifest

manifest（描述文件）主要存在于registry中作为Docker镜像的元数据文件，在pull、push、save和load中作为镜像结构和基础信息的描述文件。在镜像被pull或者load到Docker宿主机时，manifest被转化为本地的镜像配置文件config。新版本（v2, schema 2）的manifest list可以组合不同架构实现同名Docker镜像的manifest，用以支持多架构Docker镜像。

### 4. image和layer

Docker内部的image概念是用来存储一组镜像相关的元数据信息，主要包括镜像的架构（如amd64）、镜像默认配置信息、构建镜像的容器配置信息、包含所有镜像层信息的rootfs。Docker利用rootfs中的diff_id计算出内容寻址的索引（chainID）来获取layer相关信息，进而获取每一个镜像层的文件内容。

layer（镜像层）是一个Docker用来管理镜像层的中间概念，本节前面提到镜像是由镜像层组成的，而单个镜像层可能被多个镜像共享，所以Docker将layer与image的概念分离。Docker镜像管理中的layer主要存放了镜像层的diff_id、size、cache-id和parent等内容，实际的文件内容则是由存储驱动来管理，并可以通过cache-id在本地索引到。

### 5. Dockerfile

Dockerfile是在通过docker build命令构建自己的Docker镜像时需要使用到的定义文件。它允许用户使用基本的DSL语法来定义Docker镜像，每一条指令描述了构建镜像的步骤。

## 3. Docker镜像构建操作

本节将从读者最熟悉的几个镜像操作命令入手，一步一步地阐述Docker如何处理这些镜像操作。本节在描述中会忽略掉与底层存储驱动相关的细节，在3.6节会专门解释存储驱动这一部分内容。

Docker提供了比较简单的方式来构建镜像或者更新现有的镜像——dockerbuild和docker commit。不过原则上讲，用户并不能“无中生有”地创建一个镜像，无论是启动一个容器或者构建一个镜像，都是在其他镜像的基础上进行的，Docker有一系列镜像称为基础镜像（如基础Ubuntu镜像ubuntu、基础Fedora镜像fedora等），基础镜像便是镜像构建的起点。不同的是，docker commit是将容器提交为一个镜像，也就是从容器更新或者构建镜像；而docker build是在一个镜像的基础上构建镜像。

### 1. commit镜像

docker commit命令只提交容器镜像发生变更了的部分，**即修改后的容器镜像与当前仓库中对应镜像之间的差异部分，这使得该操作实际需要提交的文件往往并不多**。Docker daemon接收到对应的HTTP请求后，需要执行的步骤如下。

1. 根据用户输入pause参数的设置确定是否暂停该Docker容器的运行。
2. 将容器的可读写层导出打包，该读写层代表了当前运行容器的文件系统与当初启动该容器的镜像之间的差异。
3. 在层存储（layerStore）中注册可读写层差异包。
4. 更新镜像历史信息和rootfs，并据此在镜像存储（imageStore）中创建一个新的镜像，记录其元数据。
5. 如果指定了repository信息，则给上述镜像添加tag信息。

### 2. build构建镜像

一般来说，用户主要使用Dockerfile和docker build命令来完成一个新镜像的构建。这条命令的格式如下：

![image-20220329155206296](image-20220329155206296.png)

其中PATH或URL所指向的文件称为context（上下文）, context包含buildDocker镜像过程中需要的Dockerfile以及其他的资源文件。下面介绍该命令的执行流程。

#### 1. Docker client端

当Docker client接收到用户命令，首先解析命令行参数。根据第一个参数的不同，将分为以下4种情况分别处理。**情况**1：第一个参数为“-”，即

![image-20220329155246463](image-20220329155246463.png)

或者

![image-20220329155306846](image-20220329155306846.png)

此时，则根据命令行输入参数对Dockerfile和context进行设置。

**情况**2：第一个参数为URL，且是git repository URL，如

![image-20220329155341134](image-20220329155341134.png)

则调用git clone ——depth 1——recursive命令克隆该GitHub repository，该操作会在本地的一个临时目录中进行，命令成功之后该目录将作为context传给Docker daemon，该目录中的Dockerfile会被用来进行后续构建Docker镜像。

**情况**3：第一个参数为URL，且不是git repository URL，则从该URL下载context，并将其封装为一个io流——io.Reader，后面的处理与情况1相同，只是将STDIN换为了io.Reader。

**情况**4：其他情况，即context为本地文件或目录的情况。

![image-20220329155403055](image-20220329155403055.png)

或者

![image-20220329155412046](image-20220329155412046.png)

如果目录中有．dockerignore文件，则将context中文件名满足其定义的规则的文件都从上传列表中排除，不打包传给Docker daemon。但唯一的例外是．dockerignore文件中若误写入了．dockerignore本身或者Dockerfile，将不会产生作用。如果用户定义了tag，则对其指定的repository和tag进行验证。

完成了相关信息的设置之后，Docker client向Docker server发送POST/build的HTTP请求，包含了所需的context信息。

#### 2. Docker server端

Docker server接收到相应的HTTP请求后，需要做的工作如下。

1. 创建一个临时目录，并将context指定的文件系统解压到该目录下
2. 读取并解析Dockerfile
3. 根据解析出的Dockerfile遍历其中的所有指令，并分发到不同的模块去执行。Dockerfile每条指令的格式均为INSTRUCTION arguments, INSTRUCTION是一些特定的关键词，包括FROM、RUN、USER等，都会映射到不同的parser进行处理
4. parser为上述每一个指令创建一个对应的临时容器，在临时容器中执行当前指令，然后通过commit使用此容器生成一个镜像层
5. Dockerfile中所有的指令对应的层的集合，就是此次build后的结果。如果指定了tag参数，便给镜像打上对应的tag。最后一次commit生成的镜像ID就会作为最终的镜像ID返回。

## 4. Docker镜像的分发方法

Docker技术兴起的原动力之一，是在不同的机器上创造无差别的应用运行环境。因此，能够方便地实现“在某台机器上导出一个Docker容器并且在另外一台机器上导入”这一操作，就显得非常必要。docker export与docker import命令实现了这一功能。当然，由于Docker容器与镜像的天然联系性，容器迁移的操作也可以通过镜像分发的方式达成，这里可以用到的方法是docker push和docker pull，或者docker save和docker load命令进行镜像的分发，不同的是docker push通过线上Docker Hub的方式迁移，而docker save则是通过线下包分发的方式迁移。

所以，我们不难看到同样是对容器进行持久化操作，直接对容器进行持久化和使用镜像进行持久化的区别在于以下两点。

- 两者应用的对象有所不同，docker export用于持久化容器，而docker push和docker save用于持久化镜像
- 将容器导出后再导入（exported-imported）后的容器会丢失所有的历史，而保存后再加载（saved-loaded）的镜像则没有丢失历史和层，这意味着后者可以通过docker tag命令实现历史层回滚，而前者不行。

更具体一些，我们可以从实现的角度来看一下pull、push、export以及save。

### 1. pull镜像

Docker的server端收到用户发起的pull请求后，需要做的主要工作如下。

1. 根据用户命令行参数解析出其希望拉取的repository信息，这里repository可能为tag格式，也可能为digest格式。
2. 将repository信息解析为ReposotryInfo并验证其是否合法。
3. 根据待拉取的repository是否为official版本以及用户没有配置DockerMirrors获取endpoint列表，并遍历endpoint，向该endpoint指定的registry发起会话。endpoint偏好顺序为API版本v2＞v1，协议https＞http。
4. 如果待拉取的repository为official版本，或者endpoint的API版本为v2,Docker便不再尝试对v1 endpoint发起会话，直接向v2 registry拉取镜像。
5. 如果向v2 registry拉取镜像失败，则尝试从v1 registry拉取。

下面仅以向v2 registry拉取镜像的过程为例总结一次拉取过程。

1. 获取v2 registry的endpoint。
2. 由endpoint和待拉取镜像名创建HTTP会话、获取拉取指定镜像的认证信息并验证API版本。
3. 如果tag值为空，即没有指定标签，则获取v2 registry中repository的taglist，然后对于tag list中的每一个标签，都执行一次pullV2Tag方法。该方法的功能分成两大部分，一是验证用户请求；二是当且仅当某一层不在本地时进行拉取这一层文件到本地.
4. 如果tag值不为空，则只对指定标签的镜像进行上述工作。

> 如果tag值为空，即没有指定标签，则获取v2 registry中repository的taglist，然后对于tag list中的每一个标签，都执行一次pullV2Tag方法。该方法的功能分成两大部分，一是验证用户请求；二是当且仅当某一层不在本地时进行拉取这一层文件到本地

#### 2. push镜像

当用户制作了自己的镜像后，希望将它上传至仓库，此时可以通过dockerpush命令完成该操作。而在Docker server接收到用户的push请求后的关键步骤如下。

1. 解析出repository信息。
2. 获取所有非Docker Mirrors的endpoint列表，并验证repository在本地是否存在。遍历endpoint，然后发起同registry的会话。如果确认会话对方API版本是v2，则不再对v1 endpoint发起会话。
3. 如果endpoint对应版本为v2 registry，则验证被推registry的访问权限，创建V2Pusher，调用pushV2 Repository方法。这个方法会判断用户输入的repository名字是否含有tag，如果含有，则在本地repository中获取对应镜像的ID，调用pushV2Tag方法；如果不含有tag，则会在本地repository中查询对应所有同名repository，对其中每一个获取镜像ID，执行pushV2Tag方法。
4. 这个方法会首先验证用户指定的镜像ID在本地ImageStore中是否存在。接下来，该方法会对从顶向下逐个构建一个描述结构体，上传这些镜像层。将这些镜像内容上传完毕后，再将一份描述文件manifest上传到registry。
5. 如果镜像不属于上述情况，则Docker会调用pushRepository方法来推送镜像到v1 registry，并根据待推送的repository和tag信息保证当且仅当某layer在enpoint上不存在时，才上传该layer。

#### 3. docker export命令

导出容器Docker server接收到相应的HTTP请求后，会通过daemon实例调用ContainerExport方法来进行具体的操作，这个过程的主要步骤如下。

1. 根据命令行参数（容器名称）找到待导出的容器。
2. 对该容器调用containerExport()函数导出容器中的所有数据，包括：
   - 挂载待导出容器的文件系统；
   - 打包该容器basefs（即graphdriver上的挂载点）下的所有文件。以aufs为例，basefs对应的是aufs/mnt下对应容器ID的目录；
   - 返回打包文档的结果并卸载该容器的文件系统。
3. 将导出的数据回写到HTTP请求应答中。

#### 4. docker save命令保存镜像

Docker client发来的请求由getImagesGet Handler进行处理，该Handler调用ExportImage函数进行具体的处理。

ExportImage会根据imageStore、layerStore、referenceStore构建一个imageExporter，调用其save函数导出所有镜像。

save函数负责查询到所有被要求export的镜像ID（如果用户没有指定镜像标签，会指定默认标签latest），并生成对应的镜像描述结构体。然后生成一个saveSession并调用其save函数来处理所有镜像的导出工作。

save函数会创建一个临时文件夹用于保存镜像json文件。然后循环遍历所有待导出的镜像，对每一个镜像执行

saveImage函数来导出该镜像。另外，为了与老版本repository兼容，还会将被导出的repository的名称、标签及ID信息以JSON格式写入到名为repositories的文件中。而新版本中被导出的镜像配置文件名、repository的名称、标签以及镜像层描述信息则是写入到名为manifest.json的文件中。最后执行文件压缩并写入到输出流。saveImage函数首先根据镜像ID在imageStore中获取image结构体。其次是一个for循环，遍历该镜像RootFS中所有layer，对各个依赖layer进行export工作，即从顶层layer、其父layer及至base layer。循环内的具体工作如下。

1. 为每个被要求导出的镜像创建一个文件夹，以其镜像ID命名。
2. 在该文件夹下创建VERSION文件，写入“1.0”。
3. 在该文件夹下创建json文件，在该文件中写入镜像的元数据信息，包括镜像ID、父镜像ID以及对应的Docker容器ID等。
4. 在该文件夹下创建layer.tar文件，压缩镜像的filesystem。该过程的核心函数为TarLayer，对存储镜像的diff路径中的文件进行打包。
5. 对该layer的父layer执行下一次循环。

为了兼容V1版本镜像格式，上述循环保持不变，随后为该镜像生成一份名为$digest_id.json的配置文件，并将配置文件的创建修改时间重置为镜像的创建修改时间。

综上所述，本节从概念阐述与源码分析两个角度深入剖析了镜像技术在Docker架构中的应用，相信读者也对如何与Docker镜像交互有了自己的见解。当然，由于Docker镜像是构建Docker服务的基础，相关的命令还远不只此，等待读者亲手实践。而在上述镜像功能的分析和梳理中其实涉及很多关于镜像文件和目录的操作，这一部分跟底层的存储驱动比如aufs是息息相关的，接下来我们就为读者讲解这部分内容。