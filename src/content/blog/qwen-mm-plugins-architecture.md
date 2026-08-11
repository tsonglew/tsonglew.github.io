---
title: '让 Agent 睁开眼 · Qwen-MM-Plugins 把多模态装进每个 harness'
description: 'Qwen 团队开源的多模态插件集,skill + MCP 双件套让任何 agent harness 原生看图像、视频、文档、3D。拆解 core 的动态分辨率读取、video-memory 的四层图记忆、驱动运行中 Blender/FreeCAD 的模式,以及打进所有 harness 插件市场的生态策略。'
publishDate: 2026-08-11
tags: [Agent, 多模态, 架构]
draft: false
---

![封面,让 Agent 睁开眼](../../assets/blog/qwen-mm-plugins/cover.jpg)

> 现在的 agent 有个共同盲区。它们能读文字、写代码、跑命令，但“看”这件事做得很勉强。给它一张图，得转成 base64 塞进上下文；给它一段视频，大多数 harness 直接摇头。Qwen 团队 2026 年 7 月底开源了 Qwen-MM-Plugins，目标是把多模态能力装进每一个 agent harness，让“看”变成任何 agent 的原生能力。

> 本文基于 [QwenLM/Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) main 分支源码撰写，仓库 2026-07-29 创建，一周多收获 1323 星（Apache-2.0）。文中事实均来自仓库 README、cookbook 和源码。

---

## 问题，agent 的眼睛是借来的

让 agent 处理多模态内容，现在的做法基本是三种，都有毛病。

第一种，把图片转成 base64 塞进模型上下文。模型能不能读取决于它训练时见过多少图像 token，大部分编码模型对图像的理解只到“能描述个大概”。视频更麻烦，得自己抽帧、自己决定抽多少帧，抽少了漏内容，抽多了上下文爆炸。

第二种，给 agent 装一个 OCR 工具。它解决了“图片里的字”，没解决“图片里的内容”。一张产品照片、一个 3D 模型、一段两小时的会议录像，OCR 帮不上忙。

第三种，直接换一个多模态模型。这是最彻底的，但用户被绑死在一个模型上，之前的代码、习惯、harness 全要跟着换。

Qwen-MM-Plugins 走的是第四条路。它不动模型，不动 harness，把多模态能力做成**插件**，装进任何已有的 agent 环境。装完以后，Claude Code 里的 agent 能读视频、Codex 里的 agent 能驱动 Blender、Qoder 里的 agent 能看 3D 模型。

## 解法，一个能力 = 一个 skill + 一个 MCP server

架构的逻辑一句话能讲完。**每个能力拆成两半，skill 负责让模型知道工具有什么，MCP server 负责真正干活**。

```plaintext
skill      = 大脑,告诉模型"你有这些工具,什么时候用哪个"
MCP server = 手,工具本体,由 uvx 按需启动
```

![章节图,skill+MCP 架构](../../assets/blog/qwen-mm-plugins/architecture.jpg)

skill 装进 harness 的插件系统，模型看到工具清单和路由规则。MCP server 是标准的 *Model Context Protocol* 服务，任何支持 MCP 的 harness 都能调用。两半都标准化，所以“一次安装，到处能跑”。

安装器 `install.sh` 覆盖了 7 个 harness\(Claude Code、Codex、Qoder、OpenClaw、Qwen Code、Gemini CLI\)，底层调各 harness 自己的插件市场，不重造一套安装体系。配置写进统一的 `~/.qwen-mm-plugins/config`，终端和 GUI 的 harness 读同一份文件。

这个设计对应一个正在发生的行业事实。harness 的插件标准正在收敛，Claude Code 有插件市场，Codex 有插件系统，MCP 是工具协议的事实标准。Qwen 选择站在所有标准之上，而不是再立一个。

## 七个能力，各管一块

仓库里 7 个能力，每个单独安装。

![章节图,多模态能力](../../assets/blog/qwen-mm-plugins/capabilities.jpg)

**core** 是地基，14 个 MCP 工具，管“看”的基本功。三个读取工具最有想法。

- `read_image`，动态分辨率读图。图片不缩放，按模型能处理的动态分辨率切块喂，细节不丢

- `read_video`，自动抽帧。按视频长度自动决定 FPS 和分辨率，不用人指定

- `visualize`，通用可视化。PDF、Office 文档、CSV、代码、SVG、DrawIO 图、3D 模型、GIS 数据、Notebook、LaTeX，十种格式一个工具打开

