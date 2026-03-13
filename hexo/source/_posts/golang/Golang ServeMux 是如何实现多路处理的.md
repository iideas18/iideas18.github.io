---
title: "Golang ServeMux 是如何实现多路处理的"
date: 2022-04-04 23:25:20
categories:
  - "golang"
---

# Golang ServeMux 是如何实现多路处理的

## 1. 简介

net/http 包里的 server.go 文件里注释写着：ServeMux is an HTTP request multiplexer. 即 ServeMux 是一个 HTTP 请求的 "多路处理器"，因为 ServeMux 实现的功能就是将收到的 HTTP 请求的 URL 与注册的路由相匹配，选择匹配度最高的路由的处理函数来处理该请求。

最简单的栗子：

```go
mux := http.NewServeMux()
mux.HandleFunc("/a/b", ab)
mux.HandleFunc("/a", a)
http.ListenAndServe(":8000", mux)
```

每个路由对应了一个处理函数。

先来看看 NewServeMux 函数

```go
func NewServeMux() *ServeMux { return new(ServeMux) }
```

我们知道 new 函数会为传入的类型分配空间并返回指向该空间首地址的指针，于是我们就获取了一个 ServeMux 实例。

## 2. 源码分析

### 1. ServeMux 结构体

```go
type ServeMux struct {
    mu    sync.RWMutex
    m     map[string]muxEntry
    es    []muxEntry
    hosts bool  // 标记路由中是否带有主机名
}
```

其中 m 就是用来存储路由与处理函数映射关系的 map，es 按照路由长度从大到小的存放处理函数 (后面会讲为什么要这样)，但 ServeMux 为了方便，map存放的值其实是放有处理函数和路由路径的 muxEntry 结构体：

```go
type muxEntry struct {
    h       Handler  // 处理函数
    pattern string   // 路由路径
}
```

ServeMux 暴露的方法主要是下面 4 个：

```go
func (mux *ServeMux) Handle(pattern string, handler Handler)
func (mux *ServeMux) HandleFunc(pattern string, handler func(ResponseWriter, *Request))
func (mux *ServeMux) Handler(r *Request) (h Handler, pattern string)
func (mux *ServeMux) ServeHTTP(w ResponseWriter, r *Request)
```

### 2. Handle 方法

Handle 方法通过将传入的路由和处理函数存入 ServeMux 的映射表 m 中来实现 "路由注册(register)"

```go
func (mux *ServeMux) Handle(pattern string, handler Handler) {
    mux.mu.Lock()
    defer mux.mu.Unlock()
    // 检查路由路径是否为空
    if pattern == "" {
   
panic("http: invalid pattern")
    }
    // 检查处理函数是否为空
    if handler == nil {
   
panic("http: nil handler")
    }
    // 检查该路由是否已经注册过
    if _, exist := mux.m[pattern]; exist {
   
panic("http: multiple registrations for " + pattern)
    }
    // 如果还没有任何路由注册，就为 mux.m 分配空间
    if mux.m == nil {
   
mux.m = make(map[string]muxEntry)
    }
    // 实例化一个 muxEntry
    e := muxEntry{h: handler, pattern: pattern}
    // 将该路由与该 muxEntry 的实例存到 mux.m 中
    mux.m[pattern] = e
    // 如果该路由路径以 "/" 结尾，就把该路由按照大到小的路径长度插入到 mux.e 中
    if pattern[len(pattern)-1] == '/' {
   
mux.es = appendSorted(mux.es, e)
    }
    // 如果该路由路径不以 "/" 开始，标记该 mux 中有路由的路径带有主机名
    if pattern[0] != '/' {
   
mux.hosts = true
    }
}
```

### 3. HandleFunc 方法

HandleFunc 方法接收一个具体的处理函数将其包装成 Handler：

```go
type HandlerFunc func(ResponseWriter, *Request)

func (mux *ServeMux) HandleFunc(pattern string, handler func(ResponseWriter, *Request)) {
    if handler == nil {
   
panic("http: nil handler")
    }
    mux.Handle(pattern, HandlerFunc(handler))
}
```

其中 HandlerFunc(f) 起到的作用就是在 HandlerFunc 中执行 f

### 4. Handler 方法

Handler 方法从传入的请求(Request)中拿到 URL 进行匹配，**返回对应的处理函数和路由**

在看 Handler 的实现前，先看看它调用的 handler 方法：

```go
func (mux *ServeMux) handler(host, path string) (h Handler, pattern string) {
    mux.mu.RLock()
    defer mux.mu.RUnlock()

    // 若当前 mux 中注册有带主机名的路由，就用"主机名+路由路径"去匹配
    // 也就是说带主机名的路由优先于不带的
    if mux.hosts {
   
h, pattern = mux.match(host + path)
    }
    // 所以若没有匹配到，就直接把路由路径拿去匹配
    if h == nil {
   
h, pattern = mux.match(path)
    }
    // 若都没有匹配到，就默认返回 NotFoundHandler，该 Handler 会往
    // 响应里写上 "404 page not found"
    if h == nil {
   
h, pattern = NotFoundHandler(), ""
    }
    // 返回获得的 Handler 和路由路径
    return
}
```

