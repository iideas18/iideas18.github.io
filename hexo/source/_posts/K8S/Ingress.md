---
title: "Ingress的概念和原理"
date: 2022-04-07 16:46:32
cover: "/2022/04/07/K8S/Ingress/image-20220407162051131.png"
slug: "Ingress"
categories:
  - "K8S"
---

# Ingress的概念和原理

## 1. What、Why

### 1.1 ingress诞生的背景：

到达service所选中的节点上，然后负载均衡到每一个节点上。nodeport虽然提供了对外的方式但也有很大的弊端：

由于servcie的实现方式use_space、iptables、ipvs这三种方式只支持4层协议通信，不支持7层协议，因此nodeport不能代理https（客户端的角度）；nodeport需要暴露service所属每个node节点上端口，当需求越来越多，端口数量越多，导致维护成本过高，并且集群不好管理（运维的技术难度）。

要理解ingress,需要区分两个概念，ingress和ingress-controller

#### 1.1.1 ingress对象：

1）指的是k8s中的一个api对象，一般用yaml配置。作用是定义请求如何转发到service的规则，可以理解为配置模板。

2）ingress是一个api对象，和其他对象一样，通过yaml文件来配置。ingress通过http或https暴露集群内部service，给service提供外部URL、负载均衡、SSL/TLS能力以及基于host的反向代理。ingress要依靠ingress-controller来实现以上功能。大概的配置如下：

与其他k8s对象一样，ingress配置也包含了apiVersion、kind、metadata、spec等关键字段。有几个关注的在spec字段中，tls用于定义https秘钥、证书；rule用于指定请求路由规则；这里值得关注的还有metadata.annotations字段，在ingress配置中，annotations很重要,ingress-controller有很多不同的实现，而不同的ingress-controller就可以根据“kubernetes.io/ingress.class:”来判断要使用哪些ingress配置，同时，不同的ingress-controller也有对应的annotations配置，用于自定义一些参数，例如上面配置的‘nginx.ingress.kubernetes.io/use-regex:"true"’,最终是在生成nginx配置中，会采用location~来表示正则匹配。

#### 1.1.2 ingress-controller:

1）具体实现反向代理及负载均衡的程序，对ingress定义的规则进行解析，根据配置的规则来实现转发。

2）ingress-controller并不是k8s自带的组件，实际上ingress-controller只是一个统称，用户可以选择不同的ingress-controller实现，目前，由k8s维护的ingress-controller只有google云的GCE与ingress-nginx两个，其他还有很多第三方维护的ingress-controller，具体可以参考官方文档。但是不管哪一种ingress-controller，实现的机制都大同小异，只是在具体配置上有差异：

一般来说，ingress-controller的形式都是一个pod，里面跑着daemon程序和反向代理程序（典型的有nginx负载均衡器）。daemon负责不断监控集群的变化，根据ingress对象生成配置并应用新配置到反向代理，比如nginx-ingress就是动态生成nginx配置，动态更新upstream，并在需要的时候reload程序应用新配置。为了方便，后面的例子一般都以k8s官方维护的nginx-ingress为例。

#### 1.1.3 ingress和ingress-controller的关系：类似于路由器与路由表的关系

简单来说，ingress-controller才是负责具体转发的组件，通过各种方式将它暴露在集群入口，外部对集群的请求流量会先到ingress-controller，而ingress对象是用来告诉ingress-controller改如何转发请求，比如哪些域名哪些path要转发到哪些服务等等。

### 1.2 ingress介绍

k8s暴露服务的方式目前只有三种：loadblance service（LB）、nodeport service、ingress.

可能从大致印象上就是能利用nginx、haproxy啥的负载均衡器暴露集群内服务的工具；那么问题来了，集群内服务想要暴露出去面临着几个问题：

#### 1.2.1 pod漂移问题

