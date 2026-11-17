---
title: 27｜从 Avalanche Fuji 到 Ethereum Sepolia：完整跨链实战
published: 2026-11-03
pinned: false
draft: false
comment: true
description: 这篇把跨链拼成一次真正的实战：从 Avalanche Fuji 到 Ethereum Sepolia，用 Remix 部署一对收发合约，先后用 LINK 和 AVAX 付两次手续费，把 0.001 个 CCIP-BnM 和一句 Hello World! 送过去，再到 CCIP Explorer 上查状态、在 Sepolia 上验收到账。全部只用测试网，跟着做一遍，跨链就不再是只听过没做过的事。
image: https://www.y7img.ccwu.cc/file/1794795386361_y7blog-web3-28-1600.png
tags: [CCIP,跨链,实战,Avalanche Fuji,Sepolia]
category: Web3
slug: blog/y7blog-web3-28
series: "区块链百科"
seriesOrder: 1
---

钱包、合约、手续费都准备好了，现在只剩最后一件事没做过：**真的动手跨一次。**

这篇就带你走完一次完整的跨链：把 0.001 个 CCIP-BnM 和一句 `Hello World!` 从 Avalanche Fuji 发到 Ethereum Sepolia。先用 LINK 付一次手续费，再用 AVAX 付一次，两种方式都试一遍。最后在 CCIP Explorer 上查到这笔跨链，再到 Sepolia 上亲手验收到账。

**全程只用测试网，不花真钱。跟着做一遍，跨链就不再是只听过、没做过的事。**

> 💡 **先说清楚**：本文只讲测试网上的跨链实操，不涉及任何真实资产，不推荐你去买任何 Token，更不构成投资建议。**本文是知识科普，不是投资建议。** 动手之前，先确认钱包切的是测试网；主网操作请先在测试网完整走一遍，再用你输得起的金额尝试。

---

## 一、这次要干什么？先看路线图

先把整件事画出来，再动手。一次跨链里，有四个角色：

```
你的钱包 (MetaMask)
   │ ① 部署合约、充值
   ▼
发送合约 @ Avalanche Fuji
   │ ② sendMessagePayLINK / sendMessagePayNative
   ▼
CCIP 路由器 (Fuji) ──→ 验证网络 (CCV) ──→ CCIP 路由器 (Sepolia)
   │ ③ 0.001 CCIP-BnM 在 Fuji 被烧掉
   ▼
接收合约 @ Ethereum Sepolia
   │ ④ _ccipReceive：收到 0.001 CCIP-BnM（新铸）+ "Hello World!"
```

这里有三个第一次接触的人容易懵的点，先讲清楚：

**第一，为什么要部署两个合约？** 因为发送和接收是两条链上各自的活。Fuji 上的合约负责“寄”，Sepolia 上的合约负责“收”。官方教程里用的是同一个合约代码 `ProgrammableTokenTransfers`，在两条链上各部署一份——同一份代码，部署两次，扮演两个角色。

**第二，为什么 Token 在 Fuji 上“烧掉”，在 Sepolia 上又“出现”？** CCIP-BnM 是一种 Burn & Mint（烧铸）测试 Token：源链上的 Token 池把你发出的 Token 烧掉，目标链上的 Token 池再铸出等量的 Token 发给接收方。Token 本身没有“跑”过链，跑过链的是一条经过验证的消息，消息到了，目标链才按消息铸币。这就是第 22 篇讲 CCIP 架构时提到的 Token 池机制。

**第三，为什么要带一句话过去？** 只跨 Token，叫 Token 跨链；Token 加一段数据一起跨，叫可编程跨链（Programmable Token Transfers）。带上 `Hello World!` 这句话，是为了让你亲眼看到：跨链不只能搬 Token，还能顺便给目标链上的合约传一句话、触发一段逻辑。后面几篇讲跨链 NFT，用的就是这个本事。

---

## 二、出发前：钱包里要备齐的四样东西

动手之前，先把钱包里的东西备齐。缺任何一样，后面都会卡住：

