---
author: Tsong Lew
pubDatetime: 2024-03-02T15:22:00.000+08:00
modDatetime: 2024-03-02T15:22:00.000+08:00
title: Redis 事件循环
slug: Redis 事件循环
featured: true
draft: false
tags:
  - redis
description: Redis 事件循环源码分析
---

## Table of Contents

## 事件

### 文件事件(aeFileEvent)

对套接字进行多路复用而产生的事件， 可以分为**读事件**和**写事件**两类

- 读事件：
  - 当客户端只是连接到服务器，但并没有向服务器发送命令时，该客户端的读事件就处于**等待状态**
  - 当客户端给服务器发送命令请求，并且请求已到达时（相应的套接字可以无阻塞地执行读操作），该客户端的读事件处于**就绪状态**
- 写事件：
  - 当服务器有命令结果需要返回给客户端，但客户端还未能执行无阻塞写，那么写事件处于**等待状态**
  - 当服务器有命令结果需要返回给客户端，并且客户端可以进行无阻塞写，那么写事件处于**就绪状态**
  - 在命令结果传送完毕之后， 客户端和写事件的关联就会被移除

> 同时出现 读事件 和 写事件 时优先处理 读事件

### 时间事件(aeTimeEvent)

时间事件记录着那些要在指定时间点运行的事件， 多个时间事件以**链表**的形式保存在服务器状态中
> 正常模式下的 Redis 只带有 serverCron 一个时间事件， 而在 benchmark 模式下， Redis 也只使用两个时间事件

在 Redis 中， 常规操作由 redis.c/serverCron 实现， 它主要执行以下操作：

- 更新服务器的各类统计信息，比如时间、内存占用、数据库占用情况等。
- 清理数据库中的过期键值对。
- 关闭和清理连接失效的客户端。
- 尝试进行 AOF 或 RDB 持久化操作。
- 如果服务器是主节点的话，对附属节点进行定期同步。
- 如果处于集群模式的话，对集群进行定期同步和连接测试。

## 主要流程

![redis-event-loop1](/images/redis-event-loop/P4NhYzE.png)

## 初始化流程

- 创建 epollfd
- 创建事件循环对象 aeEventLoop
- 创建 listenfd 并绑定到 epollfd

### 创建事件循环对象

`main -> initServer -> aeCreateEventLoop`

```c
// server.c
void initServer(void) {
 // 初始化默认属性
    // ...

    // 创建 event loop 对象
    server.el = aeCreteEventLoop(server.maxclients+CONFIG_FDSET_INCR);
    
    // 初始化时间事件 handler，处理后台任务
    aeCreateTimeEvent(server.el, 1, serverCron, NULL, NULL)    

    // 初始化文件事件 handler，将监听 fd 挂载到 epollfd，处理 TCP 连接和 Unix socket 连接
    aeCreateFileEvent(server.el, server.ipfd[j], AE_READABLE, acceptTcpHandler,NULL)
}
```

为了保证安全运行，`CONFIG_FDSET_INCR = CONFIG_MIN_RESERVED_FDS(32) + 96`

```c
aeEventLoop *aeCreateEventLoop(int setsize) {
    aeEventLoop *eventLoop;
    int i;

 // 初始化 event loop 属性
    eventLoop = zmalloc(sizeof(*eventLoop));
    
    // 存放所有监听的事件
    eventLoop->events = zmalloc(sizeof(aeFileEvent)*setsize);
    // 存放已触发的事件
    eventLoop->fired = zmalloc(sizeof(aeFiredEvent)*setsize);
    
    // eventLoop 参数初始化
    // ...
    
    // 创建 epollfd 并 绑定到 event loop
    if (aeApiCreate(eventLoop) == -1) goto err;
    
    // ...
}
```

eventloop 对象

```c
typedef struct aeEventLoop {
    int maxfd;   // 已注册的最大的 fd
    int setsize; // 已注册的 fd 数量
    long long timeEventNextId;
    aeFileEvent *events; // 已注册的事件
    aeFiredEvent *fired; // 被触发的事件
    aeTimeEvent *timeEventHead;  // 时间事件链表头
    // ...
} aeEventLoop;
```

