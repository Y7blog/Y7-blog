---
title: 33｜Chainlink Automation 是什么？让智能合约自动执行
published: 2026-11-09
pinned: false
draft: false
comment: true
description: 智能合约写好部署之后，不会自己动起来——没人调它，它就一直躺在那里。那动态 NFT 要怎么自己变脸、借贷协议要怎么按时清算、奖励要怎么定期发放？这篇讲 Chainlink Automation：它怎么用一个去中心化节点网络替你盯着链上状态，条件一到就自动帮你调合约；以及一个重要变化：Automation 正在退役，接替它的是 Chainlink Runtime Environment。
image: https://www.y7img.ccwu.cc/file/1795054228157_y7blog-web3-34-1600.png
tags: [Chainlink,Automation,智能合约,Upkeep,LINK]
category: Web3
slug: blog/y7blog-web3-34
series: "区块链百科"
seriesOrder: 1
---

想象一下这个场景：一张动态 NFT，能根据 BTC 价格变表情。但问题来了：**谁去调它？**

价格变了，NFT 不会自己知道。它只会躺在链上等着，等有人发一笔交易调它的更新函数。如果你每天手动调一次，它就每天变一次；你出差一周忘了调，它就一周不变。动态 NFT 变成了“手动 NFT”。

**智能合约就是这样：它不会自己动起来。** 没人调它，它就一直躺在那里。今天这篇就讲怎么解决这个问题：Chainlink Automation 是什么，它怎么替你盯着链上状态、条件一到就自动帮你执行；以及一个你必须先知道的重要变化。

> 💡 **先说清楚**：本文是知识科普，只讲 Automation 的原理和用法，不推荐你去买任何 Token，更不构成投资建议。Automation 正在退役（第一节就讲这件事），文里的注册流程是帮你理解原理用的，新项目请直接看第八节的 CRE。所有操作先在测试网练手，主网上的每一次执行都是真金白银。

---

## 一、先说一个重要变化：Automation 正在退役

写这篇之前先查了最新资料，发现一个必须先告诉你的变化：**Chainlink Automation 正在被接替，官方文档的 Automation 概览页已经打不开了**（2026-11-19 核对，docs.chain.link/chainlink-automation/overview 返回 404）。

官方迁移页（docs.chain.link/cre/reference/cla-migration-ts）顶部写得很明确：

- Chainlink Automation v1.x 已于 **2026 年 6 月 30 日**弃用；
- v2.1 已于 **2026 年 7 月 31 日**弃用；
- Automation 将于 **2027 年 6 月 2 日**全面下线，**测试网已经在 2026 年 6 月 2 日下线**；
- 接替者是 **Chainlink Runtime Environment（CRE）**，官方说法是 CRE 能做 Automation 能做的所有事，而且更多。

Automation 的应用页（automation.chain.link）顶部也挂着同样的横幅：“Chainlink Automation is being deprecated: Chainlink Runtime Environment (CRE) is its replacement”。

这对你意味着三件事：

1. **这篇讲的概念没有过时**。“触发条件 → 链下检查 → 链上执行”这个思路，CRE 原样继承了，换的只是执行层。学会 Automation，就等于学会了 CRE 的一半。
2. **测试网已经不能练 Automation 了**。测试网 2026 年 6 月 2 日就已下线，文里第六节的注册流程，是帮你理解“一个 Upkeep 是怎么被注册和执行的”，不要照着去测试网注册——注册入口可能已经不在了。
3. **新项目直接学 CRE**。第八节会讲 CRE 是什么、它和 Automation 怎么对应。如果你只是想先把概念搞懂，继续往下读；如果你已经要动手做项目，读完概念直接跳到第八节。

为什么一个好好的服务会被接替？简单说：Automation 只能做“定时执行这一件事”，而 CRE 把定时、读 API、跨链这些能力拼成了一个统一的工作流。Chainlink 把几个独立服务合成了一个更大的工具箱。这篇先把 Automation 讲透，下一篇动态 NFT + 自动执行，就会用 CRE 的方式来实现。

---

## 二、智能合约为什么不能自己动？

在讲 Automation 之前，先把根上的问题想明白：**智能合约为什么不能自己运行？**

### 链上没有“闹钟”

现实世界里，你可以给手机设一个闹钟，到点它自己响。智能合约没有这个功能。区块链的工作方式是这样的：

