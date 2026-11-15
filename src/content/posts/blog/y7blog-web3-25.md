---
title: 24｜MetaMask 如何配置多个区块链网络？
published: 2026-10-31
pinned: false
draft: false
comment: true
description: MetaMask 里只有一个以太坊网络，怎么换到 Sepolia、Avalanche Fuji、Base Sepolia 去做测试？这篇文章从零讲清网络名、RPC、Chain ID、货币符号和浏览器这五个必填项，带你手动加上三条测试网，再讲 Chainlist 一键添加、切换网络后钱包里到底变了什么，以及经常踩的五个坑。不用多造钱包，同一个地址就能用多条链。
image: https://www.y7img.ccwu.cc/file/1794655217146_y7blog-web3-25-1600.png
tags: [MetaMask,多链配置,测试网,Sepolia,区块链入门]
category: Web3
slug: blog/y7blog-web3-25
series: "区块链百科"
seriesOrder: 1
---

准备先在测试网上练手：打开 MetaMask，想切到 Sepolia 去领点测试币——可钱包左上角只有一个以太坊主网，Sepolia 在哪？Avalanche Fuji、Base Sepolia 又在哪？这几个网络，要怎么加进来？

答案是给 MetaMask 加上新的网络。MetaMask 不是只属于一条链的钱包，它是一个可以同时装很多条链的钱包，只是默认只给你装了以太坊。**简单来说，钱包像一把钥匙，网络像不同的房间。** 同一把钥匙能开很多扇门，但每个房间里的东西是不一样的：Sepolia 房间里放的是 Sepolia ETH，Fuji 房间里放的是 Fuji AVAX，Base Sepolia 房间里放的是 Base Sepolia ETH。

> 💡 **先说清楚**：本文只讲怎么在测试网配置网络、切换网络，不教你操作任何真实资产，也不推荐你去用某个具体产品。**本文是知识科普，不是投资建议。** 全文只在测试网操作，先在测试网练手，不要用真实资产做实验。

---

## 一、为什么一个钱包要装多个网络？

先不用急着点设置，先把一个最基础的问题想清楚：**钱包和网络，到底是什么关系？**

换句话说，你的钱包地址，是不是只属于以太坊？

不是。只要是兼容以太坊虚拟机（EVM）的链，你的同一个地址在每条链上都存在。你在 Sepolia 上的地址，和在 Avalanche Fuji、Base Sepolia 上的地址，是同一个 0x 开头的地址。

所以，配置多个网络，不是给自己多造几个钱包，而是让同一个钱包学会去不同的房间。

### 一个地址，多条链

很多人一开始都会搞错，以为换一条链就要重新创建一个钱包、重新记一套助记词。

不用。**助记词只决定你的地址和私钥，不决定你在看哪条链。** 你在 MetaMask 里切换网络，地址不变，变的只是 MetaMask 现在去问哪条链：“这个地址在这条链上有多少钱？最近有什么交易？”

### 余额是按网络分的

你在 Sepolia 上领了测试币，不代表你在 Fuji 上也有钱。反过来也一样。

这也是为什么跨链不是直接把余额从一个房间挪到另一个房间，中间要经过锁定、销毁、铸造这些步骤。

### Gas 费的币也不一样

每条链收 Gas 费用的币不一样。Sepolia 和 Base Sepolia 收 ETH，Avalanche Fuji 收 AVAX。

**一句话记住：切换网络之前，先看一眼左上角现在是哪条链，再看一眼这条链的 Gas 币是什么。** 这一点，后面讲坑的时候还会再出现一次。

---

## 二、先搞懂五个必填项：网络名、RPC、Chain ID、货币符号、浏览器

手动添加网络时，MetaMask 会让你填一张表。这张表看起来有五个空，但其实每一项都有明确的分工。先把分工搞懂，再填就不会慌。

| 字段 | 它是干什么的 | 填错了会怎么样 |
|---|---|---|
| 网络名 | 给你自己看的名字，方便在下拉列表里认出来 | 只影响你认不认得出来，不影响交易本身 |
| RPC URL | MetaMask 用来跟这条链说话的地址 | 填错了，钱包读不到余额，也发不出去交易 |
| Chain ID | 这条链独一无二的身份证号 | 填错了，MetaMask 会拒绝保存，或者签名的交易发到错误的链上 |
| 货币符号 | 这条链 Gas 费用的币，比如 ETH、AVAX | 填错了，余额单位显示会乱，但链本身没变 |
| 浏览器 URL | 查交易、查地址的浏览器，比如 Etherscan | 不填也能用，填了更方便，点一下就能跳过去查 |