上面是原生读取，不需要 API key。另一组工具走 DashScope，视觉对话（vision_chat，默认 qwen3.7-plus）、OCR、grounding（物体定位，返回像素框）、分割（自托管 SAM3）、语音识别（transcribe_audio，默认 qwen3-asr，输出 SRT/文本/JSON）。再加一组 Serper 的联网搜索，web_search、网页提取、按图搜图。

其余六个能力。

| 能力 | 干什么 |
| --- | --- |
| **video-memory** | 长视频记忆，30 分钟以上的视频先建图记忆再问答 |
| **omni-av** | 音视频全模态理解，ASR 带时间戳和说话人、时间标注、事件计数、音乐标签 |
| **video-edit** | 视频编辑工作流，加图像/视频/音频生成 |
| **blender** | 驱动运行中的 Blender,22 个工具，建模/材质/灯光/渲染 |
| **freecad** | 驱动运行中的 FreeCAD,14 个工具，参数化建模、STEP/STL 导入导出、FEM 分析 |
| **edu-agent** | 纯 skill，把一道数学题或题目图片变成中文讲题视频和交互页面 |

## 装完能干什么，两个官方实测案例

官方 cookbook 里有两个完整的实测记录，比任何介绍都有说服力。

第一个是 Claude Code 里的完整 trace\[^1\]。agent 先读完一段宣传视频，然后打开一份 35 页的 PDF，按要求提取其中一张图。整个过程不用人指挥，模型自己选工具，先 read_video 看视频，再 visualize 打开 PDF，定位到目标页，把图提出来。

第二个是 Codex 里的交叉验证。给 agent 一张图片，让它定位图片里的蛋糕，给每个蛋糕画编号框，再通过 DashScope 的视觉模型识别这是在哪个地方，最后用联网搜索交叉验证这个地点。定位、识别、验证，三步都用不同工具。

这两个案例说明的是同一件事。装上之后，agent 处理多模态内容不再需要你告诉它怎么转格式、怎么抽帧，它自己会挑工具。原生读取工具（读图、读视频、开文档）不需要 API key，装上就能体验。

## 三分钟上手

装之前，先花十秒过一遍这张检查清单。