```
有人发交易 → 节点执行交易 → 状态改变 → 写进区块
没人发交易 → 什么都不发生
```

智能合约只会在两种情况下运行：有人直接调它，或者别的合约调它。它自己不会在某个时间点醒过来，也不会盯着某个条件、条件一到就自己执行。**它是一个完全被动的程序。**

### 为什么设计成这样？

这不是设计失误，是区块链的确定性要求（第 19 篇讲过）：同一个交易，在全世界所有节点上跑，必须得到完全相同的结果。如果合约能“到点自己执行”，每个节点对“到点了”的理解稍有不同，整个网络就对不上账了。所以区块链干脆规定：**只有交易能触发执行，没有交易就没有执行。**

### 那谁来发这笔交易？

这就有了三种选择：

| 办法 | 怎么做 | 问题 |
|---|---|---|
| 自己手动调 | 每天打开钱包，手动发交易 | 忘了就停了；半夜三点也要起来调 |
| 自己写个服务器脚本 | 租台服务器跑定时任务，到点发交易 | 服务器挂了就停了；私钥放服务器上有风险；你还得自己维护 |
| 交给去中心化网络 | 注册一个任务，让一群节点替你盯着、替你发交易 | 要付费；但不用自己维护服务器，也不用保管热钱包私钥 |

第三种办法，就是 Chainlink Automation。

**一句话记住：智能合约是被动的，只会等人来调；Automation 就是那个替你盯着、替你来调的去中心化网络。**

---

## 三、Automation 是什么？请一个去中心化的“值班员”

### 一个 Upkeep，就是一个“值班任务”

用 Automation，第一步是注册一个 **Upkeep**（可以理解成“值班任务”）。一个 Upkeep 包含这些信息：

- **目标合约地址**：你要自动执行的那个合约；
- **触发方式**：按时间、按条件还是按事件（第五节细讲）；
- **Gas 上限**：每次执行最多花多少 Gas；
- **资金**：往 Upkeep 里充 LINK，执行一次扣一次；
- **管理员地址**：谁能改这个 Upkeep、谁能取回剩下的钱。

注册完之后，Chainlink 的节点网络就开始替你值班了。它们每一到几秒就检查一次你的 Upkeep：条件到了吗？到了，就发交易执行；没到，就继续等。

### 不是一台服务器说了算

这里最容易误解的一点是：以为 Automation 就是 Chainlink 官方跑的一台定时服务器。不是。

Automation 背后是一个**去中心化预言机网络（DON）**，由很多独立的节点运营商组成。它们用 **OCR3 共识协议**（Data Feeds 用的也是同一套协议）来决定要不要执行：

```
每个节点各自模拟 checkUpkeep
        ↓
节点之间交换结果、达成共识
        ↓
共识说“该执行了”，才发交易上链
```

也就是说，**不是某一个节点说执行就执行，而是一组节点各自算了一遍、达成一致之后才执行**。单个节点挂了、作恶了，都影响不了你的任务。这正是它和“自己租台服务器跑脚本”的本质区别：你信任的不是某一台机器，而是一组节点达成的共识。

### Automation 都用在哪？

只要是“条件到了就要执行”的事，都能用 Automation：

- **动态 NFT 自动变脸**：第 30 篇的 NFT，价格变了就自动更新表情，不用手动调；
- **借贷协议自动清算**：某个仓位跌破清算线，自动触发清算，不用等人发现；
- **奖励定期发放**：每周一自动给质押用户发奖励；
- **抽奖自动开奖**：到了开奖时间，自动用 VRF 取随机数、开奖；
- **限价单自动执行**：价格到了你设的点位，自动帮你换仓；
- **DAO 定期执行**：每月自动执行一次国库拨款。

这些场景的共同点是：**执行时机不固定，或者执行时间在半夜，没人愿意手动守着。**

---

## 四、Upkeep 的两个函数：一个负责看，一个负责干

Automation 的核心设计，是把“判断要不要执行”和“真正去执行”拆成两个函数。理解了这一拆，就理解了 Automation 的一半。

### checkUpkeep：只看不动手

`checkUpkeep` 回答一个问题：**现在需不需要执行？**

它是一个 `view` 函数，只读链上状态、不改任何东西。Automation 节点每隔几秒就**在链下模拟调用**它一次，看看返回的是 `true` 还是 `false`。

因为它只在链下模拟、从不上链，所以**调用它不花 Gas**。你可以在里面做很复杂的计算——读好几个合约的状态、算一堆条件——都不用花钱。只有返回 `true` 的时候，才会真的上链执行。