众所周知k8s具有强大的副本控制能力，能保证在任意副本（pod）挂掉时自动从其他机器启动一个新的，还可以动态扩容等等，总之一句话，这个Pod可能在任何时刻出现在任何节点上，也可能在任何时刻死在任何节点上；那么自然随着pod的创建和销毁，pod ip肯定会动态变化；那么如何把这个动态的pod ip暴露出去？这里借助于k8s的service机制，service可以用标签的形式选定一组带有指定标签的pod，并监控和自动负载他们的pod ip，那么我们向外暴露只暴露service ip就行了；这就是nodeport模式：即在每个节点上开启一个端口，然后转发到内部pod ip上，如图所示：

![image-20220407162051131](image-20220407162051131.png)

#### 1.2.2 端口管理问题

采用nodeport方式暴露服务面临一个坑爹的问题是，服务一旦多起来，nodeport在每个节点上开启的端口会极其庞大，而且难以维护；这时候引出的思考问题是“能不能使用nginx啥的只监听一个端口，比如80,然后按照域名向后转发？”这思路很好，简单的实现就是使用daemonset在每个Node上监听80，然后写好规则，因为nginx外面绑定到了宿主机80端口（就像nodeport），本身又在集群内，那么向后直接转发到相应service ip就行了，如图所示：

![image-20220407162127645](image-20220407162127645.png)

#### 1.2.3 域名分配及动态更新问题

从上面的思路，采用nginx似乎已经解决了问题，但是其实这里面有一个很大的缺陷：每次有新服务加入怎么改nginx配置？总不能手动改或者来个rolling update前端nginx pod 吧？这时候“伟大而又正直勇敢的”ingress登场，如果不算上面的nginx，ingress只有两大组件：ingress controller和ingress。

   ingress这个玩意，简单的理解就是你原来要改nginx配置，然后配置各种域名对应哪个service，现在把这个动作抽象出来，变成一个ingress对象，你可以用yaml创建，每次不要去改nginx了，直接改yaml然后创建/更新就行；那么问题来了：“nginx咋整？”

ingress controller这东西就是解决“nginx咋整”的;ingress controller通过与k8s api交互，动态的去感知集群中ingress规则变化，然后读取它，按照他自己模板生成一段nginx配置，再写到nginx pod里，最后reload一下，工作流程如下：

 ![image-20220407162144997](image-20220407162144997.png)

当然咱实际应用中，最新版本k8s已经将nginx与ingress controller合并为一个组件，所以ngxin无需单独部署，只需要部署ingress controller即可。

### 1.3 Ingress Controller

#### 1.3.1 Explain 1

ingress controller是将ingress这种变化生成一段nginx的配置，然后将这个配置通过k8s api写到nginx的pod中，然后reload。

注意：写入nginx.conf的不是service地址，而是service backend的pod地址，避免在service上增加一层负载均衡转发。service在此处的作用是用于感知pod ip的变化。

![image-20220407162208052](image-20220407162208052.png)

从上图可以很清晰的看出，实际上请求进来还是被负载均衡器拦截，比如nginx，然后ingress controller通过跟ingress交互得知某个域名对应哪个service，再通过k8s api交互得知service地址等信息；综合以后生成配置文件时写入负载均衡器，然后负载均衡器reload改规则便可实现服务发现，即动态映射。

了解了以上内容以后，这也很好的说明了我为什么喜欢吧负载均衡器部署为daemon set;因为无论如何请求首先是被负载均衡器拦截的，所以在每个node上都部署一下，同时hostport方式监听80端口。那么久解决了其他方式部署不确定负载均衡器在哪的问题，同时访问每个node的80都能正确解析请求。（备：如果前端再放个nginx就又实现了一层负载均衡。）
![image-20220407162221005](image-20220407162221005.png)

ingress controller会根据你定义的ingress对象，提供对应的代理能力。业界常用的各种反向代理项目，比如nginx、HAProxy、Envoy、Traefik等，都已经为k8s专门维护了对应的ingress controller。

#### 1.3.2 Explain 2

ingress controller是一个pod服务，封装了一个web前端负载均衡器，同时在其基础上实现了动态感知ingress并根据ingress的定义生成前端web负载均衡器的配置文件，ingress-nginx-controller本质上就是一个nginx，只不过它能根据ingress资源定义的动态生成nginx的配置文件，然后动态reload。个人觉得ingress controller的重大作用是将前端负载均衡器和k8s完美地结合起来，一方面在云、容器平台下方便配置管理，另一方面实现了集群统一的流量入口，而不是像nodeport那样给集群打多个孔。