| 要准备的 | 在哪条链 | 用来干什么 | 从哪领 |
|---|---|---|---|
| Fuji AVAX | Avalanche Fuji | Fuji 上的 Gas；第二轮还用来付 CCIP 手续费 | faucet.avax.network |
| LINK | Avalanche Fuji | 第一轮付 CCIP 手续费 | faucets.chain.link |
| CCIP-BnM | Avalanche Fuji | 这次要跨过去的“包裹” | 调 `drip()` 领，每次 1 个 |
| Sepolia ETH | Ethereum Sepolia | Sepolia 上的 Gas（部署接收合约、查收时用） | faucets.chain.link 或 sepoliafaucet.com |

### 两条链的网络参数

第 24 篇讲过怎么在 MetaMask 里加网络，这里直接给两张参数表，照着填就行：

| 参数 | Avalanche Fuji | Ethereum Sepolia |
|---|---|---|
| Chain ID | 43113 | 11155111 |
| RPC | https://api.avax-test.network/ext/bc/C/rpc | https://rpc.sepolia.org |
| 区块浏览器 | testnet.snowtrace.io | sepolia.etherscan.io |
| 原生币 | AVAX | ETH |
| 出块 / 终局性 | 约 1–2 秒 | 约 12.8 分钟（两个 epoch） |

注意最后一行：**Fuji 的终局性只要 1–2 秒，Sepolia 却要约 12.8 分钟。** 这个差别直接决定了跨链要等多久，第六节会详细讲。

### CCIP-BnM 怎么领？

CCIP-BnM 是 Chainlink 官方的跨链测试 Token，不用买，用 `drip()` 函数领：

1. 到 CCIP Directory（ccip.chain.link）找到 Fuji 上的 CCIP-BnM 合约地址：`0xD21341536c5cF5EB1bcb58f6723cE26e8D8E90e4`。
2. 在 Snowtrace（testnet.snowtrace.io）上打开这个合约，切到 Contract → Write Contract，连上钱包。
3. 调 `drip()` 函数，参数填你自己的钱包地址，确认交易。

一次只能领 1 个 CCIP-BnM，而且**大约每 3 小时才能领一次**。所以别等到最后一步才想起来领——先领够再动手。这次实战要跨 0.001 个，给合约充值时准备 0.002 个，领 1 个就绰绰有余了。

领完之后，记得在 MetaMask 里把 CCIP-BnM 添加为自定义 Token（填上面那个合约地址），不然钱包里看不到余额。

### 地址总表：出发前先核对一次

下面这张表，是这次实战要用到的全部地址，全部来自 Chainlink 官方文档和 CCIP Directory。**动手之前，再去 CCIP Directory 核对一次**——路由器地址会随协议升级而变，不要从聊天群、论坛帖子里复制地址：

|  | Avalanche Fuji | Ethereum Sepolia |
|---|---|---|
| Chain Selector（链选择器） | 14767482510784806043 | 16015286601757825753 |
| CCIP 路由器 | 0xF694E193200268f9a4868e4Aa017A0118C9a8177 | 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59 |
| LINK | 0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846 | 0x779877A7B0D9E8603169DdbD7836e478b4624789 |
| CCIP-BnM | 0xD21341536c5cF5EB1bcb58f6723cE26e8D8E90e4 | 0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05 |

> ⚠️ **关于 CCIP 2.0 的提醒**：现在的线上通道跑的是 CCIP 2.0，Sepolia 和 Fuji 各有一个专用的 2.0 路由器。上面这张表是官方 v1 教程里的路由器地址，旧路由器仍可经 `switchChainAndRouteMessage` 转发，但部署之前，务必以 CCIP Directory 里的最新地址为准。地址这东西，永远以官方目录为准，不要背。

---

## 三、部署：同一个合约，在两条链上各部署一份

### 合约是干什么的？

官方教程用的示例合约叫 `ProgrammableTokenTransfers`（Solidity 0.8.24），它同时会“寄”和“收”：

| 函数 | 干什么 |
|---|---|
| `sendMessagePayLINK(...)` | 用 LINK 付手续费，发 Token + 一段数据 |
| `sendMessagePayNative(...)` | 用原生币（AVAX）付手续费，发 Token + 一段数据 |
| `_ccipReceive(...)` | 收到跨链消息时被路由器调用，把收到的数据和 Token 存下来 |
| `getLastReceivedMessageDetails()` | 查最后一次收到的消息：messageId、文字、Token 地址、数量 |
| `allowlistDestinationChain / allowlistSourceChain / allowlistSender` | 白名单：允许往哪条链发、允许收哪条链、允许收谁发来的消息 |
| `withdraw / withdrawToken` | 合约主人把合约里剩下的原生币或 Token 取回来 |

