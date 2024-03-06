---
author: Tsong Lew
pubDatetime: 2024-03-05T20:08:00.000+08:00
modDatetime: 2024-03-05T20:08:00.000+08:00
title: 系统设计步骤
slug: system-design-route
featured: false
draft: true
tags:
  - 系统设计
  - System Design
description: ""
---

## 常用工具

### 架构决策记录

> 通过架构决策记录（ADRs）是记录架构决策最有效的方法之一。

ADRs 由一个简短的文件文本组成，描述特定的架构决策。ADR 的格式如下：

* ADR：包含架构决策的简短名词短语。
* 用一个简短的一到两句话的问题描述问题，并列出备选解决方案。
* 说明架构决策并提供决策的详细理由。
* 描述决策应用后的任何后果，并讨论所考虑的权衡。

### 架构健康函数

> 架构健康函数（Architecture Health Metrics）是一组用于评估和量化软件架构健康状况的指标或函数。它们旨在提供对软件架构当前状态的洞察，帮助识别潜在的问题区域，以及指导架构的维护和改进决策。

我们可以通过**架构健康函数**来实现确保实现者遵守项目的**编码规范**

例如我们可以写一个适应性函数来避免代码中出现组件循环的情况：

```java
public class CycleTest {

    private JDepend jdepend;

    @BeforeEach
    void init() {
      jdepend = new JDepend();

      jdepend.addDirectory("/path/to/project/persistence/classes");
      jdepend.addDirectory("/path/to/project/web/classes");
      jdepend.addDirectory("/path/to/project/thirdpartyjars");
    }

    @Test
    void testAllPackages() {
      Collection packages = jdepend.analyze();
      assertEquals("Cycles exist", false,
      jdepend.containsCycles());
  }
}
```

架构健康函数和单元测试函数不太一样，它们是用来检查架构的健康状况，而不是检查代码的正确性。他们有这些区别：

| 特性       | 架构健康函数                                         | 单元测试函数                          |
|------------|---------------------------------------------------|-----------------------------------|
| **目标**     | 评估整个软件架构的健康状况                               | 验证代码最小单元的正确性与功能性             |
| **关注点**   | 软件架构的质量，包括代码质量、性能、安全性等                 | 具体代码逻辑的正确性                        |
| **范围**     | 整个系统的架构层面                                       | 单个函数或方法                           |
| **方法**     | 监控关键架构指标，数据分析                                 | 编写和执行测试用例，检查特定功能             |
| **执行频率** | 根据项目需求定期执行，可能不如单元测试频繁                     | 开发过程中频繁执行，通常随代码一起更新         |
| **输出**     | 架构状态的量化报告，包含潜在问题的指示                       | 通过或失败的测试结果，直接指出问题所在位置     |