### RPC：钱包和链之间的电话线

RPC 的全称不用背，你只要记住一个比喻：**RPC 就是 MetaMask 打给区块链的电话号码。**

你点一下“切换到 Sepolia”，MetaMask 其实是在问 RPC：“Sepolia 上，我这个地址有多少钱？”RPC 把答案传回来，MetaMask 再显示给你看。你发一笔交易，也是 MetaMask 把交易通过 RPC 交给网络。

所以 RPC 填错了，钱包就像拨错了电话号码，对方要么不接，要么接起来说的不是你要的那条链。

> 💡 **先说清楚：公开 RPC 是大家共用的，用的人多的时候会慢、会限流。** 刚开始学习，用公开 RPC 完全够用。等你后面做比较重的测试，再换成 Alchemy、Infura 这类自己申请的专用 RPC。

### Chain ID：链的身份证号，错一个数字都不行

Chain ID 是每条链唯一的数字编号。Sepolia 是 11155111，Avalanche Fuji 是 43113，Base Sepolia 是 84532。

**Chain ID 是 MetaMask 判断“你现在到底在哪条链上”的唯一依据。** 你填的 RPC 说自己是 Sepolia，但 Chain ID 填成了别的值，MetaMask 会直接拒绝保存，因为它发现 RPC 报告的 Chain ID 和你填的不一致。

这一点其实是在保护你：如果没有 Chain ID，同一笔签名可能在两条链上都被当成有效交易，这就是所谓的跨链重放。Chain ID 就是为了防止这种事。

### 网络名、货币符号、浏览器：填给人看的

这三项相对没那么危险，但也有讲究：

- **网络名**，建议带上“测试网”三个字，比如写“Ethereum Sepolia 测试网”，不要只写“Sepolia”。等你以后同时装了主网和测试网，一眼就能分清。
- **货币符号**，Sepolia 和 Base Sepolia 写 ETH，Fuji 写 AVAX。写错了，MetaMask 显示的余额单位会跟着错。
- **浏览器 URL**，建议填上。以后你想查一笔交易，不用自己去搜浏览器，点一下交易记录就能跳过去。

```
你点“切换网络”
    ↓
MetaMask 问 RPC：“这条链的 Chain ID 是多少？”
    ↓
RPC 回答：“11155111，我是 Sepolia”
    ↓
MetaMask 对照你填的 Chain ID，一致就切换，不一致就拒绝
    ↓
切换成功，重新读余额、重新读交易记录
```

---

## 三、动手前准备：三张测试网参数卡

在动手之前，先把三条测试网的参数一次准备好。**不要从论坛、聊天群里复制 RPC，先从官方文档、Chainlist 这类可核对的地方确认。**

下面这张表，就是这篇文章后面会反复用到的三张参数卡。建议你先收藏这一节，添加的时候直接对照着填。

| 网络 | Chain ID | RPC URL | 货币符号 | 浏览器 |
|---|---|---|---|---|
| Ethereum Sepolia | 11155111 | https://rpc.sepolia.org | ETH | https://sepolia.etherscan.io |
| Avalanche Fuji | 43113 | https://api.avax-test.network/ext/bc/C/rpc | AVAX | https://testnet.snowtrace.io |
| Base Sepolia | 84532 | https://sepolia.base.org | ETH | https://sepolia.basescan.org |

这三条链为什么选它们？因为它们正好对应这个系列后面要用的三条线：Sepolia 是以太坊的测试网，第 10 到第 20 篇的合约都在上面跑；Fuji 是 Avalanche 的测试网，第 27 篇的跨链实战要从 Fuji 出发；Base Sepolia 是 Base 的测试网，后面讲 L2 的时候会用到。

> 💡 **一句话记住：Chain ID 不用背，RPC 不用背，但每次添加之前，一定要去官方文档或 Chainlist 核对一次。** RPC 地址会变，官方文档的更新比你记忆里的版本更可信。

---