合约继承了 `CCIPReceiver`，这是关键：`_ccipReceive` 只能由路由器调用，别人直接调是调不动的——这是 CCIP 自带的一道安全门，第四节还会讲到。

### 用 Remix 部署，第一份在 Fuji

1. 打开 Remix（remix.ethereum.org），新建一个文件，把官方教程的 `ProgrammableTokenTransfers` 完整代码粘贴进去（全文见文末参考资料里的官方教程链接）。
2. 编译：Solidity 版本选 0.8.24。
3. 切到 Deploy & Run Transactions，环境选 Injected Provider - MetaMask，确认 MetaMask 当前是 **Avalanche Fuji**。
4. 部署时填两个构造参数：`_router` 填 Fuji 路由器地址，`_link` 填 Fuji LINK 地址。
5. 点 transact，MetaMask 确认。部署成功后，在 Deployed Contracts 里记下合约地址——后面几步都要用它。

### 第二份在 Sepolia

同一份代码，再部署一次：

1. MetaMask 切到 **Ethereum Sepolia**。
2. 构造参数换成 Sepolia 的：`_router` 填 Sepolia 路由器地址，`_link` 填 Sepolia LINK 地址。
3. 部署，记下这个合约地址。

到这里，你手里应该有两个合约地址：一个在 Fuji（发送方），一个在 Sepolia（接收方）。**别把两个地址搞混，后面填参数的时候，_receiver 填的是 Sepolia 那个。**

---

## 四、互相打招呼：白名单三步

合约部署好了，还不能直接跨。先要让两边的合约“互相打招呼”——也就是设置白名单。

**为什么需要白名单？** 想想看，如果没有白名单，任何人都能往你的接收合约里发消息、塞 Token，你的合约就成了公共收件箱。白名单就是收件规则：只收你认的人、从你认的链发来的消息。发送那边也一样：只往你允许的目标链发，防止手滑把 Token 发到一条不支持的链上。

一共三步，每一步都是一笔链上交易，都要付 Gas：

### 第 1 步：在 Fuji 的合约上，允许往 Sepolia 发

在 Remix 里打开部署在 Fuji 上的合约，调 `allowlistDestinationChain`：

| 参数 | 填什么 |
|---|---|
| `_destinationChainSelector` | 16015286601757825753（Sepolia 的链选择器） |
| `allowed` | true |

### 第 2 步：在 Sepolia 的合约上，允许收 Fuji 发来的消息

切到 Sepolia，在 Remix 里打开部署在 Sepolia 上的合约，调 `allowlistSourceChain`：

| 参数 | 填什么 |
|---|---|
| `_sourceChainSelector` | 14767482510784806043（Fuji 的链选择器） |
| `allowed` | true |

### 第 3 步：在 Sepolia 的合约上，允许收 Fuji 那个合约发来的消息

还是在 Sepolia 的合约上，调 `allowlistSender`：

| 参数 | 填什么 |
|---|---|
| `_sender` | 你部署在 Fuji 上的合约地址 |
| `allowed` | true |

**最容易搞混的一点：** 第 1 步是在 Fuji 的合约上做，第 2、3 步是在 Sepolia 的合约上做。链选择器也别填反——`allowlistDestinationChain` 里填的是**目标链 Sepolia** 的选择器，`allowlistSourceChain` 里填的是**源链 Fuji** 的选择器。填反了，交易会直接 revert，白名单设不上。

---

## 五、第一轮：用 LINK 付费，把 Token 跨过去

白名单设好了，开始发。第一轮用 LINK 付手续费。

### 先给 Fuji 的合约充值

发送之前，合约里得有两样东西：

1. **转 70 个 LINK 给 Fuji 的合约**——这是官方教程里的例子。注意，这个数字是 Sepolia Gas 飙高时期的例子，不是固定价。实际要多少，先调 `getFee()` 问价（上一篇文章讲过的方法），按报价多备一点就行。
2. **转 0.002 个 CCIP-BnM 给 Fuji 的合约**——这次要跨 0.001 个，多备一倍当余量。