### 创建 epollfd

main -> initServer -> aeCreateEventLoop -> aeApiCreate

```c
typedef struct aeApiState {
    int epfd;
    struct epoll_event *events;
} aeApiState;

static int aeApiCreate(aeEventLoop *eventLoop) {
    // 分配内存
    aeApiState *state = zmalloc(sizeof(aeApiState));
    state->events = zmalloc(sizeof(struct epoll_event)*eventLoop->setsize);
    
    // 创建 epoll 句柄
    state->epfd = epoll_create(1024);
    
    // 将 epollfd 绑定到 event loop 对象
    eventLoop->apidata = state;
    return 0;
}
```

后续需要操作 epollfd 时可以通过 `aeEventLoop -> apidata -> state -> epfd` 访问 epollfd 对象

### 创建 listenfd

#### 初始化 listenfd，绑定 IP 和端口

创建 socket

```c
static int anetCreateSocket(char *err, int domain) {
    int s;
    
    // domain 指定通信协议族，SOCK_STREAM 表示使用 TCP 连接
    s = socket(domain, SOCK_STREAM, 0)
        
    // ...
    return s;
}
```

`main->initServer->listenToPort->anetTcpServer->_anetTcpServer->anetListen`
`listenToPort` 中循环处理所有绑定的地址，对每个连接请求使用 `_anetTcpServer` 中会创建新的 socket，并最终调用 `anetListen` 执行地址绑定和监听。

```c
// anet.c
static int anetListen(char *err, int s, struct sockaddr *sa, socklen_t len, int backlog) {
    // 将 socket 绑定到指定的地址
    bind(s,sa,len)
 // 启动监听 socket
    listen(s, backlog)
    return ANET_OK;
}
```

#### 创建处理客户端连接的文件事件

将监听客户端连接的 socket 对应的 fd 加入 eventLoop 的 epollfd 的监听列表，并将回调函数设为 `acceptTcpHandler`

```c
void initServer(void) {
    // ...
    aeCreateFileEvent(server.el, server.ipfd[j], AE_READABLE, acceptTcpHandler,NULL);
    // ...
}
```

`aeCreateFileEvent` 执行挂载 listenfd 的过程，并绑定事件的回调函数

```c
int aeCreateFileEvent(aeEventLoop *eventLoop, int fd, int mask,
        aeFileProc *proc, void *clientData)
{

    aeFileEvent *fe = &eventLoop->events[fd];

    if (aeApiAddEvent(eventLoop, fd, mask) == -1)
        return AE_ERR;
    
    fe->mask |= mask;
    
    // 绑定可读事件处理函数
    if (mask & AE_READABLE) fe->rfileProc = proc;
    // 绑定可写事件处理函数
    if (mask & AE_WRITABLE) fe->wfileProc = proc;
    
    return AE_OK;
}
```

`aeApiAddEvent` 通过 `epoll_ctl` 系统调用将 listenfd 挂载到 epoll

```c
static int aeApiAddEvent(aeEventLoop *eventLoop, int fd, int mask) {
    aeApiState *state = eventLoop->apidata;
    struct epoll_event ee = {0};
    
    // 如果已经监听的这个 fd 的其他事件，则使用 EPOLL_CTL_MOD，否则使用 EPOLL_CTL_ADD
    int op = eventLoop->events[fd].mask == AE_NONE ?
            EPOLL_CTL_ADD : EPOLL_CTL_MOD;

    ee.events = 0;
    // 合并已经绑定的事件
    mask |= eventLoop->events[fd].mask;
    // 设置监听事件
    if (mask & AE_READABLE) ee.events |= EPOLLIN;
    if (mask & AE_WRITABLE) ee.events |= EPOLLOUT;
    ee.data.fd = fd;
    // 将监听 fd 加入 epfd
    if (epoll_ctl(state->epfd,op,fd,&ee) == -1) return -1;
    return 0;
}
```

