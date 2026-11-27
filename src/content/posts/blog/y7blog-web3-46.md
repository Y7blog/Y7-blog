---
title: 45｜CRE 是什么？Chainlink 把链下计算统一收进一个运行时
published: 2026-11-21
pinned: false
draft: false
comment: true
description: Chainlink Functions 主网已经关闭，Automation 也在退役，接替它们的是同一个东西：Chainlink Runtime Environment（CRE）。这篇讲清楚 CRE 到底是什么：一个工作流是怎么从触发器跑到链上的，触发器、回调、能力、DON 共识这些新词各自管什么，以及从 Functions 搬过来要改哪些地方。
image: https://www.y7img.ccwu.cc/file/1795572356860_y7blog-web3-46-1600.png
tags: [Chainlink, CRE, 智能合约, API, Web3]
category: Web3
slug: blog/y7blog-web3-46
series: "区块链百科"
seriesOrder: 1
---

想象一下，你写了一个智能合约：每天早上 8 点，自动去查今天的天气，如果下雨，就给某个 NFT 换上一件雨衣。

这个需求听起来很普通，但在区块链上，它其实是三件难事拼在一起：合约要**定时**做一件事，要**访问互联网**查天气，还要把查到的结果**可信地写回链上**。过去 Chainlink 用两个产品分别解决这两件事：Automation 管定时，Functions 管访问互联网。现在，两个产品都退役了，接替它们的是同一个东西：**Chainlink Runtime Environment，简称 CRE**。

这篇就讲清楚 CRE 到底是什么：它怎么把定时、调 API、写回链上收进一个工作流，以及如果你以前学过 Functions，搬到 CRE 要改哪些地方。

> 💡 **先说清楚**：这篇是知识科普，不是投资建议。CRE 是 2025 年 11 月才正式上线的平台，文档和工具链还在演进，本文按 2026 年 11 月 25 日核对的官方文档写；如果你照着动手，遇到和本文不一致的地方，以官方文档为准，先在测试网练手。

---

## 一、为什么智能合约需要一个“运行时”

智能合约有个天生的限制：第 19 篇讲过，区块链要求所有节点算出完全相同的结果，所以合约自己不能上网、不能看时间、不能随机应变。它只能被动地等别人来调用它。

但现实世界的需求不是这样的。一个真实的 dApp 经常需要：

- **定时做事**：每天结算一次、每周发一次奖励、到期自动执行；
- **访问互联网**：查天气、查价格、读新闻、调某个 API；
- **跨链办事**：在 A 链上收到信号，到 B 链上执行操作；
- **算点复杂的东西**：链上算太贵，拿到链下算完再把结果送回来。

这些事有一个共同点：它们都发生在**链下**，但结果要**可信地回到链上**。谁来干这个活，谁来保证干活的人没有撒谎，这就是 Chainlink 整个平台在解决的问题。

过去的解法是“一件事一个产品”：Data Feeds 负责喂价格，VRF 负责随机数，Automation 负责定时，Functions 负责调 API，CCIP 负责跨链。每个产品各有一套概念、各自的合约、各自的计费方式。学一个还好，几个拼起来做一个完整应用，脑子里要同时装好几套东西。

CRE 的思路是反过来的：**不再按产品拆分，而是给你一个统一的运行时**。你写一个“工作流”，把“什么时候触发、去调哪个 API、结果怎么写回链上”写在一起，CRE 负责在去中心化网络上把它跑起来，并对每一步的结果做共识验证。

简单来说：以前是五个工具箱，现在是一个工作台。

## 二、Functions 和 Automation 去哪了

在讲 CRE 之前，先把一件重要的事说清楚：**Chainlink Functions 和 Automation 都已经退役了**。如果你在网上搜到 2025 年甚至 2026 年上半年的教程，照着写很可能跑不通——不是你的问题，是教程过时了。

退役时间线是这样的：

| 产品 | 测试网 | 主网 |
|---|---|---|
| Chainlink Functions | 2026-06-15 停用 | 2026-06-30 关闭 |
| Chainlink Automation v1.x | 2026-06-24 停用 | 2026-06-30 弃用 |
| Chainlink Automation v2.1 | 2026-06-24 停用 | 2026-07-31 弃用 |

