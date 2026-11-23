---
title: 36｜Chainlink CCIP 如何实现跨链 NFT？
published: 2026-11-12
pinned: false
draft: false
comment: true
description: CCIP 到底是怎么把一张 NFT 从一条链搬到另一条链的？这篇顺着一条跨链消息走完全程：源链上先烧掉再发消息，链下验证节点签名背书，目标链上验证通过才铸出新 NFT。再按 CCIP 2.0 的最新架构，讲清楚费用、Gas 上限和最容易踩的坑。
image: https://www.y7img.ccwu.cc/file/1795162013611_y7blog-web3-37-1600.png
tags: [CCIP,跨链NFT,Chainlink,ERC721,跨链消息]
category: Web3
slug: blog/y7blog-web3-37
series: "区块链百科"
seriesOrder: 1
---

你手里有一张 NFT，在 Ethereum Sepolia 上 Mint 的。现在你想把它拿到 Avalanche Fuji 上用——可能是那边的游戏认它，可能是那边的市场手续费更便宜。跨链 NFT 有几条不同的路线：烧掉再铸、锁起来再铸、只传消息不搬资产。这篇就钻进其中最常用的一条路线里，看看它到底是怎么跑的：**Chainlink CCIP 是怎么把一张 NFT 从一条链搬到另一条链上的？**

先给一个最关键的提醒，很多人第一次接触 CCIP 都会在这里想错：**CCIP 本身不是一个 NFT 桥，它是一个跨链消息层**。它只负责把一条消息从 A 链安全地送到 B 链，消息里装什么、收到消息后干什么，都是你自己的合约决定的。NFT 跨链，是你用 CCIP 的消息能力自己搭出来的。

> 💡 **先说清楚**：这篇讲的是 CCIP 实现跨链 NFT 的原理和流程，代码只是学习用的骨架，没有经过审计，不能直接拿去生产环境用。跨链操作要动真钱，动手之前先在测试网练手、小额试。本文是知识科普，不是投资建议。

---

## 一、CCIP 到底是什么？先分清它能干的三件事

CCIP 的全名是 Cross-Chain Interoperability Protocol，Chainlink 的跨链互操作协议。很多介绍会把它叫作“跨链桥”，这个叫法容易让人误会。桥通常指一个现成的、点一下就能用的产品；CCIP 更像是一套**跨链的基础设施**，开发者拿它来搭自己的跨链应用。

它能干的事，分成三种：

| 能力 | 是干什么的 | 跨链 NFT 用不用得上 |
| --- | --- | --- |
| **任意消息（Arbitrary Messaging）** | 把一段数据从 A 链的合约发到 B 链的合约，B 链合约收到后执行你写好的逻辑 | 用得上，而且是主力：NFT 跨链的消息就是走这条路 |
| **Token 转移（Token Transfer）** | 把 Token 从一条链搬到另一条链 | NFT 本身不走这条路，因为 CCIP 现成的 Token 标准 CCT 只覆盖 ERC20，不管 NFT |
| **可编程 Token 转移（Programmable Token Transfer）** | Token 和数据一起发，B 链收到 Token 的同时执行一段逻辑 | NFT 场景一般用不上，除非你要连 Token 带指令一起发 |

打个比方：CCIP 像跨链的**挂号信服务**。它保证你的信一定送到、送到之前没人能改、送到之后对方能验明这封信确实是你寄的。但信里写什么——是“请把 tokenId 为 7 的 NFT 铸给这个地址”，还是“请执行那段交易”——是寄信的人决定的。CCIP 不替你写信。

这个定位解释了上一节留下的一个问题：为什么 CCIP 有现成的跨链 Token 标准 CCT，NFT 跨链却还要自己写合约？因为 CCT 是 Chainlink 给同质化 Token 做好的“标准信封”，部署加配置就能用；**NFT 没有这样的标准信封**，每个项目的 NFT 合约长得都不一样，tokenId、metadata、铸造权限各有各的规矩，只能由项目方自己写两个合约：源链上一个负责烧、负责发消息，目标链上一个负责收消息、负责铸造。