> epoll_ctl 参数：
>
> - epfd: epollfd 对象
> - op: 操作类型，包括
>   - EPOLL_CTL_ADD：注册新的 fd 到 epollfd
>   - EPOLL_CTL_MOD: 修改已注册的 fd
>   - EPOLL_CTL_DEL: 从 epfd 中删除 fd
> - event：event 的 events 属性是以下几个宏的集合：
>   - EPOLLIN ：可读（包括对端SOCKET正常关闭）；
>   - EPOLLOUT：可写；
>   - EPOLLPRI：有紧急的数据可读（这里应该表示有带外数据到来）；
>   - EPOLLERR：发生错误；
>   - EPOLLHUP：被挂断；
>   - EPOLLET： 将EPOLL设为边缘触发(Edge Triggered)模式，这是相对于水平触发(Level Triggered)来说的。
>   - EPOLLONESHOT：只监听一次事件，当监听完这次事件之后，如果还需要继续监听这个socket的话，需要再次把这个socket加入到EPOLL队列里

后续客户端请求连接时将会在 `aeMain` 循环中触发这个文件事件

## 循环处理事件

- 处理新客户端连接
- 处理客户端请求

主循环中会循环通过 `main -> initServer -> aeMain-> aeProcessEvent` 调用 `aeProcessEvents` 处理事件

### 一次事件处理

```c
int aeProcessEvents(aeEventLoop *eventLoop, int flags)
{
 // ... 

    // 计算 IO 多路复用等待事件 tvp
    if (flags & AE_TIME_EVENTS && !(flags & AE_DONT_WAIT))
            // 查找离现在最近的时间事件, 在 eventLoop->timeEventHead 链表中找出第一个需要触发的时间事件
            shortest = aeSearchNearestTimer(eventLoop);
    if (shortest) {
        // 计算距离最近时间事件的时间
        long now_sec, now_ms;
        aeGetTime(&now_sec, &now_ms);
        tvp = &tv;
        long long ms = (shortest->when_sec - now_sec)*1000 + shortest->when_ms - now_ms;

        // 将时间写入 tvp，如果需要立即执行则记为 0
        if (ms > 0) {
            tvp->tv_sec = ms/1000;
            tvp->tv_usec = (ms % 1000)*1000;
        } else {
            tvp->tv_sec = 0;
            tvp->tv_usec = 0;
        }
        // ...

        // 调用 epoll_wait
        numevents = aeApiPoll(eventLoop, tvp);
        for (j = 0; j < numevents; j++) {
            // 遍历 eventLoop->fired
            aeFileEvent *fe = &eventLoop->events[eventLoop->fired[j].fd];
            int mask = eventLoop->fired[j].mask;
            int fd = eventLoop->fired[j].fd;
            // 记录当前 fd 触发的事件数
            int fired = 0;

            // ...
            
            // 处理可读事件
            fe = &eventLoop->events[fd]; /* Refresh in case of resize. */
            if ((fe->mask & mask & AE_READABLE) &&
                (!fired || fe->wfileProc != fe->rfileProc)) {
                fe->rfileProc(eventLoop,fd,fe->clientData,mask);
                fired++;
            }
            
            // 处理可写事件
            if (fe->mask & mask & AE_WRITABLE) {
                if (!fired || fe->wfileProc != fe->rfileProc) {
                    fe->wfileProc(eventLoop,fd,fe->clientData,mask);
                    fired++;
                }
            }
        }
    }
    
    // 处理时间事件
    if (flags & AE_TIME_EVENTS)
        processed += processTimeEvents(eventLoop);

    return processed; /* return the number of processed file/time events */
}
```

Linux 环境下，`aeApiPoll`  中实际调用 `epoll_wait` 。 `epoll_wait` 的超时时间通过 `tvp` 参数表示。所以如果在有时间事件需要立即执行时， `tvp` 被置为 0， `epoll_wait` 立即返回，否则 `epoll_wait`  最多等待 `tvp` 表示的时间