**转给谁？转给你部署在 Fuji 上的合约地址。** 不是转给路由器，也不是留在自己钱包里。合约余额不够，`sendMessagePayLINK` 会直接 revert，这是经常犯的错。

### 调 sendMessagePayLINK

在 Remix 里打开 Fuji 上的合约，调 `sendMessagePayLINK`，填五个参数：

| 参数 | 填什么 | 说明 |
|---|---|---|
| `_destinationChainSelector` | 16015286601757825753 | Sepolia 的链选择器 |
| `_receiver` | Sepolia 合约地址 | 接收方合约的地址 |
| `_text` | Hello World! | 要捎过去的一句话，任意字符串都行 |
| `_token` | 0xD21341536c5cF5EB1bcb58f6723cE26e8D8E90e4 | Fuji 上的 CCIP-BnM 地址 |
| `_amount` | 1000000000000000 | 0.001 个 CCIP-BnM |

`_amount` 为什么是这么大一串数字？因为 CCIP-BnM 是 18 位小数的 Token，链上只认最小单位：0.001 × 10¹⁸ = 10¹⁵，也就是 1000000000000000。填错位数，跨过去的数量就全错了——多填三个 0，你就跨了 1 个而不是 0.001 个。

点 transact，MetaMask 确认。交易成功后，**记下交易哈希**，查状态要用。

### 合约内部依次做了什么？

你点一次确认，合约里其实按顺序做了六件事：

```
① _buildCCIPMessage：把接收地址、文字、Token、数量组装成一条 CCIP 消息
     其中 extraArgs 里写着 gasLimit: 200_000（目标链上执行接收逻辑的 Gas 上限）
     和 allowOutOfOrderExecution: true（允许乱序执行）
   ↓
② router.getFee：问路由器，这次跨链要收多少手续费
   ↓
③ 检查合约里的 LINK 余额够不够付手续费
   ↓
④ s_linkToken.approve：授权路由器从合约里扣 LINK 手续费
   ↓
⑤ IERC20(_token).approve：授权路由器从合约里扣 0.001 个 CCIP-BnM
   ↓
⑥ router.ccipSend：正式发送，返回 messageId（跨链消息的唯一编号）
```

注意第④步和第⑤步是两次不同的授权：一次授权 LINK（付手续费），一次授权 CCIP-BnM（要跨的 Token）。上一篇文章讲过，一次跨链可能要做两次授权，就是这个原因。

还有一个细节：如果你要跨的 Token 恰好就是 LINK，合约会把手续费和要跨的数量加在一起算（`requiredLinkBalance = fees + _amount`），因为两笔钱都是从同一个 LINK 余额里扣。

---

## 六、查收：消息到哪了？到了没有？

发出去之后，先别急着刷新 Sepolia 的余额。跨链不是秒到的，先去查状态。

### 在 CCIP Explorer 上查

打开 CCIP Explorer（ccip.chain.link），把 Fuji 那笔交易的哈希粘贴进去搜索，就能看到这笔跨链消息的状态。状态变成 **Success**，才算真正完成。

### 要等多久？

这是新手最常问的问题。答案取决于一个因素：**源链要多久才能终局。**

CCIP 默认要等源链上的交易完全终局，才会验证消息、铸币、执行。所以：

| 方向 | 为什么 | 大概要等多久 |
|---|---|---|
| Fuji → Sepolia（本次） | Fuji 终局只要 1–2 秒 | 一般几分钟（CCIP 验证、执行还要 1–5 分钟） |
| Sepolia → Fuji（反方向） | Sepolia 终局要约 12.8 分钟 | 通常 15–20 分钟 |

所以 Fuji → Sepolia 这个方向是比较快的，因为 Fuji 终局快。反过来从 Sepolia 往 Fuji 跨，就要多等一刻钟——不是 CCIP 变慢了，是 Sepolia 自己的终局时间摆在那。

> 💡 **CCIP 2.0 的新变化**：现在可以选更快的终局性（Faster-Than-Finality）。比如 Ethereum 的快速确认规则，能把等待从约 13 分钟压到 12–24 秒。但这是可选项，默认还是等完全终局。对新手来说，先用默认设置走通一次，再研究快速通道也不迟。

### 在 Sepolia 上验收到账

Explorer 显示 Success 之后，切到 Sepolia验证：

1. 在 Remix 里打开部署在 Sepolia 上的合约，调 `getLastReceivedMessageDetails()`。
2. 应该看到四样东西：