---

## 二、一条跨链消息的四步旅程

不管你要搬的是 NFT 还是别的什么，一条 CCIP 消息从发出去到被执行，都要走四步。这是 CCIP 2.0 的架构，2026 年 9 月 28 日上线的版本，现在的官方文档讲的都是这一套。

```
你调 ccipSend（源链）
  │
  ▼
┌─────────────────────────────────────────────────┐
│ 第 1 步：Send（发送）——在源链上                  │
│  Router 收下消息和费用，OnRamp 打包、编号、算出   │
│  messageId，发一个 CCIPMessageSent 事件          │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│ 第 2 步：Verify（验证）——在链下                  │
│  跨链验证器（CCV）各自盯着源链，等源链交易最终    │
│  确认后，各自签名背书，凑够 quorum 才算通过       │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│ 第 3 步：Index（归集）——在链下                   │
│  Aggregator / Indexer 把各家的签名按 messageId   │
│  归集到一起，等执行的时候一次性提交               │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│ 第 4 步：Execute（执行）——在目标链上              │
│  任何人都能把消息和签名提交给 OffRamp；验证通过后  │
│  才调用你的接收合约，铸出 NFT                     │
└─────────────────────────────────────────────────┘
```

### 1. Send：在源链上把消息交出去

一切从你的合约调 `Router.ccipSend` 开始。调用之前一般先调 `Router.getFee` 问价，拿到费用后再真正发送。Router 会检查：目标链是不是支持、费用够不够、费用 Token 是不是允许的——任何一项不过，发送直接 revert，钱不会扣。

消息交到 OnRamp 手里之后，OnRamp 做几件事：按顺序给这条消息编一个号，给它算一个**消息 ID**，算法是 `messageId = keccak256(整条消息的编码）`。这个 ID 很重要：它是对整条消息内容的承诺，消息里的接收方、数据、费用、验证器配置，任何一个字节变了，ID 就变了。所以链下验证器签名的就是这个 ID，签完就没法拿去给另一条消息用。

最后 OnRamp 发出一个 `CCIPMessageSent` 事件，链下验证器就是靠监听这个事件发现新消息的。

### 2. Verify：链下验证，等源链最终确认

消息发出去了，但目标链不能马上相信它。链下验证器要先等一件事：**源链上的这笔交易真正最终确认了**。默认情况下要等完整的最终确认（finality），不能只等一两个区块——因为链可能重组，刚打包的交易还有被翻盘的可能。2.0 也提供了一个可选项 Faster-Than-Finality，可以不等完整最终确认就放行，但那是项目方自己选的、要自己承担风险的配置，默认不走这条路。

等最终确认过了，验证器开始干活。默认的验证器叫 **Committee Verifier（委员会验证器）**，由 16 个独立的节点运营方组成，每个节点独立地核对消息 ID 和消息内容，核对无误就各自签一个名，签名汇总到 Aggregator，凑够 quorum（法定多数）才算验证通过。

这里有个 2.0 的大变化要先记住，第七节会细讲：1.x 时代还有一个独立的 **RMN（Risk Management Network，风险管理网络）** 做第二道检查，2.0 里它不再担任这个角色了。想加第二道检查的项目方，现在要自己叠加可选的验证器（CCV），比如自己跑一个，或者找 Infosys、Nethermind 这样的第三方来跑。默认只用委员会验证器的项目，实际依靠的是一道验证，而不是以前的两道——只不过这一道是由 16 个独立运营方 quorum 背书的，不是一个单独的验证器说了算。

### 3. Index：把签名归集到一起

各家验证器的签名散落在不同的地方，需要有人把它们按 messageId 归集起来。Aggregator 负责收委员会验证器的签名，Indexer 负责把各家验证器的结果汇总、存好，等执行的时候一次性取用。这一步全在链下，不花 Gas，你也不用管它——但它解释了为什么跨链消息不是“秒到”：验证、归集、等执行器来取，都要时间。

### 4. Execute：在目标链上执行，任何人都能提交