它返回两个值：

- `upkeepNeeded`：布尔值，`true` 表示该执行了；
- `performData`：要传给执行函数的数据，比如“这次要更新的是第几号 NFT”。

### performUpkeep：真正干活

`checkUpkeep` 返回 `true` 之后，节点网络就会发一笔真正的链上交易，调用 `performUpkeep`，把 `performData` 传进去，执行你写好的逻辑。

这一步是**要上链、要花 Gas 的**，Gas 从你充进 Upkeep 的 LINK 余额里扣。

### 一个最简单的例子：自动加一的计数器

官方文档里的入门例子，是一个每过一段时间就自动加一的计数器：

```
contract Counter is AutomationCompatibleInterface {
    uint256 public counter;
    uint256 public lastTimeStamp;
    uint256 public interval;

    function checkUpkeep(
        bytes calldata /* checkData */
    ) external view override returns (bool upkeepNeeded, bytes memory performData) {
        upkeepNeeded = (block.timestamp - lastTimeStamp) > interval;
        return (upkeepNeeded, "");
    }

    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        if ((block.timestamp - lastTimeStamp) > interval) {
            lastTimeStamp = block.timestamp;
            counter = counter + 1;
        }
    }
}
```

这个例子里，`checkUpkeep` 只做一件事：看“距离上次加一，是不是已经过了 `interval` 秒”。过了，返回 `true`；没过，返回 `false`。`performUpkeep` 收到信号后，再检查一次时间，确认过了才把计数器加一。

### 为什么 performUpkeep 里要再检查一次？

注意看上面代码：`performUpkeep` 里又写了一遍时间判断。这不是多余的，这是个**安全习惯**。

`checkUpkeep` 是链下模拟的，从模拟到真正上链执行，中间隔了几个区块。链上状态可能已经变了——比如别人抢先调了一次，条件已经不满足了。如果 `performUpkeep` 不重新检查，就会白白执行一次，Gas 也白花了。**所以规矩是：`performUpkeep` 里永远先重新验证条件，再干活。** 这是最容易被新手漏掉的一步。

|  | checkUpkeep | performUpkeep |
|---|---|---|
| 在哪运行 | 链下模拟 | 链上真实执行 |
| 改不改状态 | 不改（view 函数） | 改 |
| 花不花 Gas | 不花 | 花，从 Upkeep 的 LINK 余额里扣 |
| 多久跑一次 | 节点每隔几秒模拟一次 | 只有 checkUpkeep 返回 true 时才跑 |
| 写什么逻辑 | 判断“要不要执行” | 重新验证条件，再执行具体操作 |

**一句话记住：`checkUpkeep` 是眼睛，只看不动手、不花钱；`performUpkeep` 是手，只有眼睛说“该动了”才动手，动手要花钱。**

---

## 五、三种触发方式：按时间、按条件、按事件

Automation 有三种触发方式，选哪种取决于你的任务是“到点就做”、“条件到了就做”，还是“某件事发生了就做”。

### 1. 按时间（Time-based）：最像闹钟

你写一个 CRON 表达式，比如 `0 9 * * *` 表示每天早上 9 点，或者 `*/5 * * * *` 表示每 5 分钟一次，网络就按这个时间表执行。

按时间的 Upkeep **不需要写 `checkUpkeep`**，你只要告诉它目标合约、目标函数和时间表就行。这是最简单的一种，适合奖励发放、定期结算这种纯定时的任务。

### 2. 按条件（Custom Logic）：最灵活

就是上一节讲的 `checkUpkeep` + `performUpkeep` 这一对。条件完全由你自己写：价格跌破某个值、人数凑够了、时间过了、余额不足了……只要是链上能读到的状态，都能写进条件里。

这是最常用的一种，因为它能处理“时间不固定”的任务——你不知道价格什么时候跌破，只知道跌破了就要执行。

### 3. 按事件（Log Trigger）：等某个日志出现

链上每发生一件事，合约就会发出一个**事件日志（Log）**。按事件的 Upkeep 就是盯着某个特定事件：这个事件一出现，就触发执行。

比如一个交易合约，每次有人下单就发出一个 `OrderPlaced` 事件，你可以注册一个 Log Trigger Upkeep：`OrderPlaced` 一出现，就自动去取最新价格、做结算。它不用每个区块都去检查条件，只在事件出现时才动，效率更高。而且官方文档说明，Log Trigger 对**链重组（reorg）**有防护：临时被重组掉的日志，不会造成误执行。