| 查到的内容 | 应该是什么 |
|---|---|
| messageId | 和 Fuji 那边返回的 messageId 一模一样 |
| text | Hello World! |
| tokenAddress | 0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05（Sepolia 上的 CCIP-BnM） |
| tokenAmount | 1000000000000000（0.001 个） |

**注意 tokenAddress 那一行：** Sepolia 上收到的 CCIP-BnM 地址，和 Fuji 上发出的不一样——Fuji 的是 `0xD213…`，Sepolia 的是 `0xFd57…`。Fuji 的那 0.001 个已经被烧掉了，Sepolia 的这 0.001 个是收到消息后新铸的。查收之前，先在 MetaMask 里把 Sepolia 的 CCIP-BnM 添加进去，不然钱包里看不到余额。

如果 Explorer 显示 **Ready for manual execution**（等待手动执行），意思是默认执行器没有自动执行这条消息，你可以点手动执行——但要在 Sepolia 上再发一笔交易、付一笔 Gas。测试网上一般不会遇到，知道有这么个状态就行。

---

## 七、第二轮：用 AVAX 付费，再跨一次

第一轮走通了，第二轮换一种付费方式：用 Fuji 的原生币 AVAX 付手续费。

### 步骤

1. 给 Fuji 的合约转 **0.2 个 AVAX**（官方教程的例子，实际以 `getFee()` 问价为准）。
2. 在 Remix 里打开 Fuji 的合约，调 `sendMessagePayNative`，五个参数和第一轮完全一样：

| 参数 | 填什么 |
|---|---|
| `_destinationChainSelector` | 16015286601757825753 |
| `_receiver` | Sepolia 合约地址 |
| `_text` | Hello World!（也可以换一句，看看收到的是不是新内容） |
| `_token` | 0xD21341536c5cF5EB1bcb58f6723cE26e8D8E90e4 |
| `_amount` | 1000000000000000 |

3. 点 transact，确认。查状态、验收到账的方法和第一轮一样。

### 和第一轮有什么不同？

合约内部的步骤少了一步：不用提前 `approve` AVAX——因为原生币是随交易一起发过去的（`msg.value`），不像 ERC20 那样要先授权再扣款。所以 `sendMessagePayNative` 内部是五步，不是六步。

但有一个容易误解的点：**用 AVAX 付，不等于节点运营商收 AVAX。** CCIP 的费用本身是以 LINK 计价的，你付 AVAX，CCIP 会替你换算成 LINK 再付给节点运营商。上一篇文章讲过，用原生币付，协议费那部分要贵一成——这个规矩在这里同样适用。

|  | 用 LINK 付 | 用 AVAX 付 |
|---|---|---|
| feeToken 参数 | LINK 合约地址 | address(0)（表示原生币） |
| 要不要提前授权 | 要，先 approve LINK 给路由器 | 不用，原生币随交易一起发 |
| 确认次数 | 多一次 | 少一次 |
| 协议费 | 便宜一成 | 贵一成 |
| 适合 | 经常跨链、长期用 | 偶尔跨一次、图省事 |

---

## 八、不想写合约？还有一条不用代码的路

上面走的是“开发者路线”：部署合约、调函数。如果你只是想把 Token 从一条链跨到另一条链，不想写代码，还有一条路：

**Transporter**（transporter.chain.link），Chainlink 官方的跨链应用，底层就是 CCIP：

1. 连上钱包，选源链 Fuji、目标链 Sepolia。
2. 选要跨的 Token（比如 CCIP-BnM 或 USDC），填数量和接收地址。
3. 付费方式可以选 LINK 或原生币，确认发送。
4. 到 CCIP Explorer 上查状态，和前面一样。

**这条路适合谁？** 只是想把 Token 跨过去的人。不用部署合约、不用写代码，几分钟就能走完。

**不适合谁？** 想在目标链上自动执行合约逻辑的人——比如“Token 跨过去之后，顺便在目标链上调一个函数”。那就得写合约、走可编程跨链，也就是上面那条路。

提醒一句：Transporter 也是一个第三方界面，第一次用先小额试一次，确认到账再转大额。测试网上无所谓，主网上一定要这样。

---

## 九、新手最容易踩的六个坑