## 四、第一步：手动添加 Ethereum Sepolia，完整走一遍

这一节，我们只做一件事：把 Sepolia 手动加进 MetaMask。把这一步走通了，后面加 Fuji 和 Base Sepolia，就是重复同样的动作。

### 第 1 步：打开网络下拉框

点开浏览器右上角的 MetaMask 扩展，钱包打开后，看左上角的网络选择框。它现在大概率显示“Ethereum Mainnet”或者“以太坊主网”。

点一下它，会弹出一个网络列表。列表最下面，有“管理网络”或者“Manage networks”，点进去。

### 第 2 步：点“添加自定义网络”

在网络管理页面，点“添加自定义网络”或者“Add a custom network”。

不同版本的 MetaMask，按钮的位置和叫法会有一点不一样，但流程是一样的：**网络下拉框 → 管理网络 → 添加自定义网络。** 如果你在列表里已经看到了 Sepolia，直接点它就行，不用再手动加。

### 第 3 步：按参数卡填五项

按第三节那张表，逐项填：

- 网络名：Ethereum Sepolia 测试网
- RPC URL：https://rpc.sepolia.org
- Chain ID：11155111
- 货币符号：ETH
- 浏览器 URL：https://sepolia.etherscan.io

填的时候注意两点：**Chain ID 填十进制的 11155111，不要填十六进制的 0xaa36a7；RPC URL 要完整复制，不要多一个空格，也不要少了 https://。**

### 第 4 步：点保存，然后检查三件事

点保存之后，MetaMask 会自动切到 Sepolia。这时候不要急着去做别的，先检查三件事：

1. 左上角是不是已经显示 Sepolia？
2. 余额那一栏，是不是显示 Sepolia ETH？如果你之前没领过测试币，显示 0 是正常的。
3. 点一下任意一笔历史交易，或者点“在浏览器中查看”，能不能正常跳到 sepolia.etherscan.io？

这三件事都对，说明 Sepolia 已经加好了。

### 第 5 步：如果保存失败，先看这两个地方

保存失败，经常是这两个原因：

- **提示 Chain ID 不匹配。** 回去核对 Chain ID 和 RPC 是不是同一条链的。Sepolia 的 RPC 配 Sepolia 的 Chain ID，不要拿 Fuji 的 RPC 配 Sepolia 的 Chain ID。
- **提示 RPC 没有响应。** 换一个公开 RPC 再试一次，或者等一会儿再试。公开 RPC 有时候会限流，不代表你填错了。

---

## 五、第二步：用同样方法加上 Avalanche Fuji 和 Base Sepolia

Sepolia 走通之后，Fuji 和 Base Sepolia 就是重复动作。但有两点不一样，需要单独说一下。

### Avalanche Fuji：Gas 币是 AVAX，不是 ETH

Fuji 的参数卡是这样的：

| 字段 | 填什么 |
|---|---|
| 网络名 | Avalanche Fuji 测试网 |
| RPC URL | https://api.avax-test.network/ext/bc/C/rpc |
| Chain ID | 43113 |
| 货币符号 | AVAX |
| 浏览器 URL | https://testnet.snowtrace.io |

**新手最容易犯的错，就是在 Fuji 上也填 ETH。** 填错了，MetaMask 显示的余额单位会是 ETH，但这条链实际收的是 AVAX。交易发出去的时候，Gas 费扣的还是 AVAX，只是显示乱了。

Fuji 的测试币也要单独领。Sepolia 的水龙头给的是 Sepolia ETH，不能直接拿到 Fuji 上当 AVAX 用。Avalanche 官方水龙头在 faucet.avax.network，领之前先确认你现在切的是 Fuji。

### Base Sepolia：名字很像主网，一定要带上“测试网”

Base Sepolia 的参数卡是这样的：

| 字段 | 填什么 |
|---|---|
| 网络名 | Base Sepolia 测试网 |
| RPC URL | https://sepolia.base.org |
| Chain ID | 84532 |
| 货币符号 | ETH |
| 浏览器 URL | https://sepolia.basescan.org |

Base 有主网和测试网两套，Chain ID 也不一样：主网 Base 是 8453，测试网 Base Sepolia 是 84532。**只差一个数字 2，但完全是两条链。**