三种方式的对照：

|  | 按时间 | 按条件 | 按事件 |
|---|---|---|---|
| 触发依据 | CRON 时间表 | 你写的 checkUpkeep 条件 | 某个合约事件被发出 |
| 要不要写 checkUpkeep | 不用 | 要 | 不用，改写 checkLog |
| 适合场景 | 定期发奖励、定期结算 | 价格到了就执行、人凑够了就开奖 | 有人下单就结算、有存款就自动复投 |
| 节点怎么工作 | 到点就执行 | 每隔几秒模拟检查 | 盯着事件日志，出现了才动 |

**选哪种，看你的任务是被什么驱动的**：被时间驱动，选按时间；被链上状态驱动，选按条件；被某个事件驱动，选按事件。三种方式在 CRE 里都有对应的触发器（第八节），思路是通的。

---

## 六、注册、费用和余额：钱是怎么算的？

### 注册一个 Upkeep 要填什么？

以前在 Automation 应用（automation.chain.link）上注册，大概要填这些：

1. 选触发方式：按时间、按条件还是按事件；
2. 填目标合约地址；
3. 起个 Upkeep 名字，填管理员地址；
4. 设 Gas 上限（`performUpkeep` 一次最多花多少 Gas，入门例子里常用 500,000）；
5. 充一笔起始资金，比如 0.1 LINK。

注册完之后，你的 Upkeep 会得到一个唯一的 **Upkeep ID**，还会分到一个专属的 **Forwarder 合约**（第七节讲它有什么用）。

### 费用由三部分组成

官方计费文档（automation-economics）写得很清楚，执行一次的费用包括：

- **Gas 费本身**：`performUpkeep` 真正花掉的 Gas，按当时的 Gas 价格算；
- **节点运营商提成（premium）**：按 Gas 费的一定比例收，不同链比例不同，具体数字去 Supported Networks 页面查；
- **固定 Gas 开销（gasOverhead）**：节点调注册表合约本身要花的 Gas，固定是 80,000。

官方给了一个 Polygon 主网的例子：一次执行用了 110,051 Gas，当时 premium 是 70%，最后从 Upkeep 余额里扣了 0.008077 LINK。注册本身不收费，链下的 `checkUpkeep` 模拟也不收费——**只有真正上链执行的那一下才花钱。**

### 余额不足，任务就停了

每个 Upkeep 都有一个**最低余额**。余额低于最低余额，网络就不再执行你的任务——哪怕条件到了也不会动。

最低余额是按“Gas 价格突然暴涨时，执行一次要多少钱”来估算的。官方建议：**余额平时保持在最低余额的 3 到 5 倍**，留出暴涨的余量。余额不够了就去应用里充值，或者直接调注册表合约的 `addFunds`。

### 取回余额要先取消

想把剩下的 LINK 拿回来，要先**取消 Upkeep**，等一段延迟（不同链的区块数不同）之后才能取。还有一条容易忽略的规则：如果你的 Upkeep 整个生命周期里累计花的手续费不到 0.1 LINK，取消时要收 0.1 LINK 的费用。

---

## 七、最容易踩的坑

### 1. performUpkeep 谁都能调——除非你限制它

这是**最容易出现的问题**。`performUpkeep` 是一个公开函数，默认情况下任何人都能调它。如果你的合约里没有限制，别人可以直接调你的 `performUpkeep`，替你执行、或者在错误的时间执行。

解决办法是 **Forwarder**：每个 Upkeep 注册后，Automation 网络会给它部署一个专属的 Forwarder 合约。节点执行你的任务时，都是通过这个 Forwarder 来调你的合约。所以你在 `performUpkeep` 里应该检查：`msg.sender` 是不是我的 Forwarder 地址？不是，就拒绝。

```
只有 Forwarder 能调 performUpkeep，其他人调了直接失败
```

注册之后，Forwarder 地址可以在 Automation 应用里查到，也可以用注册表的 `getForwarder(upkeepID)` 查。注意：**按时间的 Upkeep 不用 Forwarder 地址**，要用应用里显示的 Upkeep 地址——这是官方文档特别提醒的一点，别搞混了。

### 2. checkUpkeep 里别写太重的东西