前面几节讲的都是“怎么做对”，这一节讲“怎么做错”。这六个坑，都是新手真实踩过的。

### 坑 1：链选择器写反了

Fuji 的是 14767482510784806043，Sepolia 的是 16015286601757825753。两串数字长得很像，填的时候最容易看花眼。

**怎么避开：** `allowlistDestinationChain` 里填的是目标链 Sepolia 的，`allowlistSourceChain` 里填的是源链 Fuji 的。填完先念一遍：目标填 16015…，源填 14767…。写反了交易会直接 revert，白名单设不上。

### 坑 2：白名单漏了一步

三步缺任何一步，消息都发不出去或者收不到。最常见的是忘了 `allowlistSender`——链放行了，发送方没放行，接收合约直接把消息拒了。

**怎么避开：** 发送之前，对着第四节的三步清单打勾：目标链放行了？源链放行了？发送方放行了？三步都打勾再发。

### 坑 3：给合约充值的地址搞错了

LINK 和 CCIP-BnM 是转给“你部署在 Fuji 上的合约地址”，不是转给路由器，也不是留在自己钱包里。

**怎么避开：** 充值之前，先确认你要转的地址，是不是 Remix 里 Deployed Contracts 显示的那个合约地址。合约余额不够，`sendMessagePayLINK` 直接 revert。

### 坑 4：CCIP-BnM 领不到就动手

`drip()` 一次只给 1 个，大约 3 小时才能再领一次。有人部署、充值做到一半，才发现钱包里没有 CCIP-BnM，只能干等三小时。

**怎么避开：** 动手之前先领，领完确认 MetaMask 里能看到余额，再开始部署。至少准备 0.002 个再出发。

### 坑 5：在 Sepolia 上用 Fuji 的 Token 地址查余额

两条链上的 CCIP-BnM 是两个不同的合约地址：Fuji 的是 `0xD213…`，Sepolia 的是 `0xFd57…`。拿 Fuji 的地址去 Sepolia 的浏览器上搜，是搜不到的。

**怎么避开：** 查收之前，先在 MetaMask 里把 Sepolia 的 CCIP-BnM（`0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05`）添加进去，再看余额。

### 坑 6：以为跨链是秒到，发出去就反复点发送

Fuji → Sepolia 一般几分钟，反方向要 15–20 分钟。有人等了一分钟没到账，以为失败了，又点一次发送——结果两笔都成功了，手续费扣了两次。

**怎么避开：** 发出去之后，先去 CCIP Explorer 查状态。状态没变成 Success 之前，不要重复发送。等，是跨链的一部分。

> ⚠️ **风险提示**：本文只讲测试网上的跨链实操，不构成任何操作建议或投资建议。跨链涉及真实资产的支出，不同链、不同方向、不同时间的费用差异很大。实际操作前请自行核实官方文档，先在测试网（比如 Fuji、Sepolia）上完整走一遍流程，再考虑主网——而且永远只用你输得起的金额。

---

## 总结

1. **一次完整的跨链，需要两个合约。** 同一份 `ProgrammableTokenTransfers` 代码，在 Fuji 上部署一份当发送方，在 Sepolia 上部署一份当接收方。
2. **部署之前，先把四样东西备齐：** Fuji AVAX（付 Gas）、LINK（付手续费）、CCIP-BnM（要跨的 Token）、Sepolia ETH（目标链 Gas）。CCIP-BnM 用 `drip()` 领，一次 1 个，约 3 小时领一次，别等到最后一步才想起来。
3. **白名单有三步，缺一不可：** Fuji 合约上允许往 Sepolia 发；Sepolia 合约上允许收 Fuji 的消息；Sepolia 合约上还要允许收 Fuji 那个合约发来的消息。链选择器别写反。
4. **发送就三步：** 充值（LINK + CCIP-BnM 转给 Fuji 合约）→ 调 `sendMessagePayLINK`（或 `sendMessagePayNative`）→ 记下交易哈希。合约内部先 `getFee()` 问价、再两次授权、最后 `ccipSend`。
5. **查收分两步：** 先到 CCIP Explorer（ccip.chain.link）上查状态，Success 才算完成；再到 Sepolia 上调 `getLastReceivedMessageDetails()`，核对 messageId、文字、Token 地址和数量。
6. **等多久，看源链的终局时间。** Fuji 终局只要 1–2 秒，所以 Fuji → Sepolia 一般几分钟；反方向 Sepolia → Fuji 要等 Sepolia 终局约 12.8 分钟，通常 15–20 分钟。
7. **不想写代码，可以用 Transporter。** 底层同样是 CCIP，适合只想把 Token 跨过去的人；想在目标链上自动执行逻辑，还是得走可编程跨链。