所以网络名一定要写全：“Base Sepolia 测试网”，不要只写“Base”。等你以后同时装了主网和测试网，这个习惯能帮你少踩很多坑。

```
Sepolia 加好了
    ↓
重复同样的动作：管理网络 → 添加自定义网络 → 填表 → 保存
    ↓
Fuji 加好了：Chain ID 43113，货币 AVAX
    ↓
Base Sepolia 加好了：Chain ID 84532，货币 ETH
    ↓
下拉列表里，现在有 4 条链：以太坊主网、Sepolia、Fuji、Base Sepolia
```

加完之后，你的网络下拉列表应该有四条链。平时做这个系列的实验，基本只在后面三条测试网之间切换，主网那条可以先放着不动。

---

## 六、更快的方法：用 Chainlist 一键添加

手动添加走通一次之后，你会发现每次填表其实挺烦的。这时候就可以用 Chainlist。

Chainlist 是一个公开的 EVM 网络目录，上面列了每条链的网络名、RPC、Chain ID、货币符号和浏览器。用法很简单：打开 chainlist.org，找到你要加的链，点“Add to MetaMask”，MetaMask 会弹出一个确认框，上面已经帮你填好了所有参数，你核对一遍再点确认就行。

### 一键添加的三个步骤

1. 打开 chainlist.org，先确认地址栏确实是 chainlist.org，不要点来路不明的仿冒站。
2. 搜索你要加的链，比如搜“Sepolia”，找到对应的卡片，核对 Chain ID 是不是 11155111。
3. 点“Add to MetaMask”，在弹出的确认框里，再核对一次 RPC 和 Chain ID，确认无误再点批准。

### 什么时候用 Chainlist，什么时候别用

**适合用 Chainlist 的时候：** 这条链已经在 Chainlist 上有记录，你只是想省掉手动填表的麻烦。

**不适合用 Chainlist 的时候：** 这条链是刚出的新测试网，Chainlist 上还没有；或者你想用自己申请的专用 RPC，不想用 Chainlist 默认的公开 RPC。这两种情况，还是手动添加更稳。

> 💡 **先说清楚：Chainlist 不是 MetaMask 官方维护的，它的数据来自社区。** 所以一键添加之前，一定要自己核对 Chain ID 和 RPC，再去对照官方文档。方便不能代替核对。

---

## 七、网络切换之后，钱包里到底变了什么？

加完网络，很多人还有一个疑问：我切到 Fuji 之后，之前在 Sepolia 上的 Token 怎么不见了？是不是丢了？

**不是丢了，是你换了房间。**

### 变了的三样东西

| 变了什么 | 具体表现 |
|---|---|
| 余额 | 显示的是当前这条链上的余额，换一条链，余额就跟着换 |
| Token 列表 | 每条链的 Token 列表是分开记的，Sepolia 上加过的 Token，在 Fuji 上不会自动出现 |
| 交易记录 | 显示的是当前这条链上的交易记录，换一条链，记录就跟着换 |

### 没变的两样东西

| 没变什么 | 具体表现 |
|---|---|
| 地址 | 还是同一个 0x 地址 |
| 助记词和私钥 | 还是同一套，不用重新记 |

### 怎么在新网络上添加 Token

以 Fuji 为例，你想在 Fuji 上看到一个测试 Token，步骤是这样的：

1. 先确认左上角已经切到 Avalanche Fuji 测试网。
2. 点“导入 Token”或者“Import tokens”。
3. 填这个 Token 在 Fuji 上的合约地址、符号和小数位数。
4. 点确认，这个 Token 就会出现在 Fuji 的列表里。

**这里最容易错的一步，是拿错了合约地址。** 同一个 Token 在不同链上的合约地址是不一样的。Sepolia 上的 USDC 合约地址，不能直接拿到 Fuji 上用。一定要去这条链的浏览器上，查这个 Token 在这条链上的地址，再填。

---

## 八、新手最容易踩的五个坑

前面几节讲的都是“怎么做对”，这一节讲“怎么做错”。这五个坑，都是新手真实踩过的。

### 坑 1：在错的网络上发交易

这是经常犯的错，代价也不小。你想在 Sepolia 上部署合约，结果钱包还停在以太坊主网，点一下部署，Gas 费扣的就是真 ETH。