官方文档的说法很直接：CRE 是两者的接替者，Functions 能做的事，CRE 都能做，而且更多。原来需要 Functions + Automation + 一个链下中继服务才能拼出来的多步骤流程，在 CRE 里可以收进**一个工作流**。

这也是这个系列 45–51 篇要改题的原因：选题库里写的还是 Functions，但按最新情况，继续教 Functions 等于教一个已经关闭的服务。所以从这篇起，第八阶段按 CRE 来写：概念、实战、工具、计费、消费端合约、天气和新闻两个案例，骨架不变，换的是里面的写法。

如果你手头有正在跑的 Functions 订阅，官方给了一份迁移指南。核心变化只有一句话：**以前是合约主动发请求，现在是工作流被触发后执行，最后把结果写回合约**。具体怎么改，46–49 篇会一步步讲。

## 三、CRE 到底是什么

官方给 CRE 的定义是：**一体化编排层（all-in-one orchestration layer）**，让智能合约可以连接数据、合规、隐私，并且跨链、跨现有系统工作。

这句话里有两个词值得拆开：

- **编排（orchestration）**：不是只干一件事，而是把“触发、调 API、算一算、写回链上”这一串步骤排好、协调好，让它们按顺序跑起来；
- **一体化（all-in-one）**：定时、调 API、读写链这些能力，都在同一个地方提供，不用再拼好几个产品。

CRE 里最核心的概念是**工作流（Workflow）**。一个工作流就是一段用 Go 或者 TypeScript 写的代码，编译成 WebAssembly（WASM）之后，部署到 Chainlink 的去中心化预言机网络（DON）上运行。

工作流内部是三个零件拼成的：

| 零件 | 是什么 | 回答的问题 |
|---|---|---|
| 触发器（Trigger） | 启动一次执行的事件源 | 什么时候跑？ |
| 回调（Callback） | 触发后要执行的业务逻辑 | 跑起来干什么？ |
| 处理器（Handler） | 把一个触发器和一个回调连起来 | 谁触发谁？ |

一个工作流里可以有多个处理器，同一个回调也可以挂在多个触发器上复用。触发器一响，对应的回调就开始执行；每次执行都是独立、无状态的——跑完就结束，不留中间状态，下次触发再从头跑。

打个比方：触发器是闹钟，回调是闹钟响了之后你要做的事，处理器就是把闹钟和待办事项写在同一张纸条上。CRE 就是那个保证闹钟准时响、事情有人办、办完的结果大家都认账的管家。

## 四、一个工作流是怎么跑起来的

一个工作流从触发到结果上链，大概要走五步：

```
触发器响了（定时 / HTTP 请求 / 链上事件）
        ↓
Workflow DON 接到信号，开始协调这次执行
        ↓
回调开始跑，调用一个或多个“能力”
        ↓
每个能力由专门的 Capability DON 执行，
多个节点各自独立做同一件事，再用 BFT 共识
对出一个大家都认可的结果
        ↓
回调拿到可信的结果，生成一份 DON 签名的报告，
写回你的合约
```

这里面有两个地方是新手最容易晕的，单独说一下。

**第一，Workflow DON 和 Capability DON 是两拨人。**

Workflow DON 负责编排：盯着触发器、协调执行顺序、汇总结果。它自己不调 API、不读写链。

真正干活的是 Capability DON：调 API 的是一拨节点，读链的是一拨，写链的又是一拨。每个能力背后都有自己独立的节点网络，专门为这件事优化过。你作为开发者不用直接跟这些网络打交道，通过 SDK 里提供的客户端调用就行，比如调 API 用 HTTP 客户端，读写 EVM 链用 EVM 客户端。

**第二，共识不是只在最后做一次，而是每一步都有。**

调用一个能力时，网络里的多个节点会各自独立执行同一个操作——各自去调一次 API、各自去读一次链，然后把结果拿出来对账，用拜占庭容错（BFT）共识协议聚合成一个结果。这个结果错不了单个节点说了算，某个节点撒谎或者掉线，不影响最终结果。

也就是说，CRE 把区块链上“多个节点互相验证”的思路，从链上延伸到了链下：API 的返回、链上的读取、计算的结果，每一步都要先对出一个大家都认可的版本，才能继续往下走。

最后写回链上那一步也有讲究。工作流不会直接拿着私钥去调你的合约，而是生成一份**DON 签名的报告（Report）**，再通过 Keystone Forwarder 提交给你的消费端合约。合约收到报告后验证签名，确认这份结果确实是 DON 共识出来的，才接受它。消费端合约要实现 `IReceiver` 接口，一般是继承官方提供的 `ReceiverTemplate` 模板。

## 五、CRE 现在能调用哪些能力

能力（Capability）是 CRE 里最小的服务单位：一个能力只干一件事，干好一件事。目前官方文档列出的能力有这几类：

| 能力 | 干什么 | 什么时候用 |
|---|---|---|
| HTTP | 调外部 API、发 POST 请求，结果带共识 | 查天气、读新闻、调任何公开 API |
| Confidential HTTP | 在可信执行环境（TEE）里调 API，密钥不落地、返回可加密 | 调需要密钥的私有 API，又不想让节点运营方看到密钥 |
| EVM 读 / 写 | 读 EVM 链上的合约状态、把结果写回 EVM 链 | 查余额、读事件、更新合约状态 |
| Solana 读 / 写 | 读 Solana 账户和程序状态、把结果写回 Solana 程序 | 在 Solana 上做同样的事 |

除此之外还有**触发器**本身也是能力的一种，CRE 目前支持四种触发方式：

| 触发器 | 触发条件 | 例子 |
|---|---|---|
| Cron | 按时间表定时触发，最短间隔 30 秒 | 每天 8 点查一次天气 |
| HTTP | 外部系统发一个请求过来 | 你的后端服务主动推一次 |
| EVM Log | 某条 EVM 链上的合约发出了指定事件 | 有人 Mint 了 NFT，触发后续流程 |
| Solana Log | Solana 程序发出了指定事件 | 同上，在 Solana 上 |

注意一个细节：Cron 触发器最短 30 秒一次，不是想多快就多快；HTTP 触发器部署后需要授权密钥，不是随便谁都能调。这些限制写进设计里是有原因的：去中心化网络跑一次执行是有成本的，太频繁的触发既贵又没必要。

还有一点：CRE 支持的链比 Functions 更多。官方迁移指南说，Functions 支持的链里，除了 Soneium（主网和 Minato 测试网）和 Celo Alfajores 测试网之外，CRE 全都支持，另外还有一长串 Functions 从没支持过的网络。具体支持哪些链，写代码之前去官方的支持网络页面核对一次，不要凭记忆写。

## 六、CRE 和 Functions 对照表

如果你以前学过 Functions，这张表能帮你最快地把旧知识搬过来：

|  | Chainlink Functions（已退役） | Chainlink CRE |
|---|---|---|
| 执行单位 | 一次请求：合约调 `sendRequest()` | 一个工作流：触发器 → 回调 |
| 写逻辑的语言 | 内联 JavaScript 字符串 | Go 或 TypeScript 完整工程 |
| 触发方式 | 合约主动发请求 | Cron / HTTP / 链上事件触发 |
| 定时 | 要另接 Automation | 内置 Cron 触发器 |
| 结果怎么回链上 | DON 调消费合约的 `fulfillRequest()` 回调 | 工作流生成签名报告，写给实现 `IReceiver` 的合约 |
| 订阅 / 计费 | Functions Subscription，充 LINK | 计费方式见 48 篇，订阅概念已变 |
| 密钥管理 | DON 托管密钥 | 密钥存在 Vault DON 里管理，**旧的 DON 托管密钥导不出来，迁移要重新注册** |
| 本地调试 | Functions Playground | `cre workflow simulate` 本地模拟 |

最容易踩的坑是第二行和第七行：

- **Functions 的逻辑是写在合约里的一段 JavaScript 字符串**，CRE 的逻辑是一个独立的 Go 或 TypeScript 工程，编译成 WASM 再部署。不是改几行配置就能搬过去的，是换一种写法。
- **旧的 DON 托管密钥不能导出**。迁移的时候，密钥必须用 `cre` CLI 重新注册一遍。这一点官方迁移指南里专门标了 Important，别等到迁移当天才发现密钥拿不出来。

## 七、从零开始：四步跑起第一个工作流

CRE 的上手路径，官方分得很清楚：**模拟不需要审批，部署才需要**。也就是说，你今天就可以在自己电脑上把工作流跑起来，不用等任何人批准。

