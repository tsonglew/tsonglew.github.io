---
title: '后端转全平台 03｜把页面排好，理解浏览器怎样布局'
description: '把慢读资料库从朴素的 HTML 排成可用页面。理解文档流、盒模型与级联，用 Grid 和 Flex 排版，再用窄屏、长网址和键盘操作检查结果。'
publishDate: 2026-09-23
tags: [后端转全平台, 前端, 教程]
series: backend-to-platform
seriesOrder: 3
---

上一讲的慢读已经有三条资料。标题可以点击，列表也能读，只是导航和正文挤在同一列。这一讲给它加上 CSS，让桌面上的导航留在左侧，资料放在右侧，窗口变窄后再排成一列。

- **本课成品**可以直接[打开慢读的 CSS 版本](/tutorials/backend-to-platform/03-css/index.html)，再和[上一讲的 HTML 版本](/tutorials/backend-to-platform/02-html/index.html)对照。
- **开始条件**是能看懂上一讲的 HTML，知道 `class` 用来给元素分组。准备一个编辑器和带开发者工具的浏览器即可。
- **示例文件**在[完整源码压缩包](/tutorials/backend-to-platform/source.zip)里。本课只涉及 `03-css/index.html` 和同目录的 `styles.css`。

练习时，从下载包的完整 `02-html/index.html` 复制一份到自己的 `03-css` 目录，再添加同目录的 `styles.css`。完整 HTML 包含下文使用的侧栏和 class，上一讲正文里的最小练习需要先补齐这些结构。下载包的 `03-css` 目录提供了成品，可以随时对照。

正文按实现顺序拆解关键规则，配色和导航等完整样式见源码。盒模型和级联的行为已经按 MDN 文档核对，遇到效果与预期不同的地方，我们会直接去开发者工具里找原因。

## 先看看浏览器已经排了什么

暂时移除 HTML 中下面这一行，页面就会回到上一讲的样子。恢复它后，浏览器会加载同目录的样式表。

```html title="index.html"
<link rel="stylesheet" href="./styles.css" />
```

没有这张样式表，浏览器仍然会排版。当前这种从左到右的横向书写里，`section`、`p` 等块级盒通常另起一行，默认宽度会占满可用空间；段落里的 `a`、`span` 等行内盒随着文字排列，空间不足便换行。这套默认排列叫正常文档流。

试着把一条资料的描述加长。后面的资料会自动往下移，文字互不覆盖。这是浏览器已经替我们处理好的行为。接下来让 CSS 改变列数和间距，同时保留内容增多后自然向下展开的能力。

`display` 可以改变盒的显示方式。元素原本的 HTML 含义还在，把 `a` 设为块级盒后，它仍然是链接，只是布局表现变了。普通行内盒上的 `width` 不会像块级盒那样生效，调宽度之前先在开发者工具里确认它的 `display`。

## 让宽度的账算得清

一张资料卡从里到外有内容区、内边距 `padding`、边框 `border`，外面还可以留 `margin`。在默认的 `content-box` 下，`width` 指内容区宽度。

假设临时给卡片设置下面的规则。

```css
.resource-card {
  box-sizing: content-box;
  width: 320px;
  padding: 24px;
  border: 1px solid;
}
```

它的边框外沿宽度是 `320 + 24 × 2 + 1 × 2 = 370px`。左右外边距若存在，还会继续占用周围空间。在 320px 宽的窗口里，这张卡片当然放不下。

先把实验中 `.resource-card` 的 `box-sizing: content-box` 改为 `box-sizing: border-box`，保留其余三条声明，观察盒模型图。现在卡片边框外沿宽 320px，内容区剩 270px，`margin` 仍在盒子外面。

看清这次变化后，删除实验中整条 `box-sizing` 声明。本课样式表通过下面的通配规则统一设置它。