验证通过后，消息就可以在目标链上执行了。2.0 有一个很多人第一次听说会惊讶的设计：**执行是无许可的（permissionless）**。任何人都可以把编码好的消息和验证结果提交给目标链的 `OffRamp.execute`。你不用是 Chainlink 的节点、不用有特殊权限，只要你手里有正确的消息和签名，就能替这条消息“跑腿”。

实际运行中，大多数消息不需要你亲自动手：Chainlink 的**默认执行器**会自动执行每一条消息，执行失败了还会在 8 小时内重试。只有默认执行器执行不了的时候——比如你的接收合约出了问题，或者你特意选了不自动执行——才需要你手动执行。官方提供了 SDK、CLI 和 CCIP API 来做这件事，在 CCIP Explorer（ccip.chain.link）上输入 messageId 或者源链交易哈希，也能查到一条消息走到哪一步了。

目标链的 OffRamp 在执行之前会做一整套检查：源链有没有被“诅咒”（curse，被标记为有问题的链）、消息里的 OnRamp 地址是不是白名单里的、消息是不是发给这条链的、这条消息是不是已经执行成功过。检查全部通过，才会调用你的接收合约。执行结果只有两种状态：**SUCCESS（成功，这条消息不能再执行了）** 或者 **FAILURE（失败，可以重试）**。执行失败不会把 Token 或 NFT 卡在半路——整个执行是原子性的，要么全成，要么全不成，失败了修好问题再重试一次就行。

---

## 三、源链上发生了什么：先烧掉（或锁住），再发消息

回到 NFT 本身。拿 burn-and-mint 这条路线举例，源链上的合约要做两件事：**先处理你手里的 NFT，再把消息发出去**。顺序不能反——必须先烧掉，消息才能发。为什么？因为如果先发消息、后烧 NFT，中间一旦出岔子，就可能出现“目标链上已经铸出来了，源链上那张还没烧掉”的窗口期，同一张 NFT 在同一时间存在了两份，这正是跨链 NFT 最要命的错误。

源链上的流程是这样的：

```
你（Ethereum Sepolia）
  │
  ├─ 调跨链 NFT 合约：sendCrossChain(tokenId, 目标链, 你的地址)
  │     │
  │     ├─ 第 1 步：检查你确实是这张 NFT 的主人
  │     ├─ 第 2 步：烧掉你的 NFT（tokenId 从此在源链上不存在）
  │     ├─ 第 3 步：算费用 getFee，准备好 LINK（或原生币）
  │     └─ 第 4 步：调 Router.ccipSend，把消息发出去
  │                        │
  │                        ▼  CCIP 消息层（验证、归集、执行）
```

### 消息里到底装了什么

`ccipSend` 要传的目的地和消息内容，核心是五个字段：

| 字段 | 是什么 | NFT 跨链时填什么 |
| --- | --- | --- |
| `destinationChainSelector` | 目标链的编号 | 目标链的 chain selector，不是 chain ID（见下） |
| `receiver` | 目标链上接收消息的合约地址 | 目标链上那个负责铸 NFT 的合约 |
| `data` | 你想让目标链合约收到的数据 | 一般是 `abi.encode(tokenId, 接收地址, tokenURI)`，也就是“铸哪一张、给谁、metadata 在哪” |
| `tokenAmounts` | 随消息一起转移的 Token | NFT 跨链一般是空的，因为 NFT 本身不是靠 CCIP 的 Token 转移搬的，是靠消息触发目标链重新铸 |
| `extraArgs` | 额外配置 | 最关键的是**目标链上执行时给接收合约的 Gas 上限**；新版用 `ExtraArgsV3`，老版 V1/V2 的写法在 2.0 上照样能用，OnRamp 会在内部转成 V3 |
| `feeToken` | 付 CCIP 费用的 Token | LINK 的地址，或者填零地址表示用原生币付 |

这里有两个最容易搞错的点。