```c
static int aeApiPoll(aeEventLoop *eventLoop, struct timeval *tvp) {
    aeApiState *state = eventLoop->apidata;
    int retval, numevents = 0;
 
    retval = epoll_wait(state->epfd,state->events,eventLoop->setsize,
            tvp ? (tvp->tv_sec*1000 + tvp->tv_usec/1000) : -1);
    
    if (retval > 0) {
        int j;

        numevents = retval;
        // 将触发的事件加入 eventLoop->fired 数组
        for (j = 0; j < numevents; j++) {
            int mask = 0;
            struct epoll_event *e = state->events+j;

            if (e->events & EPOLLIN) mask |= AE_READABLE;
            if (e->events & EPOLLOUT) mask |= AE_WRITABLE;
            if (e->events & EPOLLERR) mask |= AE_WRITABLE|AE_READABLE;
            if (e->events & EPOLLHUP) mask |= AE_WRITABLE|AE_READABLE;
            eventLoop->fired[j].fd = e->data.fd;
            eventLoop->fired[j].mask = mask;
        }
    }
    return numevents;
}
```

> epoll_wait 参数
>
> - epfd: epollfd 对象
> - events: 从内核得到事件的集合
> - maxevents: 本次返回的最大 fd 数量
> - timeout: 超时时间（单位：毫秒，0会立即返回，-1 表示阻塞）

由于时间事件需要等待文件事件处理完后再执行，所以事件时间很有可能不会准时执行，如图所示：