- [ ] 装好 uv\(MCP server 靠它拉起）

- [ ] 装好 ffmpeg（视频和音频处理用）

- [ ] 想要联网搜索或 DashScope 的视觉工具，准备好 `DASHSCOPE_API_KEY` 和 `SERPER_API_KEY`

- [ ] 只想体验原生读图、读视频、开文档，上面两个 key 都可以不要

然后按顺序走三步。

1. 安装。一行命令，覆盖 7 个 harness。

   ```bash
   curl -fsSL https://raw.githubusercontent.com/QwenLM/Qwen-MM-Plugins/main/install.sh | bash
   ```

   脚本处理 install、configure、verify、uninstall 四件事，底层调各 harness 自己的插件系统，配置写进统一的 `~/.qwen-mm-plugins/config`。

2. 手动装也行（以 Claude Code 为例），加市场再装能力，两条命令。

   ```bash
   claude plugin marketplace add https://github.com/QwenLM/Qwen-MM-Plugins.git
   claude plugin install qwen-mm-plugins-core@qwen-mm-plugins
   ```

3. 验证。跑 `bash install.sh verify`，脚本会检查密钥和缺失的系统工具，缺什么它告诉你。

三个实际体验里的细节值得先知道。

1. **安全建议来自第三方教程而不是官方**。先 clone 仓库、用 `less` 审一遍 install.sh 再执行。装第三方脚本前先看内容，这条建议对任何项目都成立。

2. **最省事的安装方式其实不用跑命令**。在支持插件的 GUI harness 里，直接对 agent 说“帮我装一下 Qwen-MM-Plugins 的 core 和 edu 插件”，它自己会走完市场添加和安装流程。

3. **依赖是自动的**。MCP server 由 uvx 按需拉起，首次调用时自动处理 Python 依赖，一般不用手动建虚拟环境。系统层面要准备两个，uv 和 ffmpeg，分别是 MCP 拉起器和视频/音频处理用的。可选的还有 libreoffice\(Office 文档可视化）、blender\(3D 渲染）、texlive\(LaTeX\)、chromium（网页截图）。Blender 和 FreeCAD 两个能力在设了 `QWEN_MM_AUTOLAUNCH=1` 之后，首次调用会自动拉起应用并下载，连手动开软件都省了。

按需只装你需要的能力就行，不需要 7 个全装。工具面越小，权限审查越省事。

## 最值得拆的一块，video-memory 的四层图记忆

长视频是 agent 最难啃的内容。一段 100 小时的录像，抽帧一次只能抽几千张，语义信息几乎全丢。video-memory 的做法是先给视频**建一套记忆**，再让 agent 在记忆上做问答。

![章节图,四层图记忆](../../assets/blog/qwen-mm-plugins/graph-memory.jpg)

记忆是四层树。

```plaintext
Root(整段视频一条:标题、主题、关键实体、情绪基调)
  └─ SuperEvent(10-20 条故事弧,高层叙事)
       └─ MacroEvent(每条弧 3-8 个事件段,每段约 3-8 分钟)
            └─ Subgraph(实体节点 + 事件节点 + OCR 文本 + 关系边)
```

最底层的 Subgraph 是真正的内容，实体节点分人、物体、地点，事件节点带时间戳，还有屏幕上出现的文字（OCR），以及五种关系边，语义、因果、时序、层级、空间、身份。

构建流程是离线的，分四步。

1. 抽帧。按视频长度决定采样密度，把视频切成帧序列

2. 分事件段。用模型把帧聚成 SuperEvent 和 MacroEvent 两层，每段约 3 到 8 分钟

3. 生成摘要。对每层调用模型生成标题、关键实体、事件描述，底层 Subgraph 里再抽取实体、事件和 OCR 文本

4. 落盘。输出一份 `<video_path>.memory/` 目录，里面是 `graph_memory.json` 和 `embeddings.npz`，建好一次，反复查询

查询侧是 9 个 MCP 工具，按使用场景设计。

- `get_summary`，视频级概览，回答“这个视频讲了什么”

- `get_super_events` / `get_macro_events` / `get_subgraph`，逐层下钻

- `search_by_time`，按时间找

- `search_asr_text` / `search_ocr_text`，按语音/字幕文字找

- `search_nodes`，按实体找

SKILL.md 里写了一条硬性的路由规则，值得原样转述。视频超过 30 分钟，必须用 video-memory 建记忆再查，read_video 抽的帧太少必然漏内容；在记忆里定位到具体片段之后，再用 read_video 带 start_time 和 end_time 做帧级精查，因为记忆是粗粒度的，可能不准。

这条规则把“粗记忆定位 + 精帧检查”的分工写死成了规范。agent 先靠图记忆找到大致位置，再放大看细节，两步配合，既省 token 又不丢内容。

## “驱动运行中的应用”这个模式

blender 和 freecad 两个能力走的是同一个模式。**thin client 驱动正在运行的实例**。agent 不生成一段代码让你自己跑，而是通过 22 个工具（Blender）或 14 个工具（FreeCAD）直接操作已经打开的应用。建模、调材质、打光、渲染，或者改参数化模型的尺寸、导入 STEP 文件、跑 FEM 分析，都在运行中的软件里实时发生。

这对“agent 干活”的形态是个有意思的补充。大多数 agent 工具是“给输入，拿输出”，这两个是“连上正在运行的软件，在里面操作”。做设计、改模型这类需要看到即时反馈的活，这种模式比生成代码自然得多。

## 生态策略和几个疑问

Qwen 这次的动作值得注意。它没有只服务自家 harness，而是把能力做进 Claude Code、Codex、OpenClaw 这些竞品的插件市场。效果是，任何一个在用主流 harness 的人，都能让自家 agent 获得 Qwen 的多模态能力，而能力背后连着 DashScope 的模型调用。这是把“能力”当入口的生态策略。

几个疑问也得摆出来。一周 1323 星是热度，验证还没有，这些能力在真实工作流里的表现还没有第三方评测。core 的一部分工具依赖 DashScope API key，离线场景只有原生读取那几个工具能用。还有，harness 的插件标准和 MCP 都在快速变化，今天支持 7 个 harness，明天插件市场改格式，维护成本会一直跟着。

---

参考资料

\[^1\]: 官方 core cookbook 提供了完整 trace 链接，含 Claude Code 中的逐操作记录，见参考资料第 2 条。

1. [QwenLM/Qwen-MM-Plugins 仓库](https://github.com/QwenLM/Qwen-MM-Plugins)

2. [cookbooks/core/usage.md（工具清单与用例）](https://github.com/QwenLM/Qwen-MM-Plugins/tree/main/cookbooks/core)

3. [video-memory 的 SKILL.md（路由规则与图记忆结构）](https://github.com/QwenLM/Qwen-MM-Plugins/blob/main/src/capabilities/video-memory/skill/SKILL.md)