好了，现在是 Handler 方法

```go
func (mux *ServeMux) Handler(r *Request) (h Handler, pattern string) {
    // 去掉主机名上的端口号
    host := stripHostPort(r.Host)
    // 整理 URL，去掉 ".", ".."
    path := cleanPath(r.URL.Path)

    // redirectToPathSlash 在 mux.m 中查看 path+"/" 是否存在
    // 如果存在，RedirectHandler 就将该请求重定向到 path+"/"
    if u, ok := mux.redirectToPathSlash(host, path, r.URL); ok {
   
return RedirectHandler(u.String(), StatusMovedPermanently), u.Path
    }

    // 如果整理后的 URL 与请求中的路径不一样，先调用 handler 进行匹配
    // 在将请求里的 URL 改成整理后的 URL
    // 最后将该请求重定向到整理后的 URL
    if path != r.URL.Path {
   
_, pattern = mux.handler(host, path)
   
url := *r.URL
   
url.Path = path
   
return RedirectHandler(url.String(), StatusMovedPermanently), pattern
    }
    // 若以上条件都不满足则返回匹配结果
    return mux.handler(host, r.URL.Path)
}
```

我们有必要看看 match 方法是怎么进行匹配的

```go
func (mux *ServeMux) match(path string) (h Handler, pattern string) {
    // 若 mux.m 中已存在该路由映射，直接返回该路由的 Handler，和路径
    v, ok := mux.m[path]
    if ok {
   
return v.h, v.pattern
    }

    // 找到路径能最长匹配的路由。
    for _, e := range mux.es {
   
if strings.HasPrefix(path, e.pattern) {
   
    return e.h, e.pattern
   
}
    }
    return nil, ""
}
```

注意这里是在 mux.es 中进行查找，而不是映射表 mux.m 中，而 mux.es 是存放所有以 "/" 结尾的路由路径的切片。因为只会在以 "/" 结尾的路由路径中才会出现需要选择最长匹配方案

比如注册的路由有

```go
mux.HandleFunc("/a/b/", ab)
mux.HandleFunc("/a/", a)
```

那么当一个请求的 URL 为 /a/b/c 的时候，我们希望是由 ab 来处理这个请求。

另外，为了减少在 mux.es 中的查询时间， mux.es 中元素是按照它们的长度由大到小顺序存放

### 5. ServeHTTP 方法

我们知道在 Go 中要实现一个处理请求的 handler 结构体需要让该结构体现实 Handler 接口的 ServeHTTP 方法：

```go
// Handler 接口
type Handler interface {
    ServeHTTP(ResponseWriter, *Request)
}

type myHandler struct {}

func (h *myHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("This message is from myHandler."))
}

func main() {
    http.Handle("/", &helloHandler{})  // 路由注册
}
```

我们已经通过 Handler 方法拿到了请求(Request)和它对应的处理函数(Handler)

我们的 ServeMux 是一个结构体，它的 ServeHTTP 方法要做的就是将每个请求派遣(dispatch)到它们对应的处理函数上。

```go
func (mux *ServeMux) ServeHTTP(w ResponseWriter, r *Request) {
    // 如果请求路径为 "*"，告诉浏览器该连接已关闭并返回状态码 400
    if r.RequestURI == "*" {
   
if r.ProtoAtLeast(1, 1) {
   
    w.Header().Set("Connection", "close")
    }
   
w.WriteHeader(StatusBadRequest)
   
return
    }
    // 调用 mux.Handler 方法获取请求和它对应的处理函数
    h, _ := mux.Handler(r)
    // 将 ResponseWriter 和 *Request 类型的参数传给处理函数
    h.ServeHTTP(w, r)
}
```

这样，每收到一个请求就会调用对应的处理函数来处理该请求了。

### 6. 关于 http.HandleFunc 方法

但我们通常会看到，一些简单的示例代码是下面这样写的：

```go
func helloHandler(w http.ResponseWriter, req *http.Request) {
    io.WriteString(w, "hello, world!
")
}

func main() {
    http.HandleFunc("/", helloHandler)
    http.ListenAndServe(":8000", nil)
}
```

我们可以看一下 http.HandleFunc 方法做了些什么：

```go
func HandleFunc(pattern string, handler func(ResponseWriter, *Request)) {
    DefaultServeMux.HandleFunc(pattern, handler)
}
```

可以看到该方法中使用了一个 DefaultServeMux 来注册传入的路由，继续看：

```go
var DefaultServeMux = &defaultServeMux

var defaultServeMux ServeMux
```

可以看到，http.HandleFunc 也是通过实例化一个全局的 ServeMux 来进行路由注册的。

## 总结

我们已经了解了 ServeMux 是怎么实现多路处理了，简单概括一下。Handle 和 HandleFunc 方法用来将路由路径与处理函数的映射通过一个 map 记录到当前的 mux 实例里；Handler 方法将接收的请求中的 URL 预处理后拿去和记录的映射匹配，若匹配到，就返回该路由的处理函数和路径；ServeHTTP 方法将请求派遣给匹配到的处理函数处理。

但是 ServeMux 的多路处理实现并不支持**请求方法判断**，也不能处理**路由嵌套**和**URL变量值提取**的功能。