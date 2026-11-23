---
title: 38｜如何从一条链 Mint NFT 到另一条链？
published: 2026-11-14
pinned: false
draft: false
comment: true
description: 这篇把跨链 NFT 的整条链路跑完整：先在 Sepolia 上 Mint 一张 NFT，再经 CCIP 烧掉、发消息、等终局、验证、执行，最后在 Fuji 上收到同一张 NFT。还会查消息走到哪一步、再把 NFT 搬回来，并讲另一条 lock-and-mint 路线，以及新手最容易踩的十个坑。
image: https://www.y7img.ccwu.cc/file/1795248280583_y7blog-web3-39-1600.png
tags: [CCIP,跨链NFT,Mint,ERC721,Chainlink]
category: Web3
slug: blog/y7blog-web3-39
series: "区块链百科"
seriesOrder: 1
---

合约写好了，两条链上也部署配好了。现在真正动手跑一次：先在 Sepolia 上 Mint 一张 NFT，把它搬到 Fuji 上，再搬回来。中间要等多久？消息发出去之后去哪查它走到哪一步了？万一卡住了怎么办？

这篇就把这条链路从头跑到尾：Mint、发消息、查状态、验货、再搬回来。跑完你会发现，跨链 Mint 最难的不是写代码，而是**等的那十几分钟里，你得知道消息走到哪一步、什么时候该动手、什么时候只能等**。

> 💡 **先说清楚**：这篇跑的是 37 篇写的那份 `CrosschainNFT` 合约，照着它在测试网上的真实流程讲，没经过审计的学习合约不能直接拿去生产环境。动手之前先在测试网练手、小额试。本文是知识科普，不是投资建议。

---

## 一、“从一条链 Mint 到另一条链”，到底是哪两种意思

标题里的“Mint 到另一条链”，其实有两种做法，动手之前先分清楚，不然写到一半会发现合约结构对不上。

| 做法 | 是什么样的 | NFT 先出现在哪条链 |
| --- | --- | --- |
| **先 Mint，再搬过去** | 源链上 Mint 一张 NFT，再调跨链函数把它搬到目标链 | 源链：先有，再烧掉；目标链：收到消息再铸出来 |
| **直接在目标链上 Mint** | 源链上只发一条消息，目标链收到消息才 Mint | 源链：从来没有过；目标链：收到消息才第一次出现 |

第一种是这篇的主线，也是 37 篇那份合约干的事：Sepolia 上 Mint，搬到 Fuji。第二种是 QuickNode 那篇教程的做法：源链上一个发送合约（SourceMinter），目标链上一个接收合约（DestinationMinter）加一个 NFT 合约（MyNFT），用户在源链上付费、目标链上 Mint。两种做法的消息长得一样，区别只在源链上有没有先 Mint 那一步。

还有一点要先说清楚：**NFT 不能走 CCIP 的 Token 转移通道**。CCIP 的 Token 转移只支持 ERC20，靠的是 CCT 那套 Token 池（BurnMint 池、LockRelease 池）；NFT 走的是另一条路——**任意消息**，消息里只带数据、不带 Token，`tokenAmounts` 是空数组。37 篇的 `crossChainTransferFrom` 就是这么写的：`data` 里装 `from`、`to`、`tokenId`、`tokenUri`，Token 一个都不带。ChainHop 那套跨链桥也是这个做法，文档里写得很明白：所有消息的 `tokenAmounts` 都是空的，资产的移动是桥自己的记账，不是 CCIP 的 Token 转移。

所以这篇讲的“跨链 Mint”，本质上是：**Mint 是一次普通操作，跨链是一次消息传递，两件事拼在一起**。

---

## 二、先把路线图画出来：整条链路分几步

把 37 篇的合约、两条链、CCIP 的角色摆在一起，全程是下面这张图：

```
Sepolia（源链）                                    Fuji（目标链）
┌─────────────────────────┐                         ┌─────────────────────────┐
│ CrosschainNFT 合约 A     │                         │ CrosschainNFT 合约 B     │
│                         │                         │                         │
│  1. mint()              │                         │                         │
│     铸出 tokenId 0       │                         │                         │
│         │               │                         │                         │
│  2. crossChainTransfer  │                         │                         │
│    From(...)            │                         │                         │
│     先读 tokenURI        │                         │                         │
│     再烧掉 tokenId 0     │                         │                         │
│         │               │                         │                         │
│  3. Router.ccipSend     │                         │                         │
│     问价 getFee          │                         │                         │
│     拿到 messageId  ─────┼──── CCIP ────────────►│  5. Router 调          │
│         │               │    等终局、验证、执行     │     ccipReceive         │
│                         │                         │     验源链、验发送方     │
│                         │                         │         │               │
│                         │                         │  6. _safeMint(to, 0)  │
│                         │                         │     写回同一份 tokenURI  │
└─────────────────────────┘                         └─────────────────────────┘
         ▲                                                      │
         │  4. 拿着 messageId 去 Explorer 查状态                  │
         └──────────────────────────────────────────────────────┘
```

整个流程里，你要亲手做的只有三件事：**Mint、发消息、查状态**。中间那段“等终局、验证、执行”，是 CCIP 帮你跑的，你干预不了，只能等、只能查。

| 步骤 | 在哪条链 | 谁在干活 | 你要等多久 |
| --- | --- | --- | --- |
| 1. Mint | Sepolia | 你调 `mint()` | 一个交易确认 |
| 2. 烧掉 + 发消息 | Sepolia | 你调 `crossChainTransferFrom` | 一个交易确认 |
| 3. 等源链终局 | Sepolia → CCIP | 验证节点等 Sepolia 完整终局 | 约 12.8 分钟 |
| 4. 验证 + 执行 | Fuji | 验证节点签名、默认执行器提交 | 几分钟 |
| 5. 收到 NFT | Fuji | `_ccipReceive` 铸出来 | 一个交易确认 |

第 3 步那个 12.8 分钟，是 Sepolia 完整终局要等的时间（64 个区块 × 12 秒）。这段时间里，Sepolia 上的 NFT 已经烧掉了，Fuji 上那张还没出现——**这是正常的**，不是卡住了，也不是丢了。

---

## 三、第一步：在源链上 Mint，先把 NFT 拿到手

动手之前，先确认 37 篇那份合约已经按第八节的顺序部署好了：Sepolia 和 Fuji 各一份，互相调过 `enableChain` 登记了对方，Sepolia 那份合约里已经转进了一点 LINK。缺一步，后面都会在奇怪的地方报错。

先在 Sepolia 上 Mint：

```
1. 打开 Sepolia 那份 CrosschainNFT 合约
2. 调 mint()
3. 记下铸出来的 tokenId（比如 0）
```

Mint 完先去 Sepolia 的浏览器上验一下：按 tokenId 查到这张 NFT，确认持有人是你、tokenURI 指向你那份 metadata。**这一步别省**——如果 Mint 出来的 metadata 本来就是错的，后面搬到 Fuji 的也是错的，跨链不会帮你修 metadata。

这里有个经常犯的错：**Mint 完直接就调跨链函数，忘了先往合约里转 LINK**。费用是从合约余额里扣的，不是你钱包里直接扣。合约里没有 LINK，`crossChainTransferFrom` 直接 revert `NotEnoughBalanceForFees`。部署完之后，先给 Sepolia 的合约地址转一点 LINK，再发第一条消息。转给谁？转给**合约地址 A**，不是转给 Router，37 篇第五节讲过。

还有一个检查点：Mint 只能在 Sepolia 上调。37 篇的 `mint()` 带 `onlyHomeChain` 限制，Fuji 上调会直接 revert。这是有意设计的：两边都能 Mint，tokenId 会撞车。只让“老家”那条链 Mint，tokenId 只在老家产生，永远不会撞。

---

## 四、第二步：发消息——烧掉、问价、拿到 messageId

Mint 完了，就可以发消息了。调 `crossChainTransferFrom`，五个参数一个一个填：

```
crossChainTransferFrom(
  你的地址,            // from：原来是谁的
  你的地址,            // to：搬过去给谁
  0,                  // tokenId：搬哪一张
  14767482510784806043, // Fuji 的 chain selector
  0                   // PayFeesIn.LINK = 0，用 LINK 付费
)
```

调完之后，合约里依次发生四件事，37 篇第五节已经拆开讲过，这里只强调动手时最容易出问题的地方：

**先问价，再发送。** 合约先调 `getFee` 问一次价，拿到费用再决定怎么付。费用是多少，别凭记忆估——**以 `getFee` 当场返回的为准**，跨链费会跟着网络情况变。LINK 付费要先 `approve` 给 Router 足够的额度；原生币付费就把币放在 `msg.value` 里。

**messageId 一定要记下来。** 调完之后交易回执里会返回一个 `messageId`，这串 32 字节的哈希就是这条消息的身份证。后面查状态、手动执行、出了问题找人问，靠的都是它。没记下来，就去源链那笔交易的日志里找 `CCIPMessageSent` 事件，里面有。

**发完别急着发第二遍。** 这是最容易出现的问题：消息还没到，你一着急又调了一次 `crossChainTransferFrom`。第一次那张已经烧掉了，第二次调的时候 tokenId 已经不存在，直接 revert，倒还好；怕的是你第一次 Mint 了两张、或者流程没走对，重复发可能烧掉两张、铸出两张。先去查状态，确认卡在哪一步再说。

---

## 五、第三步：消息在路上——它到底走到哪一步了

消息发出去了，接下来它要经过 CCIP 的几个阶段。官方 SDK（`@chainlink/ccip-sdk`）和 CCIP Explorer 看到的状态是一套，名字是下面这几个：

| 状态 | 是什么意思 | 你要做什么 |
| --- | --- | --- |
| `SENT` | 源链上交易已提交，等源链确认 | 等 |
| `SOURCE_FINALIZED` | 源链交易已确认、达到终局，可以开始处理了 | 等 |
| `COMMITTED` | 消息已提交到目标链的提交存储，等执行 | 等 |
| `BLESSED` | 验证网络已经批准这条消息，可以执行了 | 等 |
| `SUCCESS` | 目标链上执行成功，NFT 已铸出来 | 去目标链验货 |
| `FAILED` | 目标链上执行失败了，但可以手动重试 | 看第六节，诊断、手动执行 |

查状态有两个办法。最省事的是打开 CCIP Explorer（ccip.chain.link），粘贴 messageId 或者源链交易哈希，直接看这条消息走到哪一步。想写进自己脚本里查的，用官方 SDK：

```
import { EVMChain, MessageStatus } from '@chainlink/ccip-sdk'

const chain = await EVMChain.fromUrl('https://rpc.sepolia.org')
const request = await chain.getMessageById('0x你的messageId...')

console.log('状态：', request.metadata.status)
console.log('目标链执行交易：', request.metadata.receiptTransactionHash)
console.log('送达耗时：', request.metadata.deliveryTime, '毫秒')
```

官方文档给的轮询写法是：一直查，直到状态变成 `Success` 或 `Failed`，超时时间设 30 分钟。消息刚发出去那几秒，API 可能还没索引到，会报找不到——等几秒再查一次就行，不是出问题了。

命令行也行。官方的 `ccip-cli` 有三个命令专门干这个：`ccip-cli show` 查状态，`ccip-cli parse` 解失败原因，`ccip-cli manual-exec` 手动执行。`show` 后面既可以跟源链交易哈希，也可以跟 messageId。

这里要提醒一句：**源链交易成功，不等于送达成功**。源链上那笔交易只是“消息发出去了”，NFT 是不是在目标链上铸出来了，要看目标链上的执行状态。只看源链交易成功就以为完事了，是新手最容易误判的地方。

---

## 六、第四步：在目标链上验货，再把 NFT 搬回来

状态变成 `SUCCESS` 之后，去 Fuji 的浏览器上查：按 tokenId 找到那张 NFT，确认三件事：

| 查什么 | 应该是什么样 |
| --- | --- |
| 持有人 | 是你填的那个 `to` 地址 |
| tokenId | 和源链上烧掉的是同一个编号 |
| tokenURI | 和原来那张指向同一份 metadata |

三件都对上了，第一次跨链就跑通了。有一件不对，先别急着再发一次——去 Explorer 上看那条消息的执行交易回执，里面有接收方合约抛出的具体错误。

### 再搬回来：一次完整的往返

搬过去了，还要能搬回来，才算完整。往返的流程和去程一模一样，只是方向反过来：

```
Fuji 上调 crossChainTransferFrom(
  你的地址, 你的地址, 0,
  16015286601757825753,  // Sepolia 的 chain selector
  0                      // 用 LINK 付费
)
```

Fuji 上烧掉那张，Sepolia 上再铸出来，tokenId 还是 0。**往返也要再付一次跨链费**，而且这次的费用是从 Fuji 那份合约的余额里扣的——所以部署的时候，两边合约里都要留一点 LINK，只给一边充，回来那程发不出去。

往返还有两个坑，是去程不容易碰到的：

**消息有顺序，别乱插队。** CCIP 对同一个发送方发出的消息强制按顺序执行。如果前面有一条消息执行失败了，后面那条会被堵住，一直等到前面那条处理完。失败的消息要先处理（手动执行或者修好重发），后面的才能继续走。急着连发两条，前面那条一失败，后面那条也跟着卡住。

**失败了可以手动执行。** 状态变成 `FAILED`，先用 `ccip-cli show` 看失败原因，再用 `ccip-cli parse` 解那段返回数据，找到具体是哪个环节 revert 的。最常见的原因是 Gas 上限给太低：`_ccipReceive` 里 `_safeMint` 加 `_setTokenURI` 的 Gas 不够。修好之后（比如把 Gas 上限调高、重新登记一次 `enableChain`），用 `ccip-cli manual-exec` 加 messageId 手动执行一次，不用重新发消息、不用重新付一次跨链费。默认执行器对失败的消息会在 8 小时内重试，8 小时还没成功，就要自己动手了。

---

## 七、另一条路线：lock-and-mint——原件锁起来，搬过去的是包装版

37 篇选的是 burn-and-mint：源链上烧掉，目标链上重新铸。但还有另一条路线，下一篇预告里提过，这节把它讲清楚。

lock-and-mint 的做法是：**原件不烧，锁进一个金库合约里；目标链上铸出来的是一张“包装版”**。想拿回原件的时候，把包装版烧掉，金库再把原件放出来。

|  | burn-and-mint（37 篇） | lock-and-mint |
| --- | --- | --- |
| 源链上的原件 | 烧掉，不存在了 | 锁进金库合约，还在 |
| 目标链上的是什么 | 按同一个 tokenId 重新铸的同一张 NFT | 包装版（Wrapped NFT），tokenId 一样、但合约地址不同 |
| 需要几个合约 | 一份合约，两边部署 | 两个合约：源链一个金库（NFTVault），目标链一个包装合约（WrappedNFT） |
| 对原 NFT 合约的要求 | 原合约必须能烧（要有 burn 的权限） | 金库只需要 `transferFrom` 的权限，用户 `approve` 一下就行，原合约不用改 |
| 搬回来 | 目标链烧掉，源链再铸 | 目标链烧包装版，金库解锁原件 |
| 适合什么时候 | NFT 是你自己的合约、能改、能烧 | NFT 是别人的合约（比如一个已经发行的收藏品）、改不了、烧不得 |

lock-and-mint 有一个 burn-and-mint 没有的好处：**金库是“收藏品无关”的**。Jacek 那篇博客（2026 年 6 月 29 日）就是这么做的：金库只管收 NFT、锁起来、发消息，根本不管这张 NFT 是哪个系列的；目标链上的包装合约收到消息就铸一张包装版。整个往返已经在 Sepolia 和 OP Sepolia 之间实测跑通过：Sepolia 上锁、OP Sepolia 上铸包装版，再烧包装版、Sepolia 上解锁原件。

还有一个实际在跑的例子是 ChainHop：每个链上一个金库，ERC20 和 ERC721 各一套，金库之间只用 CCIP 的任意消息通信，消息里同样不带 Token。它的规则写得很明白：**从“老家”出发是锁、回来是烧包装版解锁，去第三条链是烧包装版再铸新的包装版**。原件永远只锁在老家那条链的金库里，不会到处跑。

两条路线怎么选？记住一条：**NFT 合约是你自己的、能改、能烧，burn-and-mint 最简单；NFT 是别人的、改不了，lock-and-mint 是唯一能走的路**。这篇先把 burn-and-mint 跑通，lock-and-mint 的合约写法留到以后单开一篇讲。

---

## 八、最容易踩的坑

### 1. 以为源链交易成功就是送达成功

源链上那笔交易只是“消息发出去了”。NFT 是不是在目标链上铸出来了，要看目标链上的执行状态。拿着 messageId 去 Explorer 上查到 `SUCCESS`，再去目标链浏览器上验货，这才算完。

### 2. 合约里没 LINK 就发消息

费用是从合约余额里扣的。部署完忘了往合约里转 LINK，`crossChainTransferFrom` 直接 revert。往返两程都要付费，两边合约里都要留 LINK。

### 3. 只配了一边的白名单

Sepolia 上配了 Fuji，Fuji 上忘了配 Sepolia。消息发过去了，接收方一查通讯录：发送方不在里面，拒收。部署完两边都要调 `enableChain`，缺一边都不行。

### 4. 等不及就重复发一次

消息还没到就再发一次。第一次那张已经烧掉了，第二次直接 revert，倒还好；怕的是流程没走对，重复发烧掉两张、铸出两张。先去 Explorer 上查状态，确认卡在哪一步再说。

### 5. 前面一条失败了，后面全堵住

CCIP 对同一个发送方的消息强制按顺序执行。前面一条执行失败，后面那条会被堵住。先处理失败的那条（手动执行或者修好重发），后面的才能继续走。

### 6. Gas 上限给太低，消息变 FAILURE

`_ccipReceive` 里 `_safeMint` 加 `_setTokenURI` 的 Gas 不够，消息在目标链上执行失败。好在失败可以重试：把 Gas 上限调高，重新发一次就行；或者直接用 `ccip-cli manual-exec` 手动执行。但重新发要重新付一次跨链费，所以动手之前先在测试网实测实际用量。

### 7. 想用 CCIP 的 Token 转移通道搬 NFT

CCIP 的 Token 转移只支持 ERC20，靠 CCT 的 Token 池。NFT 只能走任意消息通道，消息里只带数据、不带 Token，`tokenAmounts` 是空数组。照着 Token 转移的教程去搬 NFT，接口根本对不上。

### 8. 两边都能 Mint，tokenId 撞了

37 篇讲过：计数器两边都从 0 开始数，搬过去的时候发现目标链上这个 tokenId 已经有人了，`_safeMint` 直接 revert。只让“老家”那条链 Mint，或者给两边分号段。

### 9. 搬给一个不会收 NFT 的合约地址

`_safeMint` 的 `to` 如果是合约地址，它必须实现 `onERC721Received`，不然铸造 revert、消息变 FAILURE。搬给自己的钱包地址就没这个问题。

### 10. 往 11 月 30 日后停用的链上发

36 篇讲过：2026 年 11 月 30 日起，Corn、Core、Metal、Zora、Abstract、Edge、Lisk、Lens、Merlin、Superseed 和 B2 Mainnet 这 11 条链不再支持 CCIP。动手之前先确认目标链还在支持列表里，别在要停用的链上搭新合约。

---

## 总结

- **两种“跨链 Mint”**：先在源链 Mint 再搬过去（这篇的主线），和直接在目标链上 Mint（源链只发消息）。NFT 不能走 CCIP 的 Token 转移通道，只能走任意消息，消息里只带数据、不带 Token。
- **全程五步**：源链 Mint → 烧掉、问价、发消息 → 等源链终局（Sepolia 约 12.8 分钟）→ 验证、执行 → 目标链上收到同一张 NFT（同一个 tokenId、同一份 metadata）。
- **查状态靠 messageId**：CCIP Explorer 粘贴 messageId 或源链交易哈希就能查；想写进脚本就用 `@chainlink/ccip-sdk` 的 `getMessageById` 轮询；命令行用 `ccip-cli show / parse / manual-exec`。状态走到 `SUCCESS` 才算完，源链交易成功不等于送达成功。
- **往返要再付一次费**：回来那程从目标链合约的余额里扣，两边合约里都要留 LINK；同一发送方的消息按顺序执行，前面一条失败会堵住后面的，失败了可以手动执行。
- **另一条路是 lock-and-mint**：原件锁进金库、目标链铸包装版，适合 NFT 合约改不了、烧不得的情况；NFT 合约是你自己的，burn-and-mint 更简单。
- **最容易踩的坑**：合约里没 LINK、只配一边白名单、等不及重复发、Gas 上限给太低、想用 Token 转移通道搬 NFT、往 11 月 30 日后停用的链上发。

---

## 下一篇是第 39 篇：

[[y7blog-web3-40]]

这篇把 NFT 搬到了另一条链，下一篇让 NFT 自己“看行情”：用 Chainlink Data Feeds 把 BTC/USD 的价格读进合约，价格涨了换一张笑脸，跌了换一张哭脸——动态 NFT 那篇讲的想法，这次真的动手做出来。

*参考资料：Chainlink 官方文档《Tracking Messages》（docs.chain.link/ccip/tools/sdk/guides/tracking-messages；消息生命周期 SENT / SOURCE_FINALIZED / COMMITTED / BLESSED / SUCCESS / FAILED、@chainlink/ccip-sdk 的 getMessageById 与轮询写法、30 分钟超时示例）；Chainlink 官方文档《Debugging Failed Messages》（docs.chain.link/ccip/tools/cli/guides/debugging-workflow；ccip-cli show / parse / manual-exec、UNTOUCHED / IN_PROGRESS / SUCCESS / FAILURE、同一发送方消息按顺序执行、失败消息可手动重试）；Chainlink 官方文档《Message / MessageStatus》（docs.chain.link/ccip/tools/api/v1/schemas/message、docs.chain.link/ccip/tools/sdk/variables/MessageStatus；messageId 由源链、目标链、消息内容、序号与 nonce 哈希生成、receiptTransactionHash 与 ready_for_manual_execution 字段）；Chainlink 官方文档《CCIP starter kit examples map》（docs.chain.link/chainlink-local/learn/starter-kit-examples，2026-11-19 发布；Foundry 与 Hardhat 3 套件、Example01–Example10、Chainlink Local v0.3.1、@chainlink/contracts-ccip 2.0.0、solc 0.8.26）；Jacek's Blog《Bridging NFTs Cross-Chain with Chainlink CCIP》（blog.varkiwi.com/2026/06/29/NFT-bridging-with-CCIP.html，2026-06-29；lock-and-mint 实测、NFTVault + WrappedNFT、Sepolia 到 OP Sepolia 往返、双向白名单、金库只需要 transferFrom 权限）；QuickNode《How to Mint an NFT Across Different Blockchains using Chainlink CCIP》（quicknode.com；MyNFT + SourceMinter / DestinationMinter 三合约写法、Polygon Amoy 到 Avalanche Fuji、直接在目标链上 Mint 的做法；用的是 CCIP 1.5 时代的合约包，接口细节以 2.0 文档为准）；ChainHop / Armory 文档《Bridge overview》《How a hop works》（armory.trade/docs/bridge/overview、armory.trade/docs/bridge/how-a-hop-works；CCIP 任意消息、tokenAmounts 为空数组、从老家出发锁、回来烧包装版解锁、原件永远锁在老家金库）；Chainlink 官方文档《CCT - getCCIPAdmin() token with Burn and Mint Pool in forked environments》（docs.chain.link/chainlink-local/build/ccip/foundry/cct-burn-and-mint-fork；CCIP Token 转移只支持 ERC20、BurnMint 池要求 mint / burn / burnFrom、TokenAdminRegistry 注册流程）；OpenZeppelin《Introducing OpenZeppelin Contracts 5.7》（openzeppelin.com，2026-07-30；BridgeERC721、ERC721Crosschain，基于 ERC-7786 的跨链桥）；37 篇《如何创建 CCIP 跨链 NFT 合约？》（CrosschainNFT 合约、burn-and-mint、Sepolia ↔ Fuji、ExtraArgsV3、Chainlink Local v0.3.1、Sepolia 完整终局约 12.8 分钟、默认执行器 8 小时内重试失败消息）。*