```css title="styles.css"
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

此时显式设置的 `width` 包含内边距和边框。如果保留实验里的 `content-box`，class 选择器会优先于通配选择器生效，宽度仍是 370px。这也是一次可以在 Styles 面板里核实的规则冲突。[MDN 的盒模型说明](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Box_model)还展示了块级盒和行内盒的差别。

完成这个实验后，删掉临时设置的固定宽度，让资料卡跟着容器伸缩。真实内容的长度没有定数，卡片高度也由内容决定。

## 先定阅读宽度，再分左右两栏

页面拉满大显示器后，一行描述会变得很长。慢读给整体容器限制宽度，在两侧留下空白，并给正文设置行高。

```css title="styles.css"
body {
  margin: 0;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 1rem;
  line-height: 1.7;
}

.site-header,
.page-intro,
.app-layout,
.site-footer {
  width: min(72rem, calc(100% - 4rem));
  margin-inline: auto;
}
```

`rem` 相对于根元素的字号。默认根字号为 16px 时，`1.5rem` 等于 24px。无单位的 `line-height` 按元素自身字号计算，正文设为 `1.7`，标题可以另设行高。

`min()` 取两个值中较小的一个，整体宽度最多 72rem，同时给窗口两边各留 2rem。它在这里同时处理了最大宽度和两侧空间。另一种写法可以组合 `width` 和 `max-width`，效果取决于具体数值。`margin-inline` 把左右剩余空间平均分配，页面便居中了。

HTML 中已经有布局需要的关系。

```html
<main class="app-layout">
  <aside class="sidebar">
    <nav><!-- 资料库导航 --></nav>
  </aside>
  <section id="library" class="library">
    <!-- 标题与资料列表 -->
  </section>
</main>
```

给 `.app-layout` 设置 Grid，它的两个直接子元素便成为网格项。

```css title="styles.css"
.app-layout {
  display: grid;
  grid-template-columns: 14rem minmax(0, 1fr);
  gap: 3rem;
  align-items: start;
}