**第一，chain selector 不是 chain ID。** 每条链在 CCIP 里都有一个专用的编号，叫 chain selector，和平时说的 chain ID 是两码事。Ethereum Sepolia 的 chain ID 是 11155111，它的 chain selector 是 `16015286601757825753`；Avalanche Fuji 的 chain ID 是 43113，chain selector 是 `14767482510784806043`。填错了，消息就发到错的地方去——或者根本发不出去。每次动手之前，去官方的 CCIP Directory 页面查一遍，别凭记忆填。

| 测试网 | Chain ID | Chain Selector | Router 地址 |
| --- | --- | --- | --- |
| Ethereum Sepolia | 11155111 | 16015286601757825753 | 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59 |
| Avalanche Fuji | 43113 | 14767482510784806043 | 0xF694E193200268f9a4868e4Aa017A0118C9a8177 |
| Base Sepolia | 84532 | 10344971235874465080 | 查 CCIP Directory |

**第二，费用要先问价、再发送。** 先调 `Router.getFee` 拿到报价，再调 `ccipSend`。如果用 LINK 付费，要先 `approve` 给 Router 足够的额度；如果用原生币付，就把币放在 `msg.value` 里。费用不够，发送会直接 revert，报错 `InsufficientFeeTokenAmount`。

### 白名单：两边合约要先认对方

动手之前还有一个准备工作：源链的合约要先把目标链放进白名单，目标链的合约也要先把源链和源链合约的地址放进白名单。这一步是安全措施：你的合约只接受来自你信任的那条链、那个合约的消息，别人伪造一条消息发过来，目标链合约直接拒收。Jacek 的博客里那个 lock-and-mint 的实测项目就专门写了两套白名单检查：目标链合约收到消息时，先验发送方是不是源链上那个 `NFTVault`，再验源链编号对不对得上，任何一项不对就 revert。

---

## 四、目标链上发生了什么：先验证，再铸出来

消息在目标链上执行时，OffRamp 会按固定顺序做三件事：

```
目标链（Avalanche Fuji）
  │
  ├─ OffRamp.execute(消息, 验证结果)
  │     │
  │     ├─ 第 1 步：验签名 —— 委员会验证器的 quorum 够不够
  │     ├─ 第 2 步：验身份 —— 消息确实来自白名单里的源链合约
  │     └─ 第 3 步：调 Router.routeMessage
  │            └─ 调你的接收合约 ccipReceive(消息)
  │                  ├─ 验 msg.sender 是不是 Router
  │                  ├─ 验消息的发送方和源链编号
  │                  ├─ 解码 data：tokenId、接收地址、tokenURI
  │                  └─ 按同一个 tokenId 铸 NFT，metadata 用同一份
```

### 接收合约长什么样

目标链上的接收合约要继承 `CCIPReceiver`，实现一个 `ccipReceive` 函数。CCIP 的 Router 会在执行时调用它。函数里的逻辑一般是四步：

```
function ccipReceive(Client.Any2EVMMessage memory message) external override {
    // 1. 只能是 Router 调我，别人直接调这个函数没用
    if (msg.sender != address(i_router)) revert NotRouter();
    // 2. 只能认源链上那个合约发来的消息
    if (message.sourceChainSelector != i_sourceChainSelector) revert WrongChain();
    if (abi.decode(message.sender, (address)) != i_sourceContract) revert WrongSender();
    // 3. 解码消息里的数据：铸哪一张、给谁、metadata 在哪
    (uint256 tokenId, address to, string memory uri) =
        abi.decode(message.data, (uint256, address, string));
    // 4. 按同一个 tokenId 铸出来，metadata 用同一份
    _mint(to, tokenId);
    _setTokenURI(tokenId, uri);
}
```

注意第 1 步：`ccipReceive` 只能由 Router 调用。你作为用户不能直接调它，别人也不能冒充 Router 调它——因为 `msg.sender` 必须是 Router 地址。消息真正的发送方，存在 `message.sender` 这个字段里，那是源链上那个合约的地址。