### 第 1 步：注册账号

到 Chainlink 平台（app.chain.link/cre/discover）创建一个账号。这是所有 CLI 命令的前提。

### 第 2 步：装 CLI

装 `cre` 命令行工具。TypeScript 路线还需要 Bun 1.2.21 或更高版本（用 `bun --version` 检查）。Windows 上官方推荐的版本在写稿时是 v1.40.0，不过版本号会变，装的时候以官方安装页为准。

装好之后先登录并确认身份：

```
cre login
cre whoami
```

### 第 3 步：初始化一个项目

```
cre init
```

这是一个交互式向导，会问你项目名、用什么模板、第一个工作流叫什么名字。选 `Helloworld` 模板就能拿到一个最小可跑的工作流。生成的东西包括：工作流代码、一个 `workflow.yaml` 配置文件，里面可以配不同的目标环境，比如本地模拟用的 `staging-settings`。

### 第 4 步：本地模拟

```
cre workflow simulate my-calculator-workflow --target staging-settings
```

模拟会把工作流编译成 WASM，在你自己的机器上跑，但**调的是真实的 API、读的是真实的公链**。这意味着模拟结果是可信的：本地跑通了，部署到 DON 上大概率也能跑通。

模拟和部署的区别要记牢：

|  | 本地模拟 | 部署到 DON |
|---|---|---|
| 要不要审批 | 不需要，装好就能跑 | 需要，先跑 `cre account access` 申请部署权限 |
| 在哪跑 | 你自己的机器 | Chainlink 的 DON 网络 |
| 调真实 API 吗 | 调，真实的 | 调，真实的 |
| 部署后怎么管 | 不涉及 | 用 CLI 部署、激活、暂停、更新、删除，在 CRE 界面看日志和指标 |

部署权限申请这一步要留出时间：官方没有承诺审批要多久，排进计划时别按“今天申请今天就能部署”来算。

另外一个新手常问的问题：模拟写链操作要不要真钱？要。模拟里写链需要一个有 Sepolia ETH 的账号付 Gas（去 faucets.chain.link 领）。如果工作流不写链，只读数据、调 API，填一个占位私钥就能跑。

## 八、经常踩的坑

**以为 Functions 的代码能直接搬过来。**

不能。Functions 是合约里嵌一段 JavaScript，CRE 是独立工程。触发方式、回调用法、消费端合约的接口全都变了。迁移指南要一行一行对照着改，改完重新测一遍，别想着“差不多”。

**以为装好 CLI 就能部署。**

模拟不用审批，部署要。`cre account access` 是专门申请部署权限的命令，批下来之前，`deploy` 跑不通。这是设计，不是故障。

**密钥以为能导出来。**

DON 托管的 Functions 密钥导不出来。迁移之前，先把所有密钥列出来，准备好重新注册。密钥丢了，工作流调私有 API 会直接失败，而且报错未必会明说“密钥不对”。

**把工作流当成一台一直开着的服务器。**

工作流每次执行都是独立、无状态的：触发一次，跑一次，跑完就结束，中间状态不会留到下一次。如果你想在两次执行之间记住点什么，要把状态写回链上或者外部存储，不能指望工作流自己记住。

**照着老教程写消费端合约。**

Functions 的消费端是 `fulfillRequest(bytes32 requestId, bytes response, bytes err)`，CRE 的消费端是实现 `IReceiver` 接口、接收 DON 签名报告。两个接口长得完全不一样，老代码复制过来编译都过不了。

**不核对支持的链。**

CRE 不支持 Soneium 和 Celo Alfajores。之前在这些链上用 Functions 的项目，迁移之前要先确认目标链在不在 CRE 的支持列表里。

## 九、CRE 能用来做什么

把前面的零件拼起来，CRE 适合的场景就很清楚了：凡是“链下触发、链下算、结果回链上”的事，都能收进一个工作流。

- **定时喂数据**：每天早上查一次天气，写进合约，动态 NFT 按天气换表情（39 篇的思路，不用再拼两个产品）；
- **事件驱动**：链上有人 Mint 了 NFT，自动触发工作流去查链下数据、再写回另一个合约；
- **跨链编排**：在 A 链上监听事件，调 API 算一算，再到 B 链上执行，全程一个工作流；
- **隐私计算**：用 Confidential HTTP 调需要密钥的 API，密钥只在 TEE 里出现，节点运营方也看不到。