到这里，跨链这条线算是真正走通过了：从第 21 篇“什么是跨链”，到 22 篇 CCIP 架构、23 篇 USDC 跨链、25 篇授权、26 篇 LINK 手续费，再到这篇的完整实战——钱包、Token、授权、LINK、合约、CCIP，全都串起来了。

**下次再有人问你“跨链到底是怎么回事”，你可以直接回答他：**

**就是在 Fuji 上部署一个会“寄”的合约，在 Sepolia 上部署一个会“收”的合约，互相打好招呼，充好 LINK 和要跨的 Token，调一次 `ccipSend`，再到 CCIP Explorer 上看着它从 Fuji 烧掉、在 Sepolia 重新铸出来。几分钟，就跨过去了。**

---

## 下一篇是第 28 篇：

[[y7blog-web3-29]]

跨链这条线走完了，下一阶段换个主题：NFT。从“同质化”和“非同质化”说起，讲清楚 NFT 到底是什么、它和你已经熟悉的 ERC20 有什么根本区别。到时候见。

---

*参考资料：Chainlink CCIP 官方文档「Transfer Tokens with Data」（https://docs.chain.link/ccip/v1/evm/tutorials/programmable-token-transfers，2024-03-25 发布，2025-05-19 更新）关于 Fuji → Sepolia 可编程跨链全流程、ProgrammableTokenTransfers 合约、路由器与 LINK、CCIP-BnM 地址、链选择器、sendMessagePayLINK / sendMessagePayNative 六步与五步流程、gasLimit 200_000 与 CCIP Explorer 查收的说明；Chainlink CCIP 官方文档「Get Started with CCIP (EVM)」（https://docs.chain.link/ccip/evm/getting-started）关于 Fuji 与 Sepolia 双测试网准备、Sender / Receiver 合约与 Transporter 无代码跨链路径的说明；Chainlink CCIP 官方文档「CCIP Test Tokens」（https://docs.chain.link/ccip/v1/test-tokens，2025-08-19 更新）关于 CCIP-BnM / CCIP-LnM 两种测试 Token、drip() 每次领 1 个、约 3 小时限领一次的说明；Chainlink CCIP 官方文档「Finality by Chain」（https://docs.chain.link/ccip/concepts/execution-latency/finality-by-chain，2026-11-13 发布）关于 Avalanche 终局约 1–2 秒、Ethereum 约 12.8 分钟、CCIP 2.0 默认等源链完全终局与 Faster-Than-Finality 可选项的说明；Chainlink 官方文档「CCIP 2.0 behavior in Chainlink Local」（https://docs.chain.link/chainlink-local/learn/ccip-v2-local，2026-11-13 发布）关于线上通道已跑 CCIP 2.0、Sepolia 与 Fuji 各有专用 2.0 路由器、旧路由器经 switchChainAndRouteMessage 转发的说明；Avalanche 官方支持文档「How to connect to the Fuji Testnet?」（https://support.avax.network/en/articles/6224787-how-to-connect-to-the-fuji-testnet，2025-10-15）关于 Fuji Chain ID 43113、RPC https://api.avax-test.network/ext/bc/C/rpc 与官方水龙头 faucet.avax.network 的说明；Chainlink CCIP 2.0 更快终局性报道（Yellow，2026 年 10 月）关于 CCIP 2.0 可选快速确认通道（Ethereum 12–24 秒）与默认仍等完全终局的说明；Cyfrin Updraft「Chainlink CCIP Tokens」课程（https://updraft.cyfrin.io/courses/chainlink-fundamentals/chainlink-ccip-tokens/transferring-tokens-cross-chain-with-ccip-part-2）关于 CCIP Explorer 查收与 Sepolia 方向约 20 分钟等待的说明；CCIP Directory（https://ccip.chain.link）路由器、链选择器与支持 Token 的官方查询入口；Chainlink Transporter（https://transporter.chain.link）无代码跨链应用。*