还有一个细节：`ccipReceive` 里能干的事是有限的，因为执行时给它的 Gas 是**精确控制**的。发送消息的时候，你在 `extraArgs` 里定了一个 Gas 上限，执行时 Router 就按这个上限给 Gas，多一分都不给。如果 `ccipReceive` 里的逻辑太重、Gas 不够，整个执行就失败了，状态变成 FAILURE。好处是失败可以重试：把问题修好（比如调高 Gas 上限再发一次，或者修合约逻辑），重新执行就行。坏处是 Gas 上限给太低，消息会在目标链上反复失败，白白浪费时间。

### Gas 上限给多少合适

这是一个经常犯的错：有人为了省费用把 Gas 上限压得很低，结果 `ccipReceive` 执行到一半没 Gas 了，消息失败；也有人给得太高，白白多付费用。合理的做法是：先在测试网跑一遍，看 `ccipReceive` 实际用了多少 Gas，再留一点余量。执行时如果想临时多给一点 Gas，可以在调 `OffRamp.execute` 时传一个 `gasLimitOverride`，但它只能比消息里定的上限**更高**，不能更低——传一个比上限小的数会直接 revert。

---

## 五、拼起来看：burn-and-mint 的完整流程

把第三、四节拼起来，一次 burn-and-mint 的跨链搬家全程是这样的：

```
Ethereum Sepolia（源链）                Avalanche Fuji（目标链）
┌──────────────────────┐                ┌──────────────────────┐
│ 你的跨链 NFT 合约      │                │ 目标链 NFT 合约       │
│                      │                │                      │
│ 1. 检查你是 tokenId   │                │ 5. OffRamp 验签名、   │
│    的主人             │                │    验身份，通过后调    │
│ 2. 烧掉 NFT          │                │    Router.routeMessage │
│ 3. getFee 问价       │                │ 6. ccipReceive：      │
│ 4. ccipSend 发消息    │                │    验 Router、验发送方 │
│    data =            │                │    解码、按同一 tokenId│
│    (tokenId, 你的地址, │                │    铸 NFT、写同一份    │
│     tokenURI)        │                │    tokenURI           │
└──────┬───────────────┘                └──────────▲───────────┘
       │  CCIPMessageSent 事件                     │
       ▼                                           │
┌──────────────────────────────────────────────────┐
│ 链下：CCV 等源链最终确认 → 各自签名 → Aggregator   │
│ 凑够 quorum → Indexer 归集 → 默认执行器提交执行    │
└──────────────────────────────────────────────────┘
```

Kaia 官方博客演示过一个完整的 burn-and-mint 例子：NFT 在 Kaia 测试网和 Ethereum Sepolia 之间搬，搬过去之后保持同一个 tokenId 和同一份 metadata，用的就是上面这套流程。Jacek 的博客则演示了另一条路线 lock-and-mint 的完整往返：NFT 锁在 Ethereum Sepolia 的 `NFTVault` 合约里，在 OP Sepolia 上铸出包装版，再烧掉包装版把原件拿回来，全程只信任 CCIP 协议本身，没有自定义的中继或者多签桥委员会。

两条路线在 CCIP 层面的流程是一样的，区别只在源链和目标链合约里“处理 NFT”的那一步：burn-and-mint 是烧掉再铸，lock-and-mint 是锁住再铸包装版。想用哪条，取决于你能不能控制两边的合约，这个上一节已经讲过了。

---

## 六、费用到底怎么算？LINK 还是原生币

跨链 NFT 的费用，经常比 NFT 本身还贵，所以动手之前一定要先算清楚。一张 NFT 从源链搬到目标链，费用分三块：

| 费用 | 在哪付 | 付给谁 | 大概是多少 |
| --- | --- | --- | --- |
| 源链 Gas | 源链 | 源链矿工/验证者 | 烧 NFT + 发消息两笔交易，取决于源链 Gas 价 |
| CCIP 跨链费 | 源链（发消息时一起付） | CCIP 协议各方 | 见下表，按消息大小和目标链执行成本算 |
| 目标链 Gas | 不用你另外付 | — | 已经包含在 CCIP 跨链费里了，由 Fee Quoter 折算进去 |