![image-20220407162237461](image-20220407162237461.png)

备注：

总的来说要使用ingress，得先部署ingress controller实体（相当于前端nginx），然后再创建ingress（相当于nginx配置的k8s资源体现），ingress controller部署后之后会动态检测到ingress的创建清楚并生成相应的配置。

### 1.4 ingress-nginx介绍

#### 1.4.1 ingress-nginx组成：

（1）ingress-nginx-controller:根据用户编写的ingress规则（创建的ingress的yaml文件），动态的去更改nginx服务的配置文件，并且reload重载使其失效（是自动化的，通过脚本来是实现的）；

（2）ingress资源对象：将nginx的配置抽象成一个ingress对象，没添加一个新的service资源对象只需写一个新的ingress规则的yaml文件即可（或修改已存在的ingress规则的yaml文件）。

#### 1.4.2 ingress-nginx可以解决什么问题：

（1）动态配置服务

     如果按照传统方式，当新添加一个服务时，我们可能需要在流量入口佳一个反向代理指向我们新的k8s服务，而如果用了ingress-nginx，只需要配置好这个服务，当服务启动时，会自动注册到ingress中，不需要额外的操作。

（2）减少不必要的端口映射

配置过k8的都清楚，第一步是要关闭防火墙，主要原因是k8s的很多服务会以nodeport方式映射出去，这样就相当于给宿主机打了很多孔，既不安全也不优雅，而ingress可以避免这个问题，除了ingress自身服务可能需要映射出去，其他服务都不要用nodeport方式。

#### 1.4.3 ingress-nginx工作原理

（1）ingress controller通过和k8s api交互，动态的去感知集群中ingress规则变化。

（2）然后读取它，按照自定义的规则，规则就是写明了哪个域名对应哪个service，生成一段nginx配置

（3）再写到nginx-ingress-controller的pod里，这个ingress controller的pod里运行着一个nginx服务，控制器会吧生成的nginx配置写入/etc/nginx.conf中

（4）然后reload一下使配置生效。因此达到域名分别配置和动态更新的问题。

4、基于ingress-nginx的安装，可以查看k8s的ingress-nginx官网，实现的逻辑如下图：
![image-20220407162257238](image-20220407162257238.png)

1）extrenalLB通过外界的LB调度器，均衡到service代理暴露的ingress-nginx(pod)端口，通过selector选择对应的ingress-nginx。ingress是将backend中的real主机的信息写入到ingress-nginx的配置文件中，因为代理的pods可能会随时丢失，随时重启，对应的pod属性也会改变，所以需要service来代理pods，ingress将监控service，并将信息写入到ingress-nginx中。

2）当然，externalLB---ingress-nginx---ingress controller这一步，可以将ingress controller以daemonset的控制方式，挂载在能够容忍某些指定污点的node上，直接对外暴露服务，不需要通过service代理，而是使用hostnetwork的方式，ingress-controller将会使用的是物理机的DNS域名解析（即物理机的/etc/resolv.conf）。而无法使用内部的coredns域名解析。

## 2. HOW:原理

### 2.1 ingress-controller工作原理

ingress也是k8s api的标准资源类型之一，它其实就是一组基于DNS名称（host）或URL路径把请求转发到指定的service资源的规则。用于将集群外部的请求流量转发到集群内部完成的服务发布。我们需要明白的是，ingress资源自身不能进行“流量穿透”，仅仅是一组规则的集合，这些集合规则还需要其他功能的辅助，比如监听某套接字，然后根据这些规则的匹配进行路由转发，这些能够为ingress资源监听套接字并将流量转发的组件就是ingress controller。

 ingress控制器不同于deployment等pod控制器的是，ingress控制器不直接运行为kube-controller-manager的一部分，它仅仅是k8s集群的一个附件，类似于coreDNS,需要在集群上单独部署。