![](https://i.imgur.com/SkEIgVI.png)

### 处理新客户端连接

#### 接收客户端连接请求

当客户端请求时，会触发上面绑定的文件事件，然后调用绑定的回调函数 `acceptTcpHandler` ， `anetTcpServer`  中为了防止处理时间过长每次只处理1000个连接请求，通过调用链 `acceptTcpHandler->anetTcpAccept->anetGenericAccept` 最终调用 `anetGenericAccept`

```c
static int anetGenericAccept(char *err, int s, struct sockaddr *sa, socklen_t *len) {
    int fd;
    while(1) {
        fd = accept(s,sa,len);
        if (fd == -1) {
            // 出现 EINTR 表示 accept 系统调用被中断，忽略 EINTR 后重新调用即可
            if (errno == EINTR)
                continue;
            else {
                anetSetError(err, "accept: %s", strerror(errno));
                return ANET_ERR;
            }
        }
        break;
    }
    // 返回新连接客户端对应的 clientfd
    return fd;
}
```

通过 `accept` 系统调用获取客户端的 fd
> accept 参数：
>
> - s: socket fd
> - sa: accept 调用时会在 sa 填充请求端的地址
> - len: accept 调用时会在 len 填充请求端地址的大小
>
返回新客户端对应的 fd

#### 将 clientfd 挂载到 epollfd 上

接收客户端连接并执行初始化操作

```c
static void acceptCommonHandler(connection *conn, int flags, char *ip) {
    // conn 是根据新的客户端连接生成的连接对象
 
    // 控制同时连接的客户端对象
    // 当前客户端连接数 = 连接到当前服务端的数量 + 用于集群模式通信的连接数量
    if (listLength(server.clients) + getClusterConnectionsCount()
        >= server.maxclients)
    {
        // 关闭客户端连接
        // ...
    }
    
    // 初始化客户端连接对象，这个客户端对象会用来存储客户端的命令、返回结果等参数
    c = createClient(conn)
        
    // 执行接收客户端数据的操作
    connAccept(conn, clientAcceptHandler);
}
```

初始化客户端连接，并把新客户端对应的 clientfd 挂载到 epollfd

```c
client *createClient(connection *conn) {
    client *c = zmalloc(sizeof(client));

    if (conn) {
        // 设置连接参数
        // 将 clientfd 设置成非阻塞
        connNonBlock(conn);
        // 禁用 Naegle's Algorithm
        connEnableTcpNoDelay(conn);
        if (server.tcpkeepalive)
            connKeepAlive(conn,server.tcpkeepalive);
        // 将 clientfd 挂载到 epollfd，并将回调函数设为 readQueryFromClient
        connSetReadHandler(conn, readQueryFromClient);
  // ...
    }
    // ...
}
```

### 处理客户端可读事件

客户端可读事件触发时会通过回调函数调用 `readQueryFromClient`

```c
void readQueryFromClient(connection *conn) {
    // 读取客户端数据
    client *c = connGetPrivateData(conn);
    int nread, readlen;

    // 多线程模式执行
    if (postponeClientRead(c)) return;
    
    // 单线程模式

    // 初始化缓冲区参数
    // ...
    
    // 从 clientfd 读取数据，将客户端指令写入缓冲区，qblen 为 querybuf 已有的数据，readlen 为每次读取的最大长度
    nread = connRead(c->conn, c->querybuf+qblen, readlen);
    // 处理缓冲区数据
    processInputBuffer(c);
}
```

`connRead` 内部是一个函数指针，实际调用了 `connSocketRead` 函数，该函数使用系统调用 `read(int fd, void *buf, size_t nbyte)` 读取数据。 `read` 读取的数据记录在客户端对象的 `queryBuf` 中
`readQueryFromClient` 在读取客户端命令后，会调用 `processInputBuffer` 根据客户端指定的命令执行对应的函数，命令执行完成后会将结果写回客户端对象的 `reply` 属性。

#### 多线程处理

`postponeClientRead`  中会检查是否满足多线程处理的条件，如果可以用多线程执行，则会中断 `readQueryFromClient` 中 `postponeClientRead` 后面的代码的执行。否则继续执行后面的代码，也就是以单线程模式处理客户端请求。

```c
int postponeClientRead(client *c) {
    // 当多线程 I/O 模式开启、主线程没有在处理阻塞任务时，将 client 加入异步队列。
    if (server.io_threads_active &&  // 检查多线程 IO 是否开启，在待处理请求较少时会停止多线程 IO
        server.io_threads_do_reads &&   // 检查是否配置了多线程读
        !ProcessingEventsWhileBlocked &&  // 检查会否在执行加载数据等阻塞任务
        !(c->flags & (CLIENT_MASTER|CLIENT_SLAVE|CLIENT_PENDING_READ))) // 主从库复制请求不使用多线程 IO
        // 连接标识为 CLIENT_PENDING_READ 来控制不会反复被加队列，在下次的时候会直接进入到命令读取和解析
    {
        // 给 client 打上 CLIENT_PENDING_READ 标识，表示该 client 需要被多线程处理，
        // 后续在 I/O 线程中会在读取和解析完客户端命令之后判断该标识并放弃执行命令，让主线程去执行。
        c->flags |= CLIENT_PENDING_READ;
        
        // 将 client 放入一个 LIFO 队列 clients_pending_read
        listAddNodeHead(server.clients_pending_read,c);
        return 1;
    } else {
        return 0;
    }
}
```

client 加入 `clients_pending_read` 队列后，会由 `handleClientsWithPendingReadsUsingThreads` 取出并处理

```c
int handleClientsWithPendingReadsUsingThreads(void) {
    if (!server.io_threads_active || !server.io_threads_do_reads) return 0;
    int processed = listLength(server.clients_pending_read);
    if (processed == 0) return 0;

    if (tio_debug) printf("%d TOTAL READ pending clients\n", processed);

    // 创建一个链表迭代器，并将等待处理的客户端以此添加到迭代器头部
    listIter li;
    listNode *ln;
    listRewind(server.clients_pending_read,&li);
    int item_id = 0;
    
    // 将等待处理的客户端依次分配给工作线程
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        int target_id = item_id % server.io_threads_num;
        // io_threads_list 是每个线程待处理客户端的队列列表
        listAddNodeTail(io_threads_list[target_id],c);
        item_id++;
    }

    // 设置全局变量，工作线程根据这个变量执行读写操作
    io_threads_op = IO_THREADS_OP_READ;
    for (int j = 1; j < server.io_threads_num; j++) {
        int count = listLength(io_threads_list[j]);
        io_threads_pending[j] = count;
    }

    // 主线程处理 io_threads_list[0] 中的客户端
    listRewind(io_threads_list[0],&li);
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        readQueryFromClient(c->conn);
    }
    // 完成任务后清空 io_threads_list 中对应的队列
    listEmpty(io_threads_list[0]);

    // 主线程等待所有其他工作线程完成任务处理
    while(1) {
        unsigned long pending = 0;
        for (int j = 1; j < server.io_threads_num; j++)
            pending += io_threads_pending[j];
        if (pending == 0) break;
    }
    if (tio_debug) printf("I/O READ All threads finshed\n");

 // ...
}
```

IO 线程由主线程执行 `initThreadedIO` 初始化，线程数量由启动参数中 `io_threads_num` 控制。
各工作线程会分别从自己的任务队列 `io_threads_list[n]` 中读取待处理的客户端实例，然后调用 `readQueryFromClient` 执行类似单线程的命令处理操作

#### 将结果写回客户端

前面 `readQueryFromClient` 调用 `processCommand` 处理完命令之后会调用 `addReply` 将结果写入客户端缓冲区

```c
void addReply(client *c, robj *obj) {
    // 检查客户端 buf 缓冲区中是否有未发送的数据，则将新数据添加到未发送数据的尾部，并注册一个写事件回调函数
    if (prepareClientToWrite(c) != C_OK) return;
    
    // ...
    _addReplyToBuffer(c,buf,len)
    // ...
}
```

`_addReplyToBuffer` 将结果写入客户端对象的 `buf` 属性中

```c
int _addReplyToBuffer(client *c, const char *s, size_t len) {
    size_t available = sizeof(c->buf)-c->bufpos;
    
    // ...

    // 执行内存拷贝
    memcpy(c->buf+c->bufpos,s,len);
    c->bufpos+=len;
    return C_OK;
}

```

结果写入客户端对象的 `buf` 之后，会由主循环执行调用链 `aeMain->beforeSleep->handleClientsWithPendingWritesUsingThreads` 将缓冲区中的数据发送出去

```c
int handleClientsWithPendingWritesUsingThreads(void) {

    // 未开启多线程模式，则跳转到单线程处理
    if (server.io_threads_num == 1 || stopThreadedIOIfNeeded()) {
        return handleClientsWithPendingWrites();
    }
        
    // 将有数据要发送的客户端对象写入一个迭代器
    listIter li;
    listNode *ln;
    listRewind(server.clients_pending_write,&li);
    
    int item_id = 0;
    // 依次将待处理的客户端分配到各线程的任务队列中
    while((ln = listNext(&li))) {
  // ...
        listAddNodeTail(io_threads_list[target_id],c);
        item_id++;
    }

    // 设置全局变量，其他工作线程根据这个变量执行读写任务
    io_threads_op = IO_THREADS_OP_WRITE;
    for (int j = 1; j < server.io_threads_num; j++) {
        int count = listLength(io_threads_list[j]);
        io_threads_pending[j] = count;
    }

    // 主线程处理 io_threads_list[0] 队列中的客户端
    listRewind(io_threads_list[0],&li);
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        writeToClient(c,0);
    }
    listEmpty(io_threads_list[0]);

    // 客户端等待工作线程完成任务
    while(1) {
        unsigned long pending = 0;
        for (int j = 1; j < server.io_threads_num; j++)
            pending += io_threads_pending[j];
        if (pending == 0) break;
    }

    // 给每个处理完的客户端注册回调函数 sendReplyToClient
    listRewind(server.clients_pending_write,&li);
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        connSetWriteHandler(c->conn, sendReplyToClient)
    }
 // ...
}
```

`writeToClient` 会通过 `writeToClient->connWrite->write` 调用 `write` 系统调用，将处理结果发送出去

## 参考

- [x] [Redis 设计与实现](https://redisbook.readthedocs.io/en/latest/internal/ae.html)
- [x] [Redis 中的事件循环](https://draveness.me/redis-eventloop/)
- [x] [C++服务器开发精髓](https://book.douban.com/subject/35491437/)
- [x] [Redis 多线程网络模型](https://strikefreedom.top/multiple-threaded-network-model-in-redis)
- [x] [Redis Protocol specification](https://redis.io/topics/protocol)