`checkUpkeep` 虽然不花 Gas，但它每次模拟都有计算量上限。里面别放循环套循环的复杂计算，也别读一堆用不上的状态。**判断条件要尽量轻**，重的计算留到 `performUpkeep` 里，或者干脆换个写法。

### 3. performUpkeep 里不重新验证条件

第四节讲过：从模拟到上链执行隔了几个区块，条件可能已经变了。`performUpkeep` 开头先重新判断一次，不满足就直接返回。漏了这一步，轻则白花 Gas，重则在错误的状态下执行了不该执行的操作。

### 4. 余额只充了最低标准，Gas 一涨就停了

Gas 价格暴涨的时候，一次执行的费用可能翻几倍。余额刚好卡在最低线上，涨一次价任务就停了。按官方建议，**平时保持 3 到 5 倍最低余额**，别等停了才想起来充。

### 5. 把 Automation 当成“保证准时”的闹钟

Automation 的执行是“条件到了就尽快执行”，不是“分秒不差”。节点要模拟、要共识、要排队上链，执行时间会有几秒到几十秒的延迟。**需要精确到秒的场景（比如某个区块必须执行），不要用 Automation**，那不是它设计来解决的问题。

---

## 八、接替者 CRE：同一个思路，更大的工具箱

第一节说了，Automation 正在被 **Chainlink Runtime Environment（CRE）** 接替。这一节讲 CRE 是什么，以及它和 Automation 怎么对应——因为下一篇就要用它了。

### CRE 里没有 Upkeep，有 Workflow

在 CRE 里，执行的单位叫 **Workflow（工作流）**：一个用 TypeScript 或 Go 写的项目，编译成 WebAssembly，注册到网络上。

一个 Workflow 的结构，和 Automation 的思路是一一对应的：

```
触发器（Cron / HTTP 请求 / 链上日志事件）
        ↓
链下逻辑（写在 Workflow 的处理函数里，代替 checkUpkeep）
        ↓
节点网络达成共识，生成签名的报告
        ↓
报告通过 KeystoneForwarder 写上链
        ↓
你的合约（实现 IReceiver 接口）收到报告，执行操作
```

### 触发器直接对应 Automation 的三种方式

| Automation | CRE |
|---|---|
| 按时间的 Upkeep | 内置 Cron 触发器（标准 5 或 6 段 CRON 表达式，最小间隔 30 秒，前面加 `TZ=` 可以指定时区） |
| 按事件的 Upkeep | EVM Log 触发器（DON 盯着事件，事件一出现就触发处理函数） |
| 按条件的 Upkeep | Cron 触发器 + 在处理函数里调 `evmClient.callContract()` 读链上状态、判断条件 |
| Upkeep 合约（checkUpkeep / performUpkeep） | 目标合约 + 一个 IReceiver 桥接合约 |
| 充 LINK 到 Upkeep | Workflow 的计费方式（具体看 CRE 文档） |

### 迁移不用重写合约

官方给了一个 **Automation Migration（自动化迁移）模板**，用的是“桥接”思路：部署一个通用的 `AutomationReceiver.sol` 合约，它接收 CRE 的报告，再把调用转发给你原来的 Automation 合约。你的原合约基本不用改，只有一处可能要动：**如果你的合约检查了 `msg.sender` 是不是 Automation 的 Forwarder，现在要改成允许新的 `AutomationReceiver` 地址。**

迁移模板可以用 CRE 的命令行工具直接生成：

```
cre init --template=automation-migration-go --project-name my-automation-migration --workflow-name my-workflow
```

也有 TypeScript 版本（automation-migration-ts）。官方的迁移指南一共五步：生成项目 → 部署桥接合约 → 授权调用 → 模拟、部署工作流 → 取消旧 Upkeep、取回 LINK。

### 顺带一提：Functions 也在往 CRE 迁

不只是 Automation，Chainlink Functions 也在迁移到 CRE，主网已于 2026 年 6 月 30 日关闭，测试网更早（2026 年 6 月 15 日）。到第 45 篇讲 Functions 的时候，会再细讲它的迁移方式。这里先记住结论就行：**CRE 是 Chainlink 现在主推的统一执行层，Automation 和 Functions 都是它的前身。**

---

## 总结