.sidebar,
.library,
.resource-content {
  min-width: 0;
}
```

第一列留给侧栏，宽度为 `14rem`。第二列占用扣除侧栏和列间距后的剩余空间。`1fr` 表示一份可分配空间，并不等于整个屏幕宽度。

这里把第二列写成 `minmax(0, 1fr)`，显式允许轨道缩小。单独写 `1fr` 带有自动最小值，某些很长的内容会影响最小宽度，导致列宽超出预期。`.library` 的 `min-width` 控制网格项自身，两处规则解决的是不同层次的尺寸约束。[MDN 的 minmax 参考](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/minmax)说明了最小值、最大值和剩余空间之间的关系。

先在宽窗口里看到两栏，再继续处理卡片。Grid 的规则写在共同父元素上，如果只给 `.sidebar` 加 `display: grid`，右边的资料区不会因此移到旁边。

## 局部的一排内容交给 Flex

每条资料仍然是 `ul.resource-list` 里的一个 `li.resource-card`，标题使用 `h3`。卡片用 Flex 把序号和 `.resource-content` 并排放置，内容区里的标题、描述继续按文档流往下排。标签和阅读状态这一行再用一个小的 Flex 容器。

```css title="styles.css"
.resource-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
```

Flex 管理各自容器的直接子元素。`.resource-meta` 安排标签组和状态，`.tags` 再安排组里的标签。`gap` 留出间隔，两个值分别指定行间距和列间距。标签太多时，`flex-wrap` 允许它们换到下一行。

本页用 Grid 描述整体两列，用 Flex 安排局部一排。两者可以嵌套。先看哪一层需要调整，再把布局规则放到那一层的父元素上，调试时就容易定位。

资料标题可能很长，网址甚至没有空格。容器缩小以后，文字本身也要能换行。

```css
body {
  overflow-wrap: anywhere;
}
```

`anywhere` 允许原本无法断开的长字符串在必要时换行，换行机会也参与最小内容宽度的计算。这个属性会继承，在 `body` 设置后，卡片文字也能使用它。`.resource-content` 自身还是 Flex 子项，前面的最小宽度规则让它可以缩小。别急着加横向裁剪，先确认文字是否还能完整阅读。[MDN 的 overflow-wrap 参考](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-wrap)给出了长单词和网址的具体行为。

现在再处理颜色和留白。成品卡片使用 `1.6rem` 内边距、1px 边框和浅色背景，标题字号比描述大。几种颜色统一写在 `:root` 的自定义属性中，像 `--card` 这样的名字通过 `var(--card)` 取值。调整一处定义，所有引用它的卡片会一起变化。先把字号层次和间距做清楚，三条资料就已经容易浏览了。

## 窗口变窄，就让导航回到上面

两栏总要给侧栏留出空间，继续缩小窗口，资料区会越来越挤。示例在 48rem 处切换成单列。

```css title="styles.css"
@media (max-width: 48rem) {
  .app-layout {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
```

`@media` 中的规则只有在条件满足时才参与计算。HTML 顺序没有改变，侧栏仍在资料区前面，窄屏上自然先显示导航，再显示资料。成品同时缩小外侧空白和卡片内边距，完整规则在样式表末尾。这个断点按当前内容选择，其他页面可以有不同数值。

上一讲的 `viewport` 声明也要保留。缺少它时，手机浏览器可能使用更宽的布局视口再缩放页面，窄屏效果会与桌面模拟器中的预期不同。

## 样式没生效时，先找实际获胜的规则

CSS 的选择器负责匹配元素，声明给属性指定值。同一个元素能同时匹配多条规则，浏览器通过级联决定采用哪一个值。

本课没有层、动画或 `!important`。在这些同来源的普通规则之间，先比较选择器优先级，相同时后出现的声明获胜。例如给资料区临时加上两条边框规则。

```css
#library {
  border: 2px solid tomato;
}
.library {
  border: 2px solid steelblue;
}
```

ID 选择器的优先级更高，边框会使用第一条的颜色。把第二条挪到文件末尾也不会改变结果。检查后删除实验规则，页面仍用 class 组织样式。

继承处理另一件事。父元素上的 `color`、字体等属性可以传给子元素，`padding` 和 `border` 通常不会继承。链接自身若已有颜色声明，便不会使用从父级继承来的颜色。改了 `body` 以后某些文字没变，先检查那些元素有没有自己的规则。[MDN 的冲突处理教程](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Handling_conflicts)把继承与级联分别讲清楚了。

在 Chrome 开发者工具里选中一个元素，**Styles** 能看到匹配规则和被划掉的声明，**Computed** 能查最终值。宽度不对时先看盒模型，列数不对时选中 `.app-layout`，到 **Layout** 打开 Grid 覆盖层。它会画出网格线，还能显示轨道尺寸，省去对着空白猜间距的过程。[Chrome 的 Grid 调试文档](https://developer.chrome.com/docs/devtools/css/grid)展示了这些开关。

## 用容易出问题的内容验收

打开开发者工具的设备模式，将视口调到 320px，再完成下面的操作。

1. 将一条资料标题改为很长的中英文混排标题，把网址作为可见文本加进描述。确认卡片能增高，整页没有横向滚动条，文字也没有被截掉。
2. 连续增加几个标签。标签应能换行，阅读状态不应压住它们。出错时先看 Flex 容器是否允许换行，再查子元素的最小宽度。
3. 按 Tab 依次移动焦点。链接要有清楚的焦点轮廓，Enter 能打开资料。示例用 `:focus-visible` 设置轮廓，不要为了截图好看把 `outline` 删掉。
4. 把窗口拉回宽屏，确认两栏恢复，再关掉 CSS 检查阅读顺序。关掉样式后仍应能找到导航和三条资料。

设备模式方便检查视口尺寸，不能替代真实手机。把页面放到手机浏览器上，再检查文字大小、点击范围和横竖屏切换。若某一步失败，记下视口宽度、出问题的元素，以及 Computed 中的实际值，从这三项开始排查。