第三行是很多人没想到的：**目标链上铸 NFT 的 Gas，你不用在目标链上再准备一份**。CCIP 的费用里已经包含了目标链执行的那部分成本，执行器在目标链上提交执行交易时，Gas 是从这笔费用里出的。你只需要在源链上准备好两样东西：源链的原生币（付源链 Gas）和 CCIP 费（用 LINK 或源链原生币付）。

CCIP 跨链费本身又由几部分组成，`getFee` 报价的时候就是把这几部分加起来：

| 组成部分 | 是什么 |
| --- | --- |
| Fee Quoter | 目标链上执行这条消息要花多少 Gas，折算成费用；你的 `data` 越大、目标链 Gas 越贵，这部分越高 |
| 每个 CCV 的验证费 | 每个验证器收的费用，固定部分加按字节算的部分 |
| 执行器费 | 默认执行器帮你执行收的费用；如果你选了不自动执行（`NO_EXECUTION_ADDRESS`），这部分是零，但执行就得你自己来 |
| 池子费 | 只有带 Token 转移的消息才有；纯消息的 NFT 跨链没有这一项 |

有三个省钱的实操要点：

**第一，`data` 里别塞大东西。** 费用是按字节算的，`data` 越大越贵。`tokenURI` 放一个 IPFS 链接就够了，别把整份 metadata 的 JSON 塞进消息里。

**第二，Gas 上限别给过头。** 目标链执行成本是按你定的 Gas 上限报价的，给 200,000 和给 500,000，报价不一样。先在测试网实测实际用量，再留一点余量。

**第三，LINK 还是原生币，看哪边便宜。** CCIP 费用可以用 LINK 付，也可以用源链原生币付，两种都行。LINK 付费要先 `approve` 给 Router；原生币付费直接放 `msg.value` 里。测试网上，LINK 可以从 Chainlink 水龙头领。

---

## 七、CCIP 2.0 变了什么？老教程为什么对不上了

如果你之前看过 CCIP 的教程，照着做却发现对不上，大概率是因为版本变了。CCIP 2.0 是 2026 年 9 月 28 日上线的，改动不小，而且官方文档已经换成了 2.0 的新版，老版文档归档到了 `/ccip/v1/` 下面。上一节提过，旧版的跨链 NFT 教程页已经下线（2026 年 11 月 20 日核对，原地址返回 404），照着旧链接找会扑空。

|  | v1.5 / v1.6 | CCIP 2.0（2026-09-28 上线） |
| --- | --- | --- |
| 验证消息的是谁 | 一个 Chainlink 预言机网络（DON），分 Commit 插件和 Execute 插件两个角色，Commit 插件把消息的 Merkle 树根发到目标链上 | **跨链验证器（CCV）**，默认是 16 个独立节点运营方组成的委员会验证器，各自签名、凑 quorum；项目方可以叠加自己的验证器 |
| 执行消息的是谁 | 同一个 DON 的执行插件 | **任何人都能执行**，默认执行器自动执行、8 小时内失败重试；也可以手动执行 |
| 第二道检查 | RMN（风险管理网络）独立复核每一笔 | RMN 不再担任这个角色；想加第二道检查，改由可选的 CCV 承担；但链被“诅咒”时的拦截检查还在 |
| 消息 ID 怎么算 | OnRamp 的哈希器算 | `keccak256(整条消息的编码）`，消息内容一变 ID 就变 |
| extraArgs | V1 / V2，带 `allowOutOfOrderExecution` | 新版用 **ExtraArgsV3**（验证器、执行器、最终确认方式、Gas 上限都能配）；老版 V1/V2 的写法照样能用，OnRamp 内部会转换 |
| 消息顺序 | NonceManager 管顺序执行 | NonceManager 取消了，`allowOutOfOrderExecution` 这个参数也废弃了 |
| 等多久才算确认 | 必须等源链最终确认 | 默认还是等完整最终确认；项目方可以选 Faster-Than-Finality 更快放行，自己承担风险 |
| Token 池子 | IPoolV1 | IPoolV2，流动性放在 ERC20LockBox 里，池子升级不用搬流动性 |

