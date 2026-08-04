---
title: '22580：从 GPT-2 到 Kimi K3，一步步讲透'
description: '从 GPT-2 到 Kimi K3 的架构演化全解析。每一步架构变化都用可运行的 PyTorch 代码讲透——门控、路由、衰减与选择性机制，理解 22580 倍规模增长背后的每个决策。'
publishDate: 2026-08-04
tags: [AI, LLM, Transformer]
---
# 22580：从 GPT-2 到 Kimi K3，一步步讲透

> **导读**
>
> 这篇教程解读 X 用户 ali（ @waterloo_intern）的长文 [《22580: From GPT2 to Kimi3, Explained》](https://x.com/waterloo_intern/article/2081762065392541951)——一篇获得 1.15 万点赞、2000 转发、460 万浏览量的技术文章。原文作者 ali 在 baseten 做推理引擎研究，他用代码驱动的叙事方式，把从 GPT-2（2019，124M 参数）到 Kimi K3（2026，2.8 万亿参数）这条演化路径上的每一步架构变化，都用可运行的 PyTorch 片段讲透了。
>
> “22580”是全文的第一个钩子：一个 Kimi K3 模型里能塞下 22,580 个 GPT-2。七年放大 22,580 倍——但这不仅仅是规模，每一步架构变化都在解决一个具体问题。这篇教程模仿 *Hands-On* 系列的风格，带你从代码层面理解每一步“为什么改”以及“怎么改”。
>
> **贯穿全文的主题**（原文最后一段的原话）：一个固定容量的联想记忆需要一个淘汰策略，因为纯粹的加法操作一旦到达容量上限就会产生干扰。为此，学习型的选择性机制——门控、路由或衰减——是必要的，而注意力是最有效的选择性读取机制。

---

## 第一章 · GPT-2：一切的起点

### 1.1 一个 GPT-2 长什么样

GPT-2 是一个 decoder-only（纯解码器）架构。原文给出了它最核心的前向传播代码：

```python
tok_emb = self.transformer.wte(idx)   # token 嵌入，形状 (b, t, n_embd)
pos_emb = self.transformer.wpe(pos)   # 位置嵌入，形状 (t, n_embd)
x = self.transformer.drop(tok_emb + pos_emb)
for block in self.transformer.h:
    x = block(x)
x = self.transformer.ln_f(x)
logits = self.lm_head(x)
return logits
```

整个过程可以这样理解：输入是一串 token ID（比如 `[42, 307, 634, ...]`），先查表得到每个 token 的向量表示，再加上位置向量告诉模型“谁在前面”，然后依次过若干个 Transformer Block，最后用一个线性层把隐藏状态映射回词表大小的 logits——每个位置对应一个“下一个词是什么”的概率分布。

输入先获得 token 嵌入和位置嵌入，两者相加后送入 Block 堆栈。

### 1.2 每个 Block 里面发生了什么

放大看单个 Block，结构出奇地简单——两个子层，各带一个 LayerNorm 和残差连接：

```python
class Block(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.ln_1 = LayerNorm(config.n_embd, bias=config.bias)
        self.attn = CausalSelfAttention(config)
        self.ln_2 = LayerNorm(config.n_embd, bias=config.bias)
        self.mlp = MLP(config)

    def forward(self, x):
        x = x + self.attn(self.ln_1(x))
        x = x + self.mlp(self.ln_2(x))
        return x
```

两行 forward 就概括了整个 Block 的逻辑：先归一化、算注意力、加残差；再归一化、算 MLP、加残差。“先归一化再算子层”是 Pre-Norm 结构，梯度比 Post-Norm 稳定。

### 1.3 注意力：QKV 的矩阵游戏

Block 里的注意力计算，展开来是这样的：

```python
B, T, C = x.size()  # batch, 序列长度, 嵌入维度

# 一步算出 Q、K、V
q, k, v = self.c_attn(x).split(self.n_embd, dim=2)
k = k.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)  # (B, nh, T, hs)
q = q.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
v = v.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)

# 手动实现的注意力
att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(k.size(-1)))
att = att.masked_fill(self.bias[:,:,:T,:T] == 0, float('-inf'))  # 因果 mask
att = F.softmax(att, dim=-1)
y = att @ v  # (B, nh, T, T) × (B, nh, T, hs) → (B, nh, T, hs)
y = y.transpose(1, 2).contiguous().view(B, T, C)  # 拼回所有头

y = self.resid_dropout(self.c_proj(y))
return y
```

关键步骤拆解：`q @ k.transpose(-2, -1)` 算出每个位置对其他所有位置的关注分数，得到一个 $T \\times T$ 的矩阵；`masked_fill` 把上三角（未来位置）填成 $-\\infty$，保证只看过去；`softmax` 把分数归一化成权重；最后 `att @ v` 用权重对 Value 加权求和。这就是自注意力的全部。

### 1.4 KV 缓存：推理效率的第一个瓶颈

原文在讲完注意力后，话锋一转，抛出了整个系列文章的**核心问题**。

生成模式下，模型逐词输出。每生成一个新词，都要重新跑一遍前向传播。但前面的词的 K 和 V 不会变——如果每步都重算，就是浪费。解法是把它们**缓存**起来：

> *This is an inefficiency of decoder-only generation: the model computes representations for every input position, but each decode step consumes only the final position's logits. Without caching, much of that work would be repeated for the next token.*

KV 缓存的观察很直接：把生成的新 token 追加到输入后，模型本该重新计算所有之前 token 的投影。存储它们的 key 和 value 向量就能避免这种冗余。

这个存储就是 KV 缓存。它保留前 N-1 个 token 的向量，而且可能变得大到形成**内存带宽瓶颈**。

原文给出了带 KV 缓存的注意力实现：

```python
def forward(self, x, mask=None, past_kv=None):
    b, t, d = x.shape
    d_head = d // self.num_heads
    h = self.num_heads
    qkv = self.qkv_proj(x)

    q = qkv[:, :, :d].view(b, t, h, d_head).transpose(1, 2)
    k = qkv[:, :, d:2*d].view(b, t, h, d_head).transpose(1, 2)
    v = qkv[:, :, 2*d:].view(b, t, h, d_head).transpose(1, 2)

    # prefill 时 q,k,v 形状是 b,h,t,d
    # decode 时形状是 b,h,1,d
    # 所以在 t 维度上 cat

    if past_kv is not None:
        k_past = past_kv[0]
        v_past = past_kv[1]
        k = torch.cat((k_past, k), dim=2)
        v = torch.cat((v_past, v), dim=2)

    scores = (q @ k.transpose(-1, -2)) / math.sqrt(d_head)
    if past_kv is None:  # prefill 阶段需要 mask
        causal_mask = torch.ones(t, t, dtype=bool, device=q.device)
        causal_mask = torch.triu(causal_mask, diagonal=1)
        scores = scores.masked_fill(causal_mask, float('-inf'))

    attn = scores.softmax(-1)
    o = attn @ v
    o = o.transpose(1, 2).contiguous().view(b, t, d)
    o_proj = self.o_proj(o)
    past_kv = (k, v)
    return o_proj, past_kv
```

注意 `torch.cat((k_past, k), dim=2)` 这行——每次解码新 token 时，把新的 K、V 追加到缓存末尾。缓存随序列长度**线性增长**，复杂度是 $O\(N\)$。每个解码步骤要从 HBM（显存）读两次 N 维向量、写两次 1 维向量，而 KV 缓存随序列长度线性膨胀。

这就是后面所有架构创新的出发点：**能不能让缓存不增长？**

![KV缓存：缓存随序列线性增长](https://cdn.gooo.ai/gen-images/0be0f748995f0b0b34d93f82bd52632f9837de0a83f369af3026bb12163572dd.png)

### 1.5 GPT-2 的规模

原文给出了 GPT-2 的配置，作为整篇文章的基准：

```python
vocab_size: int = 50304  # 50257 向上取整到 64 的倍数，为了效率
n_layer: int = 12
n_head: int = 12
n_embd: int = 768
```

约 5 万词表、12 层、12 头、768 维——总共约 124M 参数。而 Kimi K3 是 2.8 万亿参数。一个 Kimi K3 ≈ 22,580 个 GPT-2。接下来的章节，就讲这 22,580 倍的差距里，架构到底变了什么。

---

## 第二章 · 线性注意力：把增长的缓存折叠成固定状态

### 2.1 问题：softmax 耦合了所有 Q 和 K

标准 softmax 注意力的核心操作是 $q \\cdot k$ 之后再做 softmax，这让每个 query 都和每个 key 耦合在一起。你不能提前把一部分结果“折叠”掉——必须等所有 QK 对的分数都算出来才能 softmax。

线性注意力的想法是：**不做 softmax，改用一个特征函数分别处理 q 和 k**，让乘积变得可以重新结合。这样，不断增长的 K 和 V 向量序列就能被折叠进一个**固定大小的 $D \\times D$ 状态矩阵**里。

### 2.2 动手：线性注意力的实现

原文把标准注意力换成线性注意力后，代码变成了这样：

```python
def forward(self, x, mask=None, cache=None):
    b, t, d = x.shape
    d_head = d // self.num_heads
    h = self.num_heads
    qkv = self.qkv_proj(x)

    q = qkv[:, :, :d].view(b, t, h, d_head).transpose(1, 2)
    k = qkv[:, :, d:2*d].view(b, t, h, d_head).transpose(1, 2)
    v = qkv[:, :, 2*d:].view(b, t, h, d_head).transpose(1, 2)

    # 关键变换：用 ELU+1 替代 softmax 的指数
    k = F.elu(k) + 1
    k = k.transpose(-1, -2)
    q = F.elu(q) + 1

    S, z = cache if cache is not None else (0.0, 0.0)
    S = S + k @ v       # 状态更新：外积累加
    z = z + k           # 归一化项累加

    o = q @ S           # 从状态读取
    denom = q @ z       # 归一化分母
    o_scaled = o / denom
    o_scaled = o_scaled.transpose(1, 2).contiguous().view(b, t, d)
    o_proj = self.o_proj(o_scaled)
    cache = (S, z)

    return o_proj, cache
```

和第一章的 KV 缓存对比，最关键的变化在缓存部分。标准注意力的缓存是 `(k, v)`——随序列增长的一堆向量。线性注意力的缓存是 `(S, z)`——两个固定大小的矩阵和向量，**不管序列多长都不增长**。

`S = S + k @ v` 是一个外积累加：每个新 token 的 key 和 value 做外积，加到状态矩阵 S 上。读取时 `o = q @ S`，用 query 去状态里检索。`z` 记录所有 key 的累加，用来做归一化。

### 2.3 注意力的三步拆解

原文在这里做了一个精妙的总结——所有注意力变体，本质上都做三件事：

1. **让 QK 分数非负**。线性注意力用 ELU+1，softmax 用指数函数。

2. **除以总和**（归一化）。

3. **对 Value 加权求和**。

线性注意力保留了注意力的基本契约，但用表达能力较弱的特征函数替代了 softmax 的指数函数。这个近似会损失一些精度，但换来了固定大小的状态——缓存不再随序列增长。

![线性注意力：把增长的缓存折叠成固定状态](https://cdn.gooo.ai/gen-images/044a6f9f218be46de0a124ed8aaf7a715af5c2f189a2836dc0d197ef84966141.png)

### 2.4 代价：加法导致干扰

但这里有一个根本性的问题。

线性注意力的状态 S 是一个 $D \\times D$ 矩阵。序列有 100 万个 token 时，所有 token 的 key-value 关联都被压缩进这同一个矩阵里。当序列长度远大于 D 时（这正是线性注意力有吸引力的场景），状态就**超容量**了。

问题在于更新方式是**纯加法**：`S = S + k @ v`。新信息不断叠加，旧信息无法离开。就像一个白板，你只能往上写新内容，永远不擦——写到一定程度，所有内容都糊在一起，谁都读不清楚。

原文引用了 Schlag 的论文（Fast Weight Programmers）的原话来描述这个问题：

> “当序列长度超过存储容量时，模型可能进入超容量状态。在这种状态下，模型应该学会动态地与内存内容交互，有选择地决定保留哪些 key-value 关联、删除哪些。纯加法指令可能不适合这个目的…… endlessly adding new associations to a memory of finite size inevitably will reach a limit.”

这就是下一章 DeltaNet 要解决的问题。

---

## 第三章 · DeltaNet：学会“先擦后写”

### 3.1 核心思想：Delta 规则

线性注意力的更新是 `S = S + kᵀ @ v`——无条件地把新信息加进去。

DeltaNet 的思路是：**在写入之前，先看看这个 key 方向上已经存了什么，只写入“差异”部分**。

想象白板上的一个格子。你不是直接往上面写新内容，而是先读一下格子里已有的内容，算出“新内容和旧内容的差异”，只把差异写上去。旧信息被自然替换，新信息被精确写入。

代码是这样的：

```python
def forward(self, x, mask=None, cache=None):
    b, t, d = x.shape
    d_head = d // self.num_heads
    h = self.num_heads
    qkv = self.qkv_proj(x)

    q = qkv[:, :, :d].view(b, t, h, d_head).transpose(1, 2)
    k = qkv[:, :, d:2*d].view(b, t, h, d_head).transpose(1, 2)
    v = qkv[:, :, 2*d:].view(b, t, h, d_head).transpose(1, 2)

    q = F.normalize(F.silu(q), dim=-1)
    k = F.normalize(F.silu(k), dim=-1)
    beta = torch.sigmoid(self.w_beta(x)).view(b, 1, t, 1)  # 新增：每 token 的写入强度

    S = cache if cache is not None else 0.0

    v_old = k @ S          # 读取：这个 key 方向上已存了什么
    u = beta * (v - v_old) # Delta：只取真正需要更新的部分
    S = S + k.transpose(-1, -2) @ u  # 写入：外积更新

    o = q @ S              # 读取，没有分母
    o = o.transpose(1, 2).contiguous().view(b, t, d)
    return self.o_proj(o), S
```

三行核心逻辑：

- `v_old = k @ S`：用当前 key 去状态里检索，看看这个方向上已经存了什么。

- `u = beta * (v - v_old)`：算出“想存的 v”和“已存的 v_old”的差。`beta` 是一个学习到的写入强度（0 到 1 之间），控制每次更新多少。

- `S = S + kᵀ @ u`：只把差异写入状态。

![DeltaNet：先读后算差再写入](https://cdn.gooo.ai/gen-images/af1ccc7808794f558b214e9c814640f119b6420182b4e54a75577ee30b94d707.png)

### 3.2 为什么这样能恢复信息

原文给了一个直观的解释。假设我们写入一个关联 `S = kᵀ @ v`，然后用同样的 key 读回来：

$$\text{读回} = k \cdot (k^\top v) = (k \cdot k^\top) \cdot v = \|k\|^2 \cdot v$$

读回来的结果被 key 的平方范数缩放了。如果把 k 归一化到单位长度（代码里 `F.normalize`），就能精确地读回 v。

Q 也是一个学习到的“指针”：$W_q$ 和 $W_k$ 读取同一个残差流，所以一个事实被写入时用的 key 方向，和后来检索它时用的 query 方向天然对齐。更新时先问“当前 key 从缓存里检索出了什么信息”，从要存的 value 里减掉这些已有信息，乘以 key，加回去。旧信息被移除，新信息被写入。

### 3.3 和线性注意力的对比

|  | 线性注意力 | DeltaNet |
| --- | --- | --- |
| 更新方式 | `S += kᵀ @ v`（纯加法） | `S += kᵀ @ (β(v - kS))`（先读后算差再写） |
| 能否覆盖旧信息 | 不能，只能叠加 | 能，用 delta 替换 |
| 超容量时的行为 | 干扰不断累积 | 可以精确更新单个关联 |
| 能否主动遗忘 | 不能 | 不能（只能替换有对应 key 的关联） |

注意最后一行——DeltaNet 解决了“精确更新”问题，但引入了新限制：它只能替换有具体替代品的关联。如果模型需要一次性清除多个关联（比如上下文切换时），或者需要整体衰减记忆来释放容量，DeltaNet 做不到。这是下一章 Gated DeltaNet 要解决的。

---

## 第四章 · DeltaNet 的并行化：最硬核的一节

> 原文说“这是全文最难的部分，我花了大约七个小时才建立起可用的理解”，所以会从实现代码出发来讲。

### 4.1 问题：Delta 规则是串行的

上面的 Delta 规则看起来很优雅，但有一个工程问题：**它是逐 token 串行的**。

```python
S = torch.zeros(b, h, dh, dh) if cache is None else cache
outs = []
for i in range(t):
    k_i = k[:, :, i:i+1]
    v_i = v[:, :, i:i+1]
    b_i = beta[:, :, i:i+1]
    v_old = k_i @ S                   # 读
    u_i  = b_i * (v_i - v_old)        # 算 delta
    S = S + k_i.transpose(-1, -2) @ u_i  # 写
    outs.append(q[:, :, i:i+1] @ S)   # 用更新后的 S 读
o = torch.cat(outs, dim=2)
```

每个 token 的更新都依赖前一个 token 更新后的状态 S——这没法并行。即使没有 Delta 规则，纯线性注意力的 prefill 也是串行的：

```python
S = torch.zeros(b, h, dh, dh) if cache is None else cache
outs = []
for i in range(t):
    q_i = q[:, :, i:i+1]
    k_i = k[:, :, i:i+1]
    v_i = v[:, :, i:i+1]
    S = S_old + k_i @ v_i
    o = q_i @ S
    o = self.norm(o)
    outs.append(o)
o = torch.cat(outs, dim=2)
```

GPU 最擅长的是大规模矩阵乘法，而逐 token 的串行循环完全浪费了这种能力。

### 4.2 分块：在串行和并行之间找平衡

解法是**分块（Chunking）**。把序列切成大小为 C 的块，块内做标准注意力（可以并行），块间做递归状态更新（串行但次数少）。

```python
S = torch.zeros(b, h, dh, dh) if cache is None else cache
outs = []
for i in range(t // C):
    q_c = q[:, :, i*C:(i+1)*C]
    k_c = k[:, :, i*C:(i+1)*C]
    v_c = v[:, :, i*C:(i+1)*C]

    o_prev = q_c @ S                           # 跨块：递归读取

    attn = (q_c @ k_c.transpose(-1, -2)).tril()  # 块内：因果注意力
    o_curr = attn @ v_c

    o = o_prev + o_curr                        # 两部分相加

    S_new = k_c.transpose(-1, -2) @ v_c        # 递归状态更新
    S = S + S_new
    outs.append(o)

o = torch.cat(outs, dim=2)
```

原文的解释非常清晰：**块内做 **<strong>`q(kᵀv)`</strong>**——先算分数，是带 mask 的标准注意力顺序。块间做 **<strong>`(kᵀv)q`</strong>**——先更新状态再读取，是递归顺序。**

计算量分两部分：固定部分 $2Ld^2$（状态更新，与 C 无关）和增长部分 $2LCd$（块内的注意力矩阵）。当 C=L 时退化为标准 $O\(N^2\)$ 注意力；当 C=1 时退化为纯线性注意力。C 越小，FLOP 越少。

但 C=1 不一定最快——GPU 的张量核心在 C=64 或 128 时效率最高。这就是工程上的权衡。

![分块并行：在串行和并行之间找平衡](https://cdn.gooo.ai/gen-images/d99ed1406c86fa7c29c8ee16db4ae2964302081eded81ab447a23604172aec3e.png)

### 4.3 把 Delta 规则也分块化

纯加法注意力的分块很直接，但 Delta 规则不行，因为每步都需要 `v_old = k_i @ S` 来计算要减去的旧信息。你需要每个 token 的状态才能算出 delta——没法直接并行。

作者的解法是**数学重参数化**。把原来的 Delta 更新：

```python
u = v_new - v_old
S_t = S_{t-1} + Kᵀ @ u
o = q @ S_T
```

改写成 Householder 矩阵的形式：

```python
S_t = S_{t-1}(I − β_t k_t k_tᵀ) + β_t v_t k_tᵀ
o_t = S_t q_t
```

这个形式允许一个块内所有 C 个 delta 一次性算出来。完整代码如下：

```python
def chunk_delta_rule_forward(Q, K, V, beta, C):
    L, d = Q.shape
    # 分块
    Q, K, V = map(lambda x: x.reshape(-1, C, d), [Q, K, V])
    beta = beta.reshape(-1, C)
    K_beta = K * beta.unsqueeze(-1)
    V_beta = V * beta.unsqueeze(-1)

    # 用向量化前代换计算快速逆矩阵（公式 10）
    T = -(K_beta @ K.t()).tril(-1)
    for i in range(1, C):
        T[i, :i] = T[i, :i] + (T[i, :, None] * T[:, :i]).sum(-2)

    T += torch.eye(C)
    W = T @ K_beta
    U = T @ V_beta

    # 分块并行（公式 8-9）
    S = torch.zeros(d, d)
    O = torch.empty_like(V)

    for i in range(L // C):
        q_i, k_i, w_i = Q[i], K[i], W[i]
        u_i = U[i] - w_i @ S        # 整个块的修正项
        o_inter = q_i @ S           # 跨块递归读取
        A_i = (q_i @ k_i.t()).tril()  # 块内因果注意力
        o_intra = A_i @ u_i         # 注意力 × 修正后的 value
        S += k_i.t() @ u_i          # 状态更新
        O[i] = o_intra + o_inter    # 块内 + 跨块
    return O.reshape(L, d)
```

这段代码的精髓：`u_i = U[i] - w_i @ S` 把“读取旧信息、计算 delta”这一串串行操作，变成了可以用预计算的 W、U 矩阵一次性完成的并行操作。代价是需要先算一个下三角矩阵 T（用前代换求逆），但这在块内（C=64 或 128）规模很小，可以高效完成。

至此，我们有了第一个对比基准：MHA（标准多头注意力）vs DeltaNet Transformer。DeltaNet 在保持线性复杂度的同时，通过 Delta 规则实现了精确的状态更新。

---

## 第五章 · Gated DeltaNet：让模型学会遗忘

### 5.1 Delta 规则的局限

DeltaNet 能精确更新单个关联——但它只能替换有对应替代品的关联。如果模型需要做**上下文切换**（一次性清除一批不再相关的关联），或者需要**整体衰减**记忆来释放容量，Delta 规则做不到。

换句话说，Delta 规则能“改”但不能“忘”。

### 5.2 Mamba 的解法：加一个遗忘门

如果做的是纯加法线性注意力，加遗忘能力很简单——只需要一个参数控制状态的衰减：

```python
S_old = cache
S_new = k @ v
# 原来：cache = S_old + S_new
cache = alpha * S_old + S_new   # 新：旧状态衰减后再加新状态
```

这就是 Mamba-2 的贡献：先衰减旧缓存，再以满强度加入新缓存，防止状态无限增长。

但 Mamba 的衰减是**均匀的**——所有 key-value 关联以同一个比例衰减。如果模型只需要遗忘一个特定的关联，所有关联都被等量遗忘。Delta 规则则相反——能更新单个事实，但没法让其他事实衰减。

### 5.3 Gated Delta 规则：两者结合

Gated Delta 规则把 Mamba 的门控衰减和 Delta 规则结合在一起。它加了一个参数 $\\alpha$（0 到 1 之间）：$\\alpha=1$ 时退化为纯 Delta 规则，$\\alpha=0$ 时清空记忆。

实现上用和 DeltaNet 相同的重参数化方法，数学几乎一样，只多了一个**数据相关的标量衰减**。原文指出，$\\gamma^r/\\gamma^i$ 项处理的是累积衰减：在时间步 $x$ 写入、在 $x+t$ 读取的 token，它的值已经被乘了 $\\alpha_x \\alpha*{x+1} \\alpha*{x+2} \\cdots \\alpha\_{x+t}$——这是前缀和计算的乘法类比。

> 🎯 **演化逻辑**：线性注意力（只能加）→ DeltaNet（能改不能忘）→ Gated DeltaNet（既能改又能忘）。每一步都补上了上一步缺少的一种"对记忆的操作"。

![Gated DeltaNet：让模型学会遗忘](https://cdn.gooo.ai/gen-images/4ac691fa13ed4aa04bd8fbc473b8e6bc2504edb02352162ae334f19e2aefadec.png)

---

## 第六章 · KDA / Kimi Linear：逐通道精细门控

### 6.1 从标量衰减到逐通道衰减

Gated DeltaNet 用一个标量 $\\alpha$ 控制整层的衰减。但不同通道（不同维度的特征）可能需要不同的遗忘速度——有些通道存的是长期事实，有些存的是临时上下文。

Kimi Linear 的核心改进：**为每个通道学习一个独立的衰减值**。不再是一个标量 $\\alpha$，而是一个向量 $\\boldsymbol{\\alpha} \\in \\mathbb{R}^d$。

原文指出，`alpha.reshape(nb, C, d)` 捕捉了论文最重要的贡献：对记忆衰减的**细粒度控制**。KDA 的更新规则和 Gated DeltaNet 类似，但衰减从标量变成了逐通道的向量。

### 6.2 不只是替换注意力——而是一个混合架构

把 KDA 放在 DeltaNet Transformer 旁边，Kimi Linear 引入了三个重大变化：

1. **混合系统**：交替使用 KDA 层和多头潜注意力（MLA）层。大部分层用高效的 KDA（固定状态），少量层用标准 softmax 注意力（全局检索）。

2. **MoE 替代 MLP**：前馈网络换成混合专家层。

3. **DeltaNet 容量增强**：通过 alpha 投影给 DeltaNet 增加容量。

原文在这里强调了一个重要观点：

> "This is not blind scaling. The additional capacity has a specific mathematical purpose: the per-channel scale gives the model finer control over memory decay."

每一步架构演进增加的容量都有明确的数学目的——不是盲目堆参数，而是在"正确的地方、以系统能利用的形式"增加容量。每个架构都在解决前一个架构的具体限制。

![KDA：逐通道精细门控](https://cdn.gooo.ai/gen-images/c4f342e7a9a903a9d61e4917b7e9a249e53325fdc9ed773d579c8757cc973bde.png)

### 6.3 Kimi Linear 的关键主张

原文提到，Kimi Linear 引起了关注，核心主张是：**在受控对比中，它超越了全注意力**。作者把它呈现为一个即插即用的架构替代品，质量更好且解码吞吐量最高达 6 倍。

---

## 第七章 · Kimi K3：一切汇总

### 7.1 整体架构

Kimi K3 的语言骨干和 Kimi Linear 很像。它包含 **23 个四层宏周期**。每个宏周期里，三层用 KDA，第四层用 MLA。第一层用稠密 FFN，其余每层用 Latent MoE。

原文列出了从 Kimi Linear 到 K3 的变化，看起来不大：

- 规模大幅增加

- 每 12 层一次 Blockwise AttnRes

- MLA query LoRA 和输出门控

- Latent-space MoE

- SiTU 激活函数

- Gated MLA

KDA 提供恒定状态的递归记忆，而周期性的 MLA 层保留了对上下文的完整 softmax 检索能力。

### 7.2 Gated MLA：控制多少特征进入残差流

Gated MLA 决定从 MLA 检索到的特征有多少进入残差流——通过一个从输入投影出来的门控做逐元素乘法来实现。

### 7.3 Latent-space MoE：压缩的专家

在传统 MoE 中，一个学习到的路由器用点积相似度把每个 token 发送到一部分专家网络。Kimi K3 总共有 **898 个专家**：2 个是共享专家（每个 token 都过），剩下 896 个里路由器为每个 token 选 16 个。

Kimi K3 还改变了专家的激活方式，用 SiTU 替代 SiLU：

```python
d = x.shape[-1] // 2
gate = x[..., :d].to(torch.float32)
up = x[..., d:].to(torch.float32)
situ_a = self.beta * torch.tanh(gate / self.beta) * torch.sigmoid(gate)
if self.linear_beta is not None:
    up = self.linear_beta * torch.tanh(up / self.linear_beta)
return (situ_a * up).to(x.dtype)
```

模型还把共享专家的输入下投影、输出上投影——专家在压缩的潜空间中运算，前向传播快得多，FLOP 几乎减半。不过原文也提到一个工程挑战：没有融合内核的话，新激活函数比原来慢近 3 倍。

### 7.4 剩余的改进

MLA query LoRA 和输出门控、每 12 层的 Blockwise Attention Residuals。AttnRes 增加约 2% 的推理延迟，但提供两个重要好处：

- **选择性检索早期表示**，缓解残差稀释和隐藏状态增长

- **1.25 倍的计算优势**

原文在这里点出了 AttnRes 和 MLA 的互补关系：KDA 层以恒定大小状态运行，不可避免地丢弃信息；MLA 从 token 上下文中检索，而 AttnRes 从更早的**深度方向**表示中检索。两者从不同方向解决同一个“信息丢失”问题。

---

## 第八章 · AttnRes：让深层模型选择性回看

### 8.1 标准残差连接的问题

在标准 Transformer 中，每层的输入是原始嵌入和所有前层输出的等权累加：

$$h_i = h_1 + \sum_{j=1}^{i-1} f_j(h_j)$$

$h_i$ 是第 $i$ 层的输入，$h_1$ 是当前 token 的嵌入，$f_j\(h_j\)$ 是第 $j$ 层的输出。

问题是**缺乏选择性访问**。不同类型的层接收相同的聚合状态，即使它们可能受益于不同的加权。而且因为递归是纯加法的，后面的层必须学越来越大的输出才能影响累积的残差——这会破坏训练稳定性。

### 8.2 AttnRes：用注意力做深度方向的检索

AttnRes 不是把所有前层输出等权相加，而是给每一项乘一个**学习到的权重**：

$$\tilde{h}_i = \sum_{j} \alpha_{ij}\, v_j, \qquad \alpha_{ij} = \frac{\exp(q_i \cdot k_j)}{\sum_{j'} \exp(q_i \cdot k_{j'})}$$

每个权重 $\\alpha\_{ij}$ 由 query-key 点积算出。query 为每层学习，key 和 value 来自更早的残差流状态。分数归一化后，用它们对历史状态做加权组合。

这本质上是把“注意力”机制用在了**深度方向**而非序列方向——让第 50 层可以“回看”第 10 层的表示，如果第 10 层的表示对当前计算更有用的话。

### 8.3 Block 粒度：每 12 层一次

如果每层都做 AttnRes，训练和推理成本太高。Kimi K3 的做法是**只在固定的块边界**做——每 12 个解码器层之后做一次。在 23 个四层宏周期中，产生 8 个 AttnRes 块。

核心伪代码非常简洁：

```python
V = torch.stack(blocks + [partial_block])  # [N+1, B, T, D]
K = norm(V)
logits = torch.einsum('d, n b t d -> n b t', proj.weight.squeeze(), K)
h = torch.einsum('n b t, n b t d -> b t d', logits.softmax(0), V)
return h
```

把多个 block 的表示堆叠成 V，归一化后做 query-key 点积得到 logits，softmax 后加权求和。一个 block 是 12 个解码器层（注意力和 MLP 输出的逐元素和）累积的单一深度表示，用于后续的 AttnRes 混合。

![AttnRes：深度方向的选择性回看](https://cdn.gooo.ai/gen-images/e084d93b07026af4c5a4fb9827b15a3d08fd24bbd218aafcd6a2ec64385a869c.png)

> 💡 **AttnRes 的本质**：标准残差连接是"把所有过去加起来"，AttnRes 是"用注意力选择性地把有用的过去加起来"。模型不再只能依赖紧邻的前一层，而是可以选择性地检索任何更早层的输出。

---

## 结语 · 一条贯穿始终的主线

原文的最后两段是整篇文章的点睛之笔：

> "The central change is not scale alone. Each architectural step changes what the model stores, how it updates that state, or how it retrieves information that a fixed-size state cannot preserve."

每一步架构变化都不是单纯的规模增长，而是改变了模型**存储什么**、**怎么更新状态**、或**怎么检索固定状态保存不了的信息**。

> "A fixed-capacity associative memory needs an eviction policy, since a purely additive linear operation eventually adds interference once at capacity. To that end, learned selection — like gating, routing, or decay — is necessary, and attention is the most effective selective-read mechanism."

一个固定容量的联想记忆需要淘汰策略。纯粹的加法操作一旦到达容量上限就会产生干扰。为此，学习型的选择性机制——门控、路由或衰减——是必要的，而**注意力是最有效的选择性读取机制**。

回看整条演化路径，每一步都在回答同一个问题的不同侧面：

| 架构 | 存储什么 | 怎么更新 | 怎么检索 | 淘汰策略 |
| --- | --- | --- | --- | --- |
| GPT-2 \(MHA\) | 全序列 KV（O\(N\) 增长） | 追加 | Softmax 注意力 | 无（缓存无限增长） |
| 线性注意力 | 固定 D×D 状态 | 纯加法 `S += kᵀv` | `q @ S` | 无（只加不减） |
| DeltaNet | 固定 D×D 状态 | Delta 规则（先读后算差再写） | `q @ S` | 精确替换（需要对应 key） |
| Gated DeltaNet | 固定 D×D 状态 | Delta + 标量衰减 | `q @ S` | 替换 + 均匀衰减 |
| KDA | 固定 D×D 状态 | Delta + 逐通道衰减 | `q @ S` | 替换 + 逐通道精细衰减 |
| Kimi K3 | KDA 状态 + MLA KV 缓存 + AttnRes | 上述全部 | KDA 读取 + MLA softmax + 深度注意力 | 逐通道衰减 + 稀疏路由 + 深度选择性检索 |

Kimi K3 最终组合了四种机制：恒定状态的递归记忆（KDA）、周期性的 softmax 检索（MLA）、稀疏的专家容量（Latent MoE）、以及选择性的深度方向残差访问（AttnRes）。结果是**一个在特定功能角色上花费额外容量的系统**——每多花的一分算力，都有明确的数学目的。

这就是从 GPT-2 到 Kimi K3 的故事。不是 22,580 倍的规模堆砌，而是 22,580 倍背后，每一步都精确地回答了“固定容量的记忆，该怎么管理自己”。