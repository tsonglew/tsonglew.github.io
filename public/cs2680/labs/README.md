# CS2680 离线实验包

三个小实验，沿着「控制一个 Agent → 比较策略 → 理解推理调度」逐步动手。每个实验都能在普通笔记本运行，全部使用 Python 标准库，不联网、不调用付费 API，不需要 GPU，也不执行任意 shell 命令。

这些是学习平台自编的入门实验，**不是 CS2680 官方作业、官方 starter code 或评分器**。代码里的模型是脚本化策略；token 和成本是模拟值；调度单位是抽象 tick。它们用于看清机制，不能作为真实模型能力、API 账单或 GPU 加速效果的证据。

## 先跑起来

需要 Python 3.9 或更高版本。在解压后的 `cs2680-labs` 目录打开终端，依次运行：

```sh
python3 --version
python3 -B agent_loop.py
python3 -B evaluate.py
python3 -B scheduler.py
python3 -B test_labs.py
```

Windows 若没有 `python3` 命令，可以替换为 `py -3`。不需要安装任何包。`-B` 只是避免生成 `__pycache__`，不会改变实验结果。最后一条命令应显示 `Ran 25 tests` 和 `OK`。

| 文件 | 学习目标 | 建议用时 |
| --- | --- | --- |
| `agent_loop.py` | 理解工具调用、参数校验、失败观察、重试与预算 | 25 分钟 |
| `evaluate.py` | 固定任务集，比较成功率和每次成功的总成本 | 20 分钟 |
| `scheduler.py` | 在同一工作负载上比较静态与连续批处理 | 25 分钟 |
| `test_labs.py` | 用边界和不变量检查结果是否可信 | 15 分钟 |

## 实验 1：一次工具调用失败后，Agent 如何继续

### 先预测，再运行

默认任务 `quality` 询问如何评估输出。脚本化模型故意先返回 `{"key": 123}`；工具的 schema 要求 `key` 是允许列表中的字符串。运行：

```sh
python3 -B agent_loop.py --task quality
```

你会看到这条执行链：

1. 第一次模型输出一个 `lookup` 工具调用，参数类型错误。
2. 控制器拒绝调用，把明确的校验错误作为 observation 写入历史。
3. 第二次模型输出 `{"key": "evaluation"}`，工具返回内置知识条目。
4. 第三次模型根据工具结果输出最终答案，循环结束。

末尾应显示：

```text
Success: True | Stop: final_answer | Model steps: 3 | Tool attempts: 2 | Simulated tokens: 175
```

`trace` 是运行记录。`model` 事件保留提议和估算 token；`tool_result` 事件保留执行结果或可恢复的校验错误；`budget_stop` 保留停止原因。调试时先定位最后一个失败事件，再向前查看模型究竟提交了什么参数。

### 改变预算，观察失败方式

```sh
python3 -B agent_loop.py --task quality --max-tool-calls 1
python3 -B agent_loop.py --task quality --max-steps 2
python3 -B agent_loop.py --task quality --max-tokens 50
python3 -B agent_loop.py --task quality --strategy direct
```

| 设置 | 预期结果 | 为什么 |
| --- | --- | --- |
| 最多 1 次工具尝试 | `tool_budget`，失败 | 第一次无效参数已经消耗一次尝试，不能无限免费重试 |
| 最多 2 步 | `step_budget`，失败 | 已获得知识，但还没有预算生成最终回答 |
| 最多 50 模拟 token | `token_budget`，失败 | 第一步消耗 34，第二步预计消耗 55，剩余预算不够 |
| `direct` | `final_answer`，但失败 | 返回了答案不代表答案正确；这个 fixture 的直接策略回答不知道 |

再把 `--max-steps` 或 `--max-tokens` 改成 `0`。预算为零时不应该产生成功回答或偷偷消耗 token。负数应直接显示参数错误并以非零退出码退出。

### 打开代码，沿着数据流阅读

先看 `TOOL_SCHEMA` 和 `lookup()`。工具只接受一个 `key` 字段，拒绝额外参数、错误类型和不在知识表中的值。`invoke_tool()` 只允许 `lookup`，没有文件写入、网络访问或 shell 工具。

再看 `scripted_model()`。这里的策略直接使用 fixture 提供的正确 key，目的是让控制流可复现。它没有推理出 key，也没有调用语言模型。两个任务故意制造第一次 schema 错误；错误 observation 出现后，固定策略提交正确参数。

最后看 `run_agent()`。它依次检查步数、token 和工具尝试次数，仅把 `ToolValidationError` 转成可恢复 observation。其他编程错误会向上抛出，避免把实现 bug 伪装成一次正常工具失败。

模拟 token 使用 `ceil(字符数 / 4)`，分别计算请求和模型输出，并重复计入每轮携带的 observation 历史。它不是任何厂商的 tokenizer。由于输出预先由脚本确定，实验能在接受一次模型步骤前预留完整成本；真实 API 需要输入估算、输出上限和返回 usage 配合核算，不能直接照搬这段预算实现。

### 验收与扩展

- 能从 trace 指出第一次失败的参数、错误消息以及修复后的参数。
- 能解释为什么 `final_answer` 和 `success` 是两个不同字段。
- 把校验暂时放宽，思考未知 key 应在什么位置失败，再恢复严格校验。
- 添加一个新的只读工具，例如两个正整数求和；为工具名、额外字段、错误类型和正确结果各写断言。不要通过 `eval()` 解析参数。
- 添加「连续两次校验失败后停止」规则，并保证它不会绕过总步数与总工具预算。

## 实验 2：提高成功率，代价是什么

运行同一个包含 8 个任务的固定 fixture 集：

```sh
python3 -B evaluate.py
```

预期输出中的结果：

```text
strategy  success     tokens  total units  units/success
direct    4/8 (50%)    269        0.269          0.067
tool      8/8 (100%)    917        0.917          0.115
```

两个策略收到相同任务和每个任务相同预算。成功判定为答案字符串与预期值完全一致，每个任务权重相同。`direct` 被设定为能回答前四个任务；`tool` 借助内置知识表回答所有任务。这组结果是人为构造的教学 fixture，不能推出「工具策略在真实任务上总是更好」。

指标计算如下：

```text
成功率 = 成功任务数 / 全部任务数
模拟成本 = 模拟 token 总数 / 1000 × 1 个虚构成本单位
每次成功成本 = 全部任务的模拟成本 / 成功任务数
```

每次成功成本的分子必须包含失败任务消耗的成本。默认 `tool` 多成功了四道题，也增加了模拟消耗；`direct` 每次成功成本更低，但会漏掉一半任务。先定义应用所需的最低成功率，再讨论成本是否合适，单独挑一个指标会产生误导。

### 做一个受控比较

```sh
python3 -B evaluate.py --max-steps 2
python3 -B evaluate.py --max-tool-calls 1
python3 -B evaluate.py --max-tokens 0
python3 -B evaluate.py --json
```

两步预算时，`tool` 只能完成 6/8；需要修复的两个任务来不及输出最终答案。零 token 预算时两个策略都为 0/8，每次成功成本显示 `N/A`，JSON 中为 `null`。没有成功样本时这个比值没有定义，不能报告为零成本成功。

`--json` 提供原始数值，控制台只把数值舍入到三位小数。保留原始数据后，可以画成功率与成本的图，避免从显示精度中推导结论。

### 验收与扩展

- 手算 `0.917 / 8`，解释为什么输出接近 `0.115`。
- 找到 `summarize()`，确认失败样本的消耗仍然计入总成本。
- 增加只做大小写、空白标准化的判定器，比较它与 exact match。明确你允许了哪些答案变化。
- 给 fixture 增加任务类型，按类型报告成功率，避免总体平均值掩盖薄弱环节。
- 设计第三种路由策略：对于已知能直接回答的任务使用 `direct`，其他使用 `tool`。然后思考真实场景中如何判断「已知」，避免路由器偷看标准答案。

## 实验 3：为什么连续批处理能更早填满空槽位

默认共有 6 个请求，它们都在 tick 0 到达，所需输出 token 依次为 `1, 8, 1, 8, 1, 8`，系统最多同时执行两个请求。每个活跃请求每 tick 生成一个 token。

```sh
python3 -B scheduler.py
python3 -B scheduler.py --trace
```

预期指标：

```text
mode        elapsed  tokens/tick  reqs/tick  mean latency  max latency
static           24        1.125      0.250        12.500           24
continuous       17        1.588      0.353         7.833           17
```

两种策略总共都生成 27 个 token。静态批处理每次接纳最多两个请求，等这一批全部完成后再接下一批。第一批的短请求在 tick 1 就结束了，但它空出的槽位要等长请求在 tick 8 结束后才能重新使用。

连续批处理也按先到先服务排队，但每个 tick 都会用等待请求填满空槽位。因此第三个请求在 tick 1 就能开始，第四个在 tick 2 开始。`--trace` 会显示每个 tick 的活跃请求，适合拿纸手画两条时间线。

不要把短请求的结束时间误记成整批结束时间。静态策略的第一个请求仍在 tick 1 完成；它的槽位随后空闲。这个区别会影响平均完成延迟的计算。

### 单位与统计范围

| 指标 | 定义 |
| --- | --- |
| elapsed | 从第一个请求到达到最后一个请求完成，包含期间空闲，单位 tick |
| tokens/tick | 所有输出 token 数 / elapsed |
| reqs/tick | 完成请求数 / elapsed |
| mean latency | 每个请求的「完成时间减到达时间」取平均，包含等待和生成 |
| max latency | 所有请求中最大的完成延迟，单位 tick |

tick 是抽象时间步，不是毫秒或秒。这里报告的是完成延迟，不是 TTFT。模型忽略 prefill、KV cache 容量、GPU 内存、带宽、不同 batch 大小的执行时间、调度开销和抢占；它只能解释填补空槽位的机制，不能估算真实 GPU 上的收益。

### 改变条件，检验直觉

```sh
python3 -B scheduler.py --capacity 1
python3 -B scheduler.py --lengths 4,4,4,4,4,4
python3 -B scheduler.py --lengths 1,8,1 --arrivals 0,0,3 --trace
python3 -B scheduler.py --lengths 1,1 --arrivals 4,10
```

只有一个槽位时，两种策略结果应一致。所有请求长度相同时，默认到达方式下连续批处理也没有优势。最后一例中两个请求各自只需 1 tick，但总时间范围是 `11 - 4 = 7` tick，中间空闲仍计入吞吐率的分母。

程序允许请求乱序输入，同一到达时间按输入顺序排队。请求长度必须为正整数，到达时间为非负整数，容量为正整数。这里没有模拟「零输出 token 的请求」，传入零长度会直接报错。

### 验收与扩展

- 手算默认静态策略吞吐 `27 / 24 = 1.125`，连续策略吞吐 `27 / 17 ≈ 1.588`。
- 指出连续策略中 `r3` 的开始与结束 tick，再从 trace 核对。
- 对每个请求统计它出现在 timeline 中的次数，应等于它的输出 token 数。
- 增加首 token 时间，计算 TTFT；明确到达在 tick `t`、该 tick 被接纳的请求首 token 在 `t + 1` 可见。
- 增加有代价的 prefill 阶段，然后重新定义每 tick 能做哪些工作。不要在没建模阶段成本时给 tick 任意换算成毫秒。

## 测试检查了什么

`test_labs.py` 包含 25 个测试，覆盖：

- schema 错误的显式观察和修复；工具调用白名单；无效调用也消耗预算。
- 零预算、精确 token 边界、非法配置，以及意外编程错误不会被吞掉。
- 固定成功率、失败成本计入总账、零成功与空任务集不会除零。
- 单 token 请求的结束时刻、静态短请求的独立完成、容量限制和 token 守恒。
- 延迟到达和中间空闲、相同长度无收益、单槽位两种策略相同。
- 三个脚本的 JSON 可解析，非法命令行输入返回非零状态。

修改实验后先运行测试，再看指标有没有变化。如果你有意改变了调度规则或 token 估算方法，应同步修改对应的预期值，并在实验记录里写出改变的假设。

## 留下一份自己的实验记录

每个实验记录四件事就够了：修改了哪个条件，修改前的预测，运行后的结果，预测与结果不同的原因。保留命令和 JSON 输出，其他人就能复现。

下一步可以回到学习平台的 Agent、评测、推理服务章节，把控制流换成真实 SDK，把模拟 usage 换成 API 返回值，把调度模型换成实际服务测试。每次替换一个层次，并保留原有的成功判定、日志和预算边界。