有两点可以放心：第一，**已经接进来的老应用不用改代码，照样能跑**，Chainlink 官方明确说了现有集成在 2.0 下继续工作，不需要改动；第二，新版文档里老概念大多还在，只是换了实现方式——比如你以前知道的 Router、OnRamp、OffRamp、CCIPReceiver、`ccipSend`、`ccipReceive`，2.0 里都还在，入口还是同一个 Router。

还有一个时间点要注意：Chainlink 正在逐步停掉一些使用量不高的链的 CCIP 支持。**2026 年 11 月 30 日起，Corn、Core、Metal、Zora、Abstract、Edge、Lisk、Lens、Merlin、Superseed 和 B2 Mainnet 这 11 条链将不再支持 CCIP 消息和 Token 转移**。如果你手里的 NFT 在这些链上，或者打算往这些链上搬，要在 11 月 30 日之前做好迁移或者换一条路。

---

## 八、动手之前，最容易踩的坑

前面讲的都是“应该怎么做”，这一节讲“经常犯的错”。这些坑都是真实项目里反复出现过的，动手之前先对照一遍。

### 1. 把 chain ID 当成 chain selector 填进去

这是最容易出现的问题。Chain ID 和 chain selector 是两套编号，长得还都是数字，很容易填错。填错了，消息要么发不出去，要么发到错误的地方。每次动手之前，去官方 CCIP Directory 页面查一遍，别凭记忆填。

### 2. Gas 上限给太低，消息在目标链上执行失败

`ccipReceive` 的 Gas 不够，执行失败，状态变 FAILURE。好消息是失败可以重试，坏消息是你要先找到原因——到底是 Gas 上限太低，还是合约逻辑本身有问题。先在测试网实测实际 Gas 用量，再留余量，别靠猜。

### 3. 忘了配白名单

源链合约没放行目标链，或者目标链合约没认源链的发送方，消息发过去也会被拒收。两边合约部署完之后，先把白名单配好，再发第一条测试消息。

### 4. 以为 CCIP 自带 NFT 跨链

CCIP 现成的 Token 标准 CCT 只覆盖 ERC20，NFT 不在其中。NFT 跨链要自己写两边的合约：源链烧/锁、目标链收消息再铸。指望“接一下 CCIP 就能跨 NFT”的，会发现根本没有这个现成接口。

### 5. `data` 里塞太多东西，或者 tokenURI 两边对不上

费用按字节算，`data` 越大越贵。更要命的是 metadata 对不上：目标链铸出来的 NFT 指向了另一份 metadata，图片、属性全变了，搬过去的就不是原来那张。发消息之前，先核对两边的 `tokenURI` 指向同一份内容。

### 6. 发出去的消息改不了，发之前先在测试网跑一遍

消息一旦上链，内容就定死了：接收方、data、费用、验证器配置，一个字节都改不了。地址写错、tokenId 写错，只能等它执行失败再处理。正式动手之前，先在测试网（比如 Sepolia 到 Fuji）完整跑一遍往返，确认能搬过去、也能搬回来。

### 7. 等不及就重复发一次

跨链消息要等源链最终确认、等验证、等执行，整个过程按分钟算，不是按秒算。目标链上的 NFT 不会“秒到”。如果等了几分钟还没到，先去 CCIP Explorer 上输入 messageId 或者源链交易哈希查状态，**别一着急就重复发一次**——重复发可能烧掉两张、铸出两张。

### 8. 往 11 月 30 日后停用的链上发消息

上面第七节列的 11 条链，2026 年 11 月 30 日起不再支持 CCIP。往这些链上发消息，11 月 30 日之后就走不通了。动手之前先确认目标链还在支持列表里。

---

## 总结