这些场景里，46–51 篇会挑两个最适合初学者的做完整实战：50 篇用 CRE 查天气，51 篇用 CRE 做一个去中心化新闻应用。48 篇单独讲计费：CRE 的额度、付费方式和成本控制，和 Functions 的订阅制不是一回事，动手之前先搞清楚再充钱。

最后提醒一句：CRE 正式上线才一年，工具链和文档还在变。这篇写的时候，CLI 还是 v1.40.0、部署还要审批、Confidential Workflow 还是 beta。等你动手的时候，先去官方文档核对一遍当时的版本和状态，再开始写代码。

---

## 总结

- Chainlink Functions 主网已于 2026-06-30 关闭，Automation v1.x 和 v2.1 也分别在 2026-06-30 和 2026-07-31 弃用，接替它们的是同一个东西：Chainlink Runtime Environment（CRE）。
- CRE 是一个统一的运行时：你用 Go 或 TypeScript 写一个工作流，编译成 WASM，部署到 Chainlink 的去中心化预言机网络上运行。
- 工作流由触发器、回调、处理器三个零件组成：触发器决定什么时候跑，回调决定跑什么，处理器把两者连起来。每次执行独立、无状态。
- 触发器有四种：Cron（最短 30 秒）、HTTP、EVM Log、Solana Log；能力包括 HTTP、Confidential HTTP、EVM 读写、Solana 读写。
- 每一步能力调用都有多个节点独立执行、再用 BFT 共识对出一个结果；最后由 DON 签名的报告写回实现 `IReceiver` 的消费端合约。
- 上手分四步：注册账号、装 `cre` CLI、`cre init` 建项目、`cre workflow simulate` 本地模拟。模拟不用审批，部署要先跑 `cre account access` 申请。
- 从 Functions 迁移要注意：逻辑要重写成独立工程，DON 托管的密钥导不出来要重新注册，消费端合约接口从 `fulfillRequest()` 换成 `IReceiver`。
- CRE 不支持 Soneium 和 Celo Alfajores，动手前先核对官方支持网络列表。

---

## 下一篇是第 46 篇：

[[blog/y7blog-web3-47]]

概念讲完了，下一篇开始动手：智能合约如何调用 API？CRE 实战。下一篇会从一个最小的 CRE 工作流开始：用 Cron 触发器定时触发，调一个公开 API 拿回数据，再把结果写回 Sepolia 上的一份合约——把这篇讲的触发器、回调、能力和签名报告，完整地跑一遍。

---

*参考资料：Chainlink CRE 官方概览（什么是 CRE、触发器-回调模型、WASM 与 DON、模拟与部署审批，2026-11-25 核对，https://docs.chain.link/cre/overview）；Chainlink Functions 迁移到 CRE 官方指南（主网 2026-06-30 关闭、迁移对照、密钥不可导出、IReceiver 消费端，https://docs.chain.link/cre/reference/clf-migration-go）；Chainlink CRE 能力概览（HTTP、Confidential HTTP、EVM 与 Solana 读写、触发器类型，https://docs.chain.link/cre/capabilities）；Chainlink CRE 关键术语（Workflow DON、Capability DON、TEE、Vault DON、Report，https://docs.chain.link/cre/key-terms）；Chainlink CRE 入门第一部分（cre init、cre login、本地模拟、部署 registry 选择，https://docs.chain.link/cre/getting-started/part-1-project-setup-ts）；Chainlink CRE CLI 参考（cre workflow simulate/build/deploy、cre secrets create、cre account access，https://docs.chain.link/cre/reference/cli）；Chainlink CRE CLI Windows 安装（v1.40.0、校验方法，https://docs.chain.link/cre/getting-started/cli-installation/windows）；Matrixed.Link《Chainlink CRE: Workflows, Capabilities and DONs》（CRE 架构解析、迁移要点，https://matrixed.link/blog/chainlink-cre）；Matrixed.Link《Chainlink Products: What Each One Does in 2026》（Functions 与 Automation 退役时间线、CRE 2025-11-04 上线，https://Matrixed.Link/blog/chainlink-products-explained）。*
