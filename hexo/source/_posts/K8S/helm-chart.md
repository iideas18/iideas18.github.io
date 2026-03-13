---
title: "helm chart 快速入门"
date: 2022-04-07 15:16:14
slug: "helm-chart"
categories:
  - "K8S"
---

# helm chart 快速入门

## 1. 概述

helm chart 是一种描述如何部署应用到 kubernetes 中的文档格式。

helm 项目提供了命令行工具 helm 来进行部署包的管理，并且支持接入 chart 仓库，如果你用过 linux 各大发行版的源，或者 docker 的镜像仓库，相信可以迅速 Get 到这种方案理念。目前官方的中央仓库为 artifacthub。

下载一个 helm 3 执行程序到本地，然后我们可以通过执行helm repo add <repo-name> <repo-url>来添加开发环境的 chart 仓库。helm search repo <repo-name>可以浏览当前仓库中有的 chart。

使用helm create <charts-name>可以创建一个初始 chart，文件结构如下：

```bash
# tree mychart
mychart
├── charts/ # 子 chart
├── Chart.yaml # chart 的概要信息
├── templates # 模板，对标 k8s 中的种种资源类型
│   ├── deployment.yaml
│   ├── _helpers.tpl
│   ├── hpa.yaml
│   ├── ingress.yaml
│   ├── NOTES.txt
│   ├── serviceaccount.yaml
│   ├── service.yaml
│   └── tests
│       └── test-connection.yaml
└── values.yaml # 一些需要传递给模板的值被放置在这里

```

除了 Chart.yaml、values.yaml 是必须要有的，其他都是可选的。当然在实际使用时，我们无疑是需要 templates/ 里的模板的，比如 deployment.yaml、service.yaml，模板从 values.yaml 中获取值来渲染得到最终的部署相关资源描述文件。

## 2. Chart.yaml

Chart.yaml 中主要是放一些概要信息，比如 chart 的名称、版本、维护者、依赖（即子 chart）。

```bash
name: mychart
description: A Helm chart for Kubernetes
type: application # application or library
version: 0.1.0 # chart release version
appVersion: "1.16.0" # version of some application inside the chart, such as nginx. Just a message, not important

# optional
maintainers:
- email: <>
  name: <>

# optional
dependencies:
- name: <>
  version: <>
  repository: <> # optional
```

注意在 Helm 3 中，不再需要 requirements.yaml 来描述 dependencies 。

在声明了 dependencies 的 chart 中执行helm dependency update或helm dependency build将会自动生成一个 Chart.lock 文件，且如果设置了依赖项的 repository，会到仓库中查找并打包为 .tgz 文件下载到 charts/ 路径下。

当然，你也可以直接使用helm pull <chart-name>直接从仓库中抓取对应的 chart 到 charts/ 下。

## 3. values.yaml

values.yaml 中放置一些需要传递给模板的值，在模板文件中你将可以通过 {undefined{.Values.xxx.xxx}} 来进行引用。

```bash
# Default values for mychart.
# This is a YAML-formatted file.
# Declare variables to be passed into your templates.
replicaCount: 1

image:
  repository: nginx
  pullPolicy: IfNotPresent
  # Overrides the image tag whose default is the chart appVersion.
  tag: ""

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  # Specifies whether a service account should be created
  create: true
  # Annotations to add to the service account
  annotations: {}
  # The name of the service account to use.
  # If not set and create is true, a name is generated using the fullname template
  name: ""
podAnnotations: {}
podSecurityContext: {}
  # fsGroup: 2000
securityContext: {}
  # capabilities:
  #   drop:
  #   - ALL
  # readOnlyRootFilesystem: true
  # runAsNonRoot: true
  # runAsUser: 1000

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: ""
  annotations: {}
    # kubernetes.io/ingress.class: nginx
    # kubernetes.io/tls-acme: "true"
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: ImplementationSpecific
  tls: []
  #  - secretName: chart-example-tls
  #    hosts:
  #      - chart-example.local

resources: {}
  # We usually recommend not to specify default resources and to leave this as a conscious
  # choice for the user. This also increases chances charts run on environments with little
  # resources, such as Minikube. If you do want to specify resources, uncomment the following
  # lines, adjust them as necessary, and remove the curly braces after 'resources:'.
  # limits:
  #   cpu: 100m
  #   memory: 128Mi
  # requests:
  #   cpu: 100m
  #   memory: 128Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80
  # targetMemoryUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity: {} 

route:
  host: xxx..cn
```

如果想要约束 values.yaml 中的配置结构，可以创建一个 values.schema.json，如下截取了对 values.yaml 中 route 设置结构的约束。

```json
{
  "$schema": "http://json-schema.org/schema",
  "properties": {
    ...
    "route": {
      "properties": {
        "host": {
          "type": "string",
          "description": "ingress full hostname for icc"
        }
      }
    }
  }
}
```

## 4. 覆盖子 chart 配置

一个可用服务通常涉及到多个应用，比如业务应用会依赖 redis 之类中间件，这就是 Chart.yaml 中设置 dependencies 的用意。当我们依赖于别人提供的 chart，但在部署时又需要对其中的一些配置进行调整，这时候就可以通过在父 Chart.yaml 中设置能对应到子 chart 中 values.yaml 中的配置的配置项，来达到覆盖子 chart 中配置值的目的。

假设现在 mychart 有一个 mysubchart 的依赖。

```bash
# tree
.
├── charts
│   └── mysubchart
│       ├── charts
│       ├── Chart.yaml
│       ├── templates
│       └── values.yaml
├── Chart.yaml
├── templates
└── values.yaml
```

在 mychart/charts/mysubchart/values.yaml 中存在一个配置项 dessert。

```bash
dessert: cake
```


可以通过在 mychart/values.yaml 中设置另一个值来覆盖。指明子 chart 名称，然后是 values.yaml 中的路径即可。

```bash
mysubchart:
  dessert: ice-cream
```

最终，我们得到的 chart 的结构可能如下

```bash
# tree
.
├── Chart.lock
├── charts
│   ├── mysubchart
│   │   ├── charts
│   │   ├── Chart.yaml
│   │   ├── templates
│   │   │   ├── deployment.yaml
│   │   │   ├── _helpers.tpl
│   │   │   ├── hpa.yaml
│   │   │   ├── ingress.yaml
│   │   │   ├── NOTES.txt
│   │   │   ├── serviceaccount.yaml
│   │   │   ├── service.yaml
│   │   │   └── tests
│   │   │       └── test-connection.yaml
│   │   └── values.yaml
│   └── redis.tgz
├── Chart.yaml
├── templates
│   ├── deployment.yaml
│   ├── _helpers.tpl
│   ├── hpa.yaml
│   ├── ingress.yaml
│   ├── NOTES.txt
│   ├── serviceaccount.yaml
│   ├── service.yaml
│   └── tests
│       └── test-connection.yaml
├── values.schema.json
└── values.yaml
```