ingress controller通过监视api server获取相关ingress、service、endpoint、secret、node、configmap对象，并在程序内部不断循环监视相关service是否有新的endpoint变化，一旦发生变化则自动更新nginx.conf模板配置并产生新的配置文件进行reload。

![image-20220407162316553](image-20220407162316553.png)

### 2.2 ingress的部署原理


ingress的部署，需要考虑两个方面：

ingress-controller是作为pod来运行的，以什么方式部署比较好？

ingress解决了如何请求路由到集群内部，那它自己怎么暴露给外部比较好？

下面列举一些目前常见的部署和暴露方式，具体使用哪种方式还是得根据实际需求来考勤决定。

#### 2.2.1 Deployment+LoadBalancer模式的service

如果要把ingress部署在公有云，那用这种方式比较合适。用Deployment部署igress-controller，创建一个type为LoadBalancer的service关联这组pod。大部分公有云，都会为LoadBalancer的service自动创建一个负载均衡器，通常还绑定了公网地址。只要把域名解析指向改地址，就实现了集群服务的对外暴露。

#### 2.2.2 Deployment+NodePort模式的service

同样用deployment模式部署ingress-controller，并创建对应的服务，但是type为NodePort。这样，ingress就会暴露在集群节点ip的特定端口上。由于nodeport暴露的端口是随机端口，一般会在前面再搭建一套负载均衡器来转发请求。改方式一般用于宿主机是相对固定的环境ip地址不变的场景。

NodePort方式暴露ingress虽然简单方便，但是NodePort多了一层NAT,在请求量级很大时可能对性能会有一定的影响。
![image-20220407162334027](image-20220407162334027.png)

![image-20220407162343181](image-20220407162343181.png)

备注：

nodeport的部署思路就是通过在每个节点上开辟nodeport的端口，将流量引入进来，而后通过iptables首先转发到ingress-controller容器汇总（图中的nginx容器），而后由nginx根据ingress的规则进行判断，将其转发到对应的应用web容器中。因此 采用nodeport的部署较为简单。

#### 2.2.3 DaemonSet+HostNetwork(+nodeSelector)

 用DaemonSet 结合nodeselector来部署ingress-controller到特定的Node上，然后使用HostNetwork直接把该pod与宿主机node的网络打通，直接使用宿主机的80/443端口就能访问服务。这时，ingress-controller所在的node机器就很类似传统架构的边缘节点，比如机房的入口nginx服务器。该方式整个请求链路最简单，性能相对nodeport模式更好。缺点是由于直接利用宿主机节点的网络和端口，一个node只能部署一个ingress-controller pod。比较适合大并发的生产环境使用。

 

hostnetwork的优势：

相比较起来，hostNetwork模式不再需要创建一个nodeport的svc，而是通过直接在每个节点都创建一个ingress-controller的容器，而且将改容器的网络模式设置为hostNetwork。也就是说每个节点物理机的80和443端口将会被ingress-controller中的nginx容器占用。当流量通过80/443端口进入时，将直接进入nginx中。而后nginx根据ingress规则再将流量转发到对应的web应用容器中。

两种部署方式的比较：

1）相比较起来，nodeport部署模式中需要部署的ingress-ocntroller容器较少。一个集群可以部署几个就可以了。而hostNetwork模式需要在每个节点部署一个ingress-controller容器，因此总的消耗资源比较多；

2）另外一个比较直观的区别，nodePort模式主要占用的是svc的nodePort端口。而hostNetwork则需要占用物理机的80和443端口。

3）从网络流转来说，通过nodePort访问时，改node节点不一定部署了ingress-controller容器。因此还需要iptables将其将其转发到部署有ingress-controller的节点上（用的deployment方式），多了一层流转。

4）另外，通过nodePort访问时，nginx接收到的http请求中的source ip将会被转换为接受改请求的node节点的ip，而非真正的client ip。

5）使用hostNetwork的方式，ingress-controller将会使用的是物理机的DNS域名解析（即物理机的/etc/resolv.conf）。而无法使用内部的比如coredns域名解析。