- **CCIP 是跨链消息层，不是 NFT 桥**：它只负责把消息安全送到，消息里装什么、收到后干什么，是你自己的合约决定的；现成的 CCT 标准只覆盖 ERC20，NFT 跨链要自己写两边的消息合约。
- **一条消息走四步**：Send（源链发消息、算 messageId）→ Verify（链下 CCV 等最终确认、签名凑 quorum）→ Index（签名按 messageId 归集）→ Execute（目标链 OffRamp 验证后调接收合约）。
- **源链先烧再发**：burn-and-mint 必须先烧掉 NFT 再发消息，顺序不能反；消息里装的是 tokenId、接收地址和 tokenURI，费用先 `getFee` 问价再付。
- **目标链先验再铸**：OffRamp 验签名、验身份，通过后才调 `ccipReceive`；接收合约要验 `msg.sender` 是 Router、验发送方是源链那个合约，再按同一个 tokenId 铸出来。
- **费用三块**：源链 Gas、CCIP 跨链费（Fee Quoter + CCV 验证费 + 执行器费），目标链 Gas 包含在 CCIP 费里；`data` 越大越贵，Gas 上限别给过头。
- **CCIP 2.0 变了不少**：验证改成 CCV（默认 16 节点委员会）、执行改成无许可、RMN 不再做第二道检查、extraArgs 有了 V3、NonceManager 取消了；老集成不用改代码，照样能跑。
- **最容易踩的坑**：chain selector 和 chain ID 搞混、Gas 上限给太低、忘了配白名单、以为 CCIP 自带 NFT 跨链、消息发出去改不了就重复发、往 11 月 30 日后停用的链上发。

---

## 下一篇是第 37 篇：

[[y7blog-web3-38]]

这篇把 CCIP 怎么实现跨链 NFT 的全流程讲清楚了，下一篇开始动手：从 Solidity 合约开始，一步步搭一个支持 CCIP 的跨链 NFT——源链的发送合约怎么写，目标链的接收合约怎么写，白名单、费用和 Gas 上限具体怎么配。

*参考资料：Chainlink 官方文档《CCIP Message Lifecycle》（docs.chain.link/ccip/concepts/message-lifecycle，2026-11-19 发布；Send/Verify/Index/Execute 四阶段、ExtraArgsV3、messageId 计算、执行状态机与 8 小时重试）；Chainlink 官方文档站（docs.chain.link/ccip，2026-11-20 核对；CCIP 2.0 上线横幅；11 条链 2026-11-30 停用：Corn、Core、Metal、Zora、Abstract、Edge、Lisk、Lens、Merlin、Superseed、B2 Mainnet）；CoinDesk《Chainlink launches CCIP 2.0 to give big crypto apps more control over their security》（2026-09-28；CCIP 2.0 上线，默认 16 节点 Committee Verifier，RMN 不再做第二道检查，老集成不用改）；Chainlink 官方文档《Get Started with CCIP (EVM)》（docs.chain.link/ccip/v1/evm/getting-started；Sepolia/Fuji 的 Router 与 LINK 地址、chain selector：Sepolia 16015286601757825753、Fuji 14767482510784806043、Base Sepolia 10344971235874465080）；Chainlink 官方文档《Enable your tokens in CCIP (Burn & Mint)》（docs.chain.link/ccip/evm/tutorials/cross-chain-tokens/register-from-eoa-burn-mint-foundry；CCT 标准只覆盖 ERC20）；Jacek's Blog《Bridging NFTs Cross-Chain with Chainlink CCIP》（blog.varkiwi.com，2026-06-29；lock-and-mint 实测，NFTVault 锁仓 + WrappedNFT 包装版，Ethereum Sepolia 到 OP Sepolia 往返）；QuickNode《How to Mint an NFT Across Different Blockchains using Chainlink CCIP》（quicknode.com；Polygon Amoy 到 Avalanche Fuji 跨链 Mint 实测；用的是 CCIP 1.5 时代的合约包，接口细节以 2.0 文档为准）；Kaia 官方博客《Building Cross-Chain NFTs on Kaia with Chainlink CCIP》（blog.kaia.io；burn-and-mint，同一 tokenId 与同一份 metadata，Kaia 测试网与 Ethereum Sepolia 之间）；Ryan S.《Chainlink CCIP — from DONs to Cross-Chain Verifiers》（rya-sge.github.io，2026-11-16；v1.6 与 2.0 架构对照，CCV、permissionless 执行、NonceManager 取消）。*