- **智能合约不会自己动**：链上没有闹钟，只有交易能触发执行。没人调它，它就一直躺在那里。
- **Automation 就是替你值班的去中心化网络**：注册一个 Upkeep，节点网络每隔几秒检查一次，条件到了就发交易帮你执行；决定执行之前，节点之间要先达成共识，不是某一台服务器说了算。
- **两个函数分工明确**：`checkUpkeep` 只看不动手、在链下模拟、不花 Gas；`performUpkeep` 真正上链执行，要花 Gas，所以开头要先重新验证条件。
- **三种触发方式**：按时间（CRON 时间表）、按条件（自己写 checkUpkeep）、按事件（盯着某个合约日志）。被什么驱动，就选哪种。
- **费用只在执行时产生**：Gas 费 + 节点提成 + 固定 80,000 Gas 开销，从 Upkeep 的 LINK 余额里扣；余额低于最低余额任务就停了，平时保持 3 到 5 倍；取回余额要先取消 Upkeep。
- **最容易踩的坑**：`performUpkeep` 要用 Forwarder 地址限制调用者；`performUpkeep` 开头要重新验证条件；别把 Automation 当成分秒不差的闹钟。
- **一个重要变化**：Automation v1.x 和 v2.1 已经弃用，2027 年 6 月 2 日全面下线，测试网已下线；接替者是 CRE，概念和思路原样继承，执行层换成了 Workflow。下一篇就用 CRE 的方式，让动态 NFT 自己变脸。

---

## 下一篇是第 34 篇：

[[y7blog-web3-35]]

第 30 篇我们讲了动态 NFT 能变，34 篇要把“变”这件事真正自动起来：NFT 怎么根据 BTC 价格自己换表情，谁来触发这个变化。按本篇的结论，实现方式会走 CRE 工作流：Cron 触发器定时检查价格，条件到了就写上链，NFT 自己换上新的表情。

*参考资料：Chainlink 官方文档《Migrate from Chainlink Automation to Chainlink CRE》（docs.chain.link/cre/reference/cla-migration-ts，2026-11-19 核对；Automation v1.x 2026-06-30 弃用、v2.1 2026-07-31 弃用、2027-06-02 全面下线、测试网 2026-06-02 已下线；CRE 为接替者，Workflow 由 TypeScript/Go 编译为 WebAssembly，触发器为 Cron/HTTP/链上日志；迁移模板 automation-migration-go/ts，桥接合约 AutomationReceiver.sol）；Chainlink Automation 应用页（automation.chain.link，2026-11-19 核对，顶部弃用横幅与迁移链接）；Chainlink 官方文档《Automation Billing and Costs》（docs.chain.link/chainlink-automation/overview/automation-economics，2026-11-19 核对；费用 = Gas + 节点提成 + 80,000 固定开销，注册免费、链下模拟免费，最低余额机制，取消后取回，生命周期手续费不足 0.1 LINK 收 0.1 LINK）；Chainlink 官方文档《Create Automation-Compatible Contracts》（docs.chain.link，2026-11-19 核对；AutomationCompatibleInterface、checkUpkeep/performUpkeep、ILogAutomation、时间触发无需接口）；Chainlink 官方文档《Secure Upkeeps Using the Forwarder》（docs.chain.link/chainlink-automation/guides/forwarder，2026-11-19 核对；每个 Upkeep 有专属 Forwarder，performUpkeep 应只接受 Forwarder 调用，时间型 Upkeep 用 Upkeep 地址）；Chainlink 官方文档《Managing Upkeeps》（docs.chain.link，2026-11-19 核对；余额保持最低余额 3–5 倍，addFunds/cancelUpkeep）；DEV Community《Chainlink Automation Isn't a Cron Job. It's a Consensus Decision》（dev.to，2026-07-03；OCR3 共识流程，三种触发器，2025-12-11 时间型 Upkeep 的 Forwarder 限制更新）；HackerNoon《Automating Smart Contract Tasks: Using Keepers and Relayers to Schedule Transactions》（hackernoon.com；Keepers/Automation 与 Gelato 对比，checkUpkeep/performUpkeep 示例，CRON 表达式用法）；Chainlink Bootcamp 2024 课程大纲（chain.link/bootcamps/smart-contract-developer-bootcamp-2024；含“NFTs and Chainlink Automation”一课）；Chainlink 官方文档《Migrate from Chainlink Functions to Chainlink CRE》（docs.chain.link/cre/reference/clf-migration-go，2026-11-19 核对；Functions 主网 2026-06-30 关闭、测试网 2026-06-15 关闭，CRE 为接替者）。*