**怎么避开：每次发交易之前，先看一眼左上角的网络名。** 养成这个习惯，比事后去查交易记录有用得多。

### 坑 2：Chain ID 输错一位

Sepolia 是 11155111，Base Sepolia 是 84532，Fuji 是 43113。这些数字看起来很像，但错一位就是另一条链，或者根本不存在的链。

MetaMask 会帮你挡掉一部分错误，比如 Chain ID 和 RPC 对不上，它会拒绝保存。但它挡不掉所有错误，所以填完之后，自己再对照参数卡看一遍。

### 坑 3：从不明来源复制 RPC

RPC 是钱包和链之间的电话线。如果这条电话线是别人搭的，理论上对方能看到你的请求。

**不要从论坛、聊天群、来路不明的帖子里复制 RPC。** 只从官方文档、Chainlist 这类地方拿。实在不确定，就用这篇文章第三节那张表里的公开 RPC。

### 坑 4：主网和测试网混在一起

主网的 ETH 是真钱，测试网的 ETH 是测试币，名字都叫 ETH，但完全不是一回事。

建议你给所有测试网的名字都加上“测试网”三个字，主网的名字保持原样。这样在下拉列表里，一眼就能分清哪个能动真钱、哪个只能做实验。

### 坑 5：Token 没显示，就以为丢了

切到一条新链，发现之前加过的 Token 不见了，很多人第一反应是“币丢了”。

**先别慌，先确认两件事：你现在在哪条链上？这个 Token 在这条链上有没有合约地址？** 如果这两件事都对，再按第七节的方法重新导入一次，大多数情况下 Token 就会重新出现。

> ⚠️ **风险提示**：跨链和多链操作涉及真实资产转移，不同链、不同 Token、不同路径的风险差异很大。本文只讲原理和测试网操作，不构成任何操作建议或投资建议。实际操作前请自行核实官方文档，先在测试网（比如 Sepolia、Fuji）上完整走一遍流程，再考虑主网——而且永远只用你输得起的金额。

---

## 总结

1. **MetaMask 不是只属于一条链的钱包。** 同一个地址可以在多条 EVM 链上使用，切换网络，地址不变，变的是余额、Token 列表和交易记录。
2. **手动添加网络要填五项：** 网络名、RPC URL、Chain ID、货币符号、浏览器 URL。其中 Chain ID 是链的身份证号，RPC 是钱包和链之间的电话线，这两项最容易出问题。
3. **三条测试网的参数要对照官方文档核对：** Sepolia 是 11155111，Fuji 是 43113，Base Sepolia 是 84532。RPC 地址会变，核对一次比背下来更可靠。
4. **Chainlist 可以一键添加，但不能代替核对。** 点批准之前，一定要自己再看一遍 Chain ID 和 RPC。
5. **切换网络后，Token 列表是分开的。** 想在新网络上看到 Token，要用这条链上的合约地址重新导入。
6. **每次发交易之前，先看一眼左上角的网络名。** 发交易之前先看一眼左上角，这个习惯最管用。

下次再有人问你“MetaMask 怎么加多条链”，你可以直接回答他：

**不用多造钱包，同一个地址、同一套助记词，给 MetaMask 加上新网络就行。填对 Chain ID 和 RPC，名字带上“测试网”，切换之前先看一眼左上角。**

---

## 下一篇是第 25 篇：

[[y7blog-web3-26]]

下一篇就先把授权这件事单独讲清楚：approve()、allowance() 和 transferFrom() 这三个函数到底是什么关系？为什么跨链之前，一定要先授权？为什么授权之后，你的 Token 还是在你自己手里？

到时候见。

---

*参考资料：MetaMask 官方帮助中心「How to add a network」关于手动添加网络的官方步骤；Chainlist（https://chainlist.org）关于 EVM 网络目录与 Chain ID、RPC 的说明；Ethereum Sepolia 浏览器（https://sepolia.etherscan.io）、Avalanche Fuji 浏览器（https://testnet.snowtrace.io）、Base Sepolia 浏览器（https://sepolia.basescan.org）关于各测试网 Chain ID、RPC 与浏览器的说明；Circle 测试网水龙头（https://faucet.circle.com）与 Avalanche Fuji 水龙头（https://faucet.avax.network）关于测试网 Token 领取的说明。*

