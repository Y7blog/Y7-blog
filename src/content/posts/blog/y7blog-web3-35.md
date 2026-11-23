---
title: 34｜动态 NFT + CRE：让 NFT 自动改变属性
published: 2026-11-10
pinned: false
draft: false
comment: true
description: 一张 NFT，价格涨了变笑脸、跌了变哭脸——听起来很酷，但谁去调它？没人调，它就永远是第一张脸。这篇把动态 NFT 和 Chainlink Automation 拼起来：NFT 合约负责存心情，价格喂价负责报价格，Automation 负责盯着条件、条件一到就自动调合约翻转心情。从 checkUpkeep 到 performUpkeep，从按时间变到按价格变，再到 Automation 退役后该走的 CRE Keeper Bot 模板，一步步讲清楚一张 NFT 是怎么自己变脸的。
image: https://www.y7img.ccwu.cc/file/1795075550942_y7blog-web3-35-1600.png
tags: [Chainlink,Automation,动态NFT,NFT,CRE]
category: Web3
slug: blog/y7blog-web3-35
series: "区块链百科"
seriesOrder: 1
---

想象一下，你手里有一张 NFT，画的是一张脸。BTC 涨了，它笑；BTC 跌了，它哭。听起来很酷，对吧？

但问题来了：**谁去调它？**

价格变了，NFT 自己不知道。它只会躺在链上等着，等有人发一笔交易调它的更新函数。你每天手动调一次，它就每天变一次；你出差一周忘了调，它就一周不变。动态 NFT 变成了“手动 NFT”。

动态 NFT 的“变”，其实是两步：**第一步是知道该变了**——价格真的变了；**第二步是真的去变**——发一笔交易改掉链上的状态。NFT 合约自己哪一步都做不了：它读不到互联网上的价格，也不会自己发交易。

所以还缺一个“值班员”：盯着价格，条件到了就调合约。这篇就讲这个值班员怎么和动态 NFT 拼起来，让 NFT 真正自己变脸。

> 💡 **先说清楚**：本文是知识科普，只讲原理和做法，不推荐你去买任何 Token，更不构成投资建议。有一个重要前提：Chainlink Automation 正在退役，本文讲它的模式是帮你理解思路，真正动手请走第五节的 CRE 方式。所有操作先在测试网练手，主网上的每一次执行都是真金白银。

---

## 一、动态 NFT 还缺最后一块拼图

先把前面几篇的概念拼一下。一张动态 NFT 能变，靠的是第 30 篇讲的那个结构：**合约里存着当前的状态，`tokenURI` 根据状态返回不同的 metadata**。心情是“笑”的时候，`tokenURI` 返回笑脸图的链接；心情变成“哭”，`tokenURI` 就返回哭脸图的链接。钱包和 OpenSea 读到的，就是 `tokenURI` 当时返回的东西。

但这个结构里有个缺口：**心情存在合约里，谁来改它？**

改心情要发交易。合约自己发不了交易——第 33 篇讲过，智能合约是被动的，只会等人来调。你可以自己手动调，但这就回到了开头那个问题：你忘了，它就不变了。

所以完整的自动变脸，需要四样东西凑齐，缺一个都不行：

```
BTC 价格变化
        ↓
Chainlink Data Feeds 把价格写上链
        ↓
Automation 节点每隔几秒检查：心情该变了吗？
        ↓ 没变 → 继续等
        ↓ 变了 → 发交易调 performUpkeep
        ↓
NFT 合约翻转心情，更新 tokenURI
        ↓
钱包 / OpenSea 下次刷新时显示新表情
```

这个流程里，NFT 合约只负责最后一公里：存心情、翻转心情、算 `tokenURI`。**判断“该不该变”和“动手去变”，是 Automation 的活。** 各干各的，拼起来才是一张真正会自己变脸的 NFT。

---

## 二、自动变脸的四件套：谁负责什么

把上面那个流程拆开，四件套的分工是这样的：

| 部件 | 是什么 | 负责什么 |
|---|---|---|
| NFT 合约 | ERC721 + 心情状态 | 存当前心情、翻转心情、根据心情返回不同的 `tokenURI` |
| 价格喂价 | Chainlink Data Feeds BTC/USD | 把真实的 BTC 价格送上链，供合约读取 |
| 检查 | `checkUpkeep` | 每隔几秒被模拟调用一次，判断“现在该变吗” |
| 执行 | `performUpkeep` | 检查说该变了，才真正上链翻转心情 |

这里最容易搞混的一点是：**喂价不是直接去改 NFT 的**。喂价只负责把价格写到链上一个所有人都能读的地方，NFT 合约自己去读这个价格，再决定心情要不要变。价格和心情之间，隔着一层“判断”，而这个判断就是 `checkUpkeep`。

还有一点要注意：**一张 NFT 的心情，不是一天变一次，而是一直处在“可能变”的状态里**。Automation 节点每隔几秒就模拟一次 `checkUpkeep`，价格一越过你设的线，下一轮检查就会发现，接着就发交易执行。从价格越线到 NFT 变脸，中间通常只有几秒到几十秒——不是准时到秒，但对一张变脸的 NFT 来说够用了。

---

## 三、合约怎么写：眼睛和手还是那一对

第 33 篇讲过，Automation 的核心是 `checkUpkeep` 和 `performUpkeep` 这一对：一个负责看，一个负责干。动态 NFT 的合约，就是在这对函数里加上“读价格、比心情”的逻辑。

下面是一份简化过的教学代码，思路来自 Chainlink 训练营的动态 NFT 例子和 Cyfrin 课程里的 Mood NFT。为简单起见，这份代码只管 0 号这一张 NFT——真正做一个系列的时候，要给每张 NFT 各记一份心情，或者按规则批量更新。

### 1. 合约骨架：NFT + 喂价 + Automation

```
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

contract DynamicMoodNft is ERC721URIStorage, AutomationCompatibleInterface, Ownable {
    enum Mood { HAPPY, SAD }

    uint256 private s_tokenCounter;
    AggregatorV3Interface internal priceFeed;
    mapping(uint256 => Mood) public tokenIdToMood;
    int256 public happyAbovePrice;

    string private happySvgUri;
    string private sadSvgUri;

    constructor(
        address priceFeedAddress,
        string memory happySvgUri_,
        string memory sadSvgUri_,
        int256 happyAbovePrice_
    ) ERC721("Dynamic Mood NFT", "DMOOD") Ownable(msg.sender) {
        priceFeed = AggregatorV3Interface(priceFeedAddress);
        happySvgUri = happySvgUri_;
        sadSvgUri = sadSvgUri_;
        happyAbovePrice = happyAbovePrice_;
    }
}
```

和第 31 篇一样，这里用的是 OpenZeppelin v5 的写法：`Counters` 已经被移除了，计数器就是一个普通的 `uint256` 变量，自己加 1；`Ownable` 的构造函数必须传一个地址，一般是 `Ownable(msg.sender)`。`happyAbovePrice` 是分界线：价格高于它就笑，低于它就哭——这个数字只是演示用的，真正做项目要按自己的规则定。

`happySvgUri` 和 `sadSvgUri` 是两种心情的图片地址。第 30 篇讲过，图片可以直接以链上 SVG 的形式存在合约里，也可以存在 IPFS 上。这里先用两个现成的图片地址代替，重点先看“变”的逻辑。

### 2. Mint：先发一张笑脸

```
    function mint() public {
        uint256 tokenId = s_tokenCounter;
        s_tokenCounter++;
        _safeMint(msg.sender, tokenId);
        tokenIdToMood[tokenId] = Mood.HAPPY;
        _setTokenURI(tokenId, happySvgUri);
    }
```

Mint 的时候默认心情是 HAPPY，`tokenURI` 指向笑脸图。`_setTokenURI` 是 `ERC721URIStorage` 自带的函数，作用就是把某个 Token ID 和一段 metadata 链接绑在一起。以后心情变了，再调一次 `_setTokenURI` 换成另一张图就行。

### 3. checkUpkeep：眼睛，只看不动手

```
    function checkUpkeep(
        bytes calldata /* checkData */
    ) external view override returns (bool upkeepNeeded, bytes memory performData) {
        (, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        if (price <= 0 || block.timestamp - updatedAt > 3600) {
            return (false, "");
        }
        Mood shouldBe = price >= happyAbovePrice ? Mood.HAPPY : Mood.SAD;
        upkeepNeeded = (shouldBe != tokenIdToMood[0]);
        performData = abi.encode(shouldBe);
        return (upkeepNeeded, performData);
    }
```

这个函数只做三件事：

1. **读价格**：调喂价的 `latestRoundData()`，拿到最新价格和更新时间。
2. **先验货**：价格小于等于 0，或者价格超过 1 小时没更新，就直接返回 `false`——价格不可信的时候，宁可不变，也别变错。这是读喂价最容易漏掉的一步，第 18 篇讲喂价的时候提过，`latestRoundData` 返回的价格要先检查正负和新鲜程度再用。
3. **比心情**：按价格算出“现在应该是什么心情”，和链上存的当前心情一比。不一样，返回 `true`，并把“应该变成什么心情”编码进 `performData`，交给执行函数。

注意 `checkUpkeep` 是个 `view` 函数，只在链下被模拟调用，不上链、不花 Gas。所以这里读价格、算心情，都是免费的。

还有一个细节：**喂价的价格有 8 位小数**。BTC/USD 喂价返回的 `3150000000000`，意思是 31500.00 美元，不是 3 万亿。`happyAbovePrice` 也要按 8 位小数来写，比如“高于 100000 美元就笑”要写成 `10000000000000`。小数位没对齐，是经常犯的错。

### 4. performUpkeep：手，动手之前再验一次

```
    function performUpkeep(bytes calldata performData) external override {
        Mood shouldBe = abi.decode(performData, (Mood));
        (, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        if (price <= 0 || block.timestamp - updatedAt > 3600) {
            return;
        }
        Mood reallyShouldBe = price >= happyAbovePrice ? Mood.HAPPY : Mood.SAD;
        if (reallyShouldBe != shouldBe || tokenIdToMood[0] == reallyShouldBe) {
            return;
        }
        tokenIdToMood[0] = reallyShouldBe;
        _setTokenURI(0, reallyShouldBe == Mood.HAPPY ? happySvgUri : sadSvgUri);
    }
```

`performUpkeep` 是真正上链执行的那一步，要花 Gas，所以开头要先重新验证一次：

- 价格还可信吗？不可信就直接返回，什么都不干。
- 价格算出来的心情，和 `checkUpkeep` 当时说的还一致吗？从模拟到上链隔了几个区块，价格可能又变回去了，不一致就返回。
- 当前心情是不是已经是目标心情了？是的话也不用再变一次。

三道检查都通过，才真正翻转心情、换 `tokenURI`。**`performUpkeep` 里永远先重新验证条件，再干活**——第 33 篇讲过，这是最容易被新手漏掉的一步，漏了轻则白花 Gas，重则在错误的状态下执行了不该执行的操作。

### 5. 还有一个安全习惯：谁能调 performUpkeep

`performUpkeep` 默认是公开函数，任何人都能调。第 33 篇讲过，解决办法是只允许 Automation 网络的 Forwarder 地址来调：

```
    address public s_forwarder;

    function setForwarder(address forwarder_) external onlyOwner {
        s_forwarder = forwarder_;
    }

    modifier onlyForwarder() {
        require(msg.sender == s_forwarder, "only forwarder");
        _;
    }
```

注册 Upkeep 之后，Forwarder 地址可以在 Automation 应用里查到，部署时调 `setForwarder` 把它写进去，再给 `performUpkeep` 加上 `onlyForwarder`。这样别人就算直接调你的 `performUpkeep`，也会被拒绝。到了第五节的 CRE 方式，允许的调用者会换成新的接收合约地址，思路是一样的：**执行入口永远只对执行网络开放**。

---

## 四、两种触发：按时间变，还是按价格变

一张 NFT 的“变”，可以由时间驱动，也可以由条件驱动。选哪种，看你的 NFT 是“到点就变”还是“情况变了才变”。

|  | 按时间变 | 按价格变 |
|---|---|---|
| 触发依据 | 固定的时间间隔 | 链上状态，比如价格越过某条线 |
| 代表例子 | Chainlink 官方教程里那朵花：每 30 秒变一个阶段，从种子、发芽到完全绽放 | 本文的变脸 NFT：BTC 跌破分界线就变哭脸 |
| 要不要写 `checkUpkeep` | 不用，注册时直接给一个 CRON 时间表 | 要，条件就写在 `checkUpkeep` 里 |
| 适合场景 | 按部就班地变：生长、季节、倒计时 | 看情况变：价格、比分、链上数据到了某个值 |

Chainlink 官方的动态 NFT 教程用的就是按时间变的例子：一朵花的 NFT，每 30 秒换一个生长阶段，最后变成一朵完全绽放的花。部署的时候填一个时间间隔（演示里填的是 30），注册一个 Upkeep，剩下的就不用管了——时间一到，Automation 就调合约推进到下一个阶段。

按价格变则更像本文的例子：你不知道价格什么时候跌破，只知道跌破了就要变。这时候就得用 `checkUpkeep` 自己写条件，节点每隔几秒模拟一次，条件一到就执行。

**两种触发没有高下，只有适不适合**：变化是按部就班的，用时间；变化取决于某个外部条件，用条件。很多真正的动态 NFT 是两种混着用的——比如一朵花按时间生长，但遇到极端天气（价格、天气数据）就换一个特殊形态。

---

## 五、现在动手，走 CRE 的 Keeper Bot

前面四节讲的 Automation 模式，是帮你理解思路。但真正动手做项目，不能再按老路注册 Upkeep 了——**Automation 正在退役**：

- v1.x 已于 2026 年 6 月 30 日弃用；
- v2.1 已于 2026 年 7 月 31 日弃用；
- 测试网已在 2026 年 6 月下线；
- 整个服务将于 2027 年 6 月 2 日全面下线。

接替它的是 **Chainlink Runtime Environment（CRE）**，2025 年 11 月已经全面可用。思路和 Automation 一模一样，换的只是执行层：执行的单位从 Upkeep 变成了 Workflow。

### Keeper Bot：Automation 的直接接替者

Chainlink 官方给了一个现成的模板，叫 **Keeper Bot**，定位写得非常直接：就是 Automation 的替代品。它跑的是一个通用模式：**定时 → 读状态 → 判断 → 需要就写上链**。

```
Cron 触发器（默认每 5 分钟，可改）
        ↓
读链上 KeeperConsumer 合约的 needsUpkeep()
        ↓ 需要？ → 生成 DON 签名报告 → KeystoneForwarder 写上链
        ↓ 不需要？ → 只记一条日志，不花 Gas
        ↓
合约里的 _processReport() 执行翻转心情
```

对照一下，Automation 里的每个部件，在 CRE 里都有对应的位置：

| Automation | CRE Keeper Bot |
|---|---|
| 按时间的 Upkeep | Cron 触发器（标准 CRON 表达式，最小间隔 30 秒） |
| 按条件的 Upkeep | Cron 触发器 + 在处理函数里读链上状态、判断条件 |
| `checkUpkeep` | 合约里的 `needsUpkeep()`，由 Workflow 的处理函数去读 |
| `performUpkeep` | 合约里的 `_processReport()`，收到 DON 签名的报告后执行 |
| 充 LINK 到 Upkeep | Workflow 的计费（具体看 CRE 文档） |
| Forwarder 地址限制调用者 | 报告经 KeystoneForwarder 写上链，合约只接受它的调用 |

用 Keeper Bot 做变脸 NFT，改动其实很小：NFT 合约本身基本不用动，变的只是“谁来触发”——以前是 Automation 节点模拟 `checkUpkeep`，现在是 CRE Workflow 定时读 `needsUpkeep()`。合约里翻转心情、更新 `tokenURI` 的逻辑，原样保留。

### 老项目怎么办：桥接，不用重写

如果你手里已经有一个按 Automation 写的合约，官方给了迁移模板，用的是“桥接”思路：部署一个通用的 `AutomationReceiver.sol`，它接收 CRE 的报告，再把调用转发给你原来的合约。原合约基本不用改，只有一处可能要动：**如果你的合约检查了调用者是不是 Automation 的 Forwarder，现在要改成允许新的接收合约地址**。第 33 篇第八节讲过迁移的五个步骤，这里不再重复。

### 一个顺带提醒：CRE 工具链更新很快

CRE 的命令行工具 `cre` 已经到了 1.40.0（2026 年 11 月 18 日的更新日志），模板和文档还在频繁更新。照着教程做的时候，先确认你看的模板版本和你装的 CLI 版本对得上，别拿着旧模板去套新工具——版本对不上，优先相信官方文档的最新写法。

---

## 六、从部署到在钱包里看到它变脸

把前面的东西串起来，完整走一遍是这样的：

**第一步：部署 NFT 合约。** 在 Remix 里编译第三节那份合约，部署到 Sepolia。部署时要填四个参数：Sepolia 的 BTC/USD 喂价地址（`0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43`，训练营仓库里用的就是这个地址）、笑脸图地址、哭脸图地址、分界线价格。部署完先调一次 `mint()`，给自己发一张 NFT。

**第二步：部署 Keeper Bot Workflow。** 按官方模板生成项目，把三处改成你的：Cron 时间表改成你想要的检查频率（默认每 5 分钟）；条件改成读你的 `needsUpkeep()`；`_processReport()` 改成翻转心情的逻辑。然后把 Workflow 部署到 CRE 网络上。

**第三步：充费。** Workflow 执行要花钱，按 CRE 文档的要求充好费用。检查本身不花钱——只有真正上链执行的那一下才花钱，和 Automation 的计费思路一样。

**第四步：等它变。** 价格越过分界线之后，下一次 Cron 触发就会发现心情该变了，接着发交易上链。你可以在 Sepolia 的区块链浏览器上查到这笔交易，确认 `tokenURI` 已经换成了另一张图。

**第五步：在钱包里看。** 打开钱包或者 OpenSea，找到这张 NFT，刷新一次 metadata，就能看到新表情。这里要有点耐心：**市场刷新 metadata 是异步排队的，一般几分钟，忙的时候要几小时**，第 30 篇核实过这一点。链上已经变了，但市场还没刷新出来的时候，别以为合约出问题了——先去区块链浏览器查 `tokenURI`，链上变了就是变了，市场显示只是时间问题。

---

## 七、最容易踩的坑

### 1. performUpkeep 谁都能调

这是最容易出现的问题。`performUpkeep` 默认公开，别人可以直接调你的执行函数，在错误的时间替你执行。解决办法第三节第 5 点讲过：用 Forwarder 地址（Automation 时代）或接收合约地址（CRE 时代）限制调用者。**执行入口永远只对执行网络开放**，这条规矩不要忘。

### 2. performUpkeep 里不重新验证条件

从 `checkUpkeep` 模拟到真正上链执行，中间隔了几个区块，价格可能已经变回去了。`performUpkeep` 开头先重新读一次价格、重新判断一次，不满足就直接返回。漏了这一步，轻则白花 Gas，重则在错误的状态下翻转了心情。

### 3. checkUpkeep 里写太重的东西

`checkUpkeep` 虽然不花 Gas，但每次模拟都有计算量上限。判断条件要尽量轻，重的计算留到 `performUpkeep` 里，或者干脆换个写法。读一堆用不上的状态、循环套循环，是经常犯的错。

### 4. 以为喂价是实时跳动的

Data Feeds 不是交易所的 tick 数据。**喂价只在价格波动超过偏差阈值、或者到了心跳间隔的时候才更新**，平时价格小幅波动，链上读到的价格是不动的。所以你的 NFT 不会在价格每跳一下就变一次脸——它只在喂价真正更新、并且越过分界线的时候才变。拿着交易所的实时价格去对 NFT 的表情，对不上是正常的，不是合约坏了。

### 5. 心情来回横跳

价格刚好在分界线上下抖动的时候，NFT 会一会儿笑、一会儿哭，来回翻。解决办法有两个：**加一个缓冲带**——比如高于 101000 才笑、低于 99000 才哭，中间那一段保持原样；或者**设一个最短间隔**——两次变化之间至少隔一段时间，刚变过就不再变。

### 6. 余额只充了最低标准

和第 33 篇讲的一样，余额刚好卡在最低线上，Gas 价格一涨任务就停了。平时保持几倍的余量，别等停了才想起来充。

### 7. 变了却看不到，以为没变

链上变了，市场显示没变，十有八九是缓存。先去区块链浏览器查 `tokenURI` 确认链上状态，再去市场手动刷新一次。**先查链上，再怀疑合约**，这个顺序能省掉很多冤枉时间。

---

## 八、不只是变脸：动态 NFT 还能变什么

变脸只是最直观的一种。变化的规则写在合约里、触发交给自动化，这个组合能玩的花样很多：

- **体育卡片**：LaMelo Ball 的 NFT 系列（2021 年，共 8070 张）就是按比赛数据更新的——球员一场打得好，卡片上的数据就跟着涨。第 30 篇讲过这个例子。
- **游戏装备**：一把剑每用一次掉一点耐久，耐久掉光就变一把断剑；打赢一场关键战斗，装备升级变个新造型。
- **会员等级**：质押满 30 天升一级、满 90 天再升一级，NFT 的边框颜色跟着等级走，不用项目方手动发新卡。
- **季节皮肤**：到了冬天自动换上雪景，到了夏天换回阳光——按时间触发的那种，用第四节的时间型就够了。

这些例子的共同点是：**变化的规则是确定的、写在合约里的，触发是自动的、不需要人守着的**。规则越明确，自动化越可靠；规则越模糊（比如“画得好不好看”），越不适合交给自动化。

---

## 总结

- **动态 NFT 的“变”分两步**：知道该变了 + 真的去变。NFT 合约自己哪一步都做不了，前者要靠喂价报价格，后者要靠自动化来发交易。
- **四件套分工明确**：NFT 合约存心情、翻转心情；喂价把价格送上链；`checkUpkeep` 判断该不该变；`performUpkeep` 真正去变。
- **两个函数是核心**：`checkUpkeep` 只看不动手、在链下模拟、不花 Gas；`performUpkeep` 真正上链执行，要花 Gas，所以开头要先重新验证条件。
- **读喂价要先验货**：价格小于等于 0 或者超过 1 小时没更新，就别变；喂价是 8 位小数，分界线也要按 8 位小数写。
- **两种触发看驱动**：按部就班地变，用时间型；看外部条件变，用条件型。
- **现在动手走 CRE**：Automation 正在退役，2027 年 6 月 2 日全面下线；接替者是 CRE，Keeper Bot 模板就是它的 Automation 替代品，Cron → 读 `needsUpkeep()` → 判断 → 经 KeystoneForwarder 写上链。
- **最容易踩的坑**：执行入口不限制调用者、`performUpkeep` 不重新验证、以为喂价是实时 tick、心情在分界线上下横跳、链上变了但市场缓存还没刷新。
- **变脸只是开始**：体育卡片、游戏装备、会员等级、季节皮肤，都是同一套“规则写进合约、触发交给自动化”的玩法。

---

## 下一篇是第 35 篇：

[[y7blog-web3-36]]

动态 NFT 能自己变了，下一个问题是：它能不能自己“搬家”？一张在 Ethereum 上 Mint 的 NFT，能不能移到 Avalanche 或者 Base 上？下一节先讲跨链 NFT 到底是什么意思，再讲它和 Token 跨链有什么不一样。

*参考资料：Chainlink 官方文档《Dynamic Metadata with Automation》（docs.chain.link/quickstarts/dynamic-metadata，2026-11-19 核对；花朵 NFT 演示，每 30 秒变一个阶段，最终完全绽放）；Chainlink 官方文档《Keeper Bot》模板页（docs.chain.link/cre-templates/keeper-bot，2026-11-19 核对；Cron → 读 needsUpkeep() → 判断 → 经 KeystoneForwarder 写上链，Automation 的直接替代品，CRE CLI 1.40.0）；Chainlink 训练营 2024《CrossChainPriceNFT.sol》（github.com/smartcontractkit/chainlink-bootcamp-2024，2026-11-19 核对；Sepolia BTC/USD 喂价 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43，价格涨跌对应 😀/😔/😑，链上 SVG + Base64 metadata）；Cyfrin 课程《Mood NFT》（updraft.cyfrin.io；flipMood 翻转心情、链上 SVG 存进合约、tokenURI 按心情返回）；Chainlink 官方文档《Secure Upkeeps Using the Forwarder》（docs.chain.link/chainlink-automation/guides/forwarder，2026-11-19 核对；每个 Upkeep 有专属 Forwarder，performUpkeep 应只接受 Forwarder 调用）；Chainlink 官方文档《Create Automation-Compatible Contracts》（docs.chain.link，2026-11-19 核对；AutomationCompatibleInterface、checkUpkeep/performUpkeep、时间触发无需接口）；DEV Community《Chainlink Runtime Environment (CRE)》（dev.to，2026-08-04；Automation v1.x 2026-06-30、v2.1 2026-07-31 日落，CRE 为接替者，AutomationReceiver 桥接迁移）；CoinMarketCap Academy《How To Create Dynamic NFTs (dNFTs)?》（coinmarketcap.com；dNFT 制作步骤，Keepers 兼容合约，Chainlink VRF 与自动化结合）；Acquire.fi《What is Dynamic NFT?》（acquire.fi，2026-05-08 更新；dNFT 三要素：可更新的 NFT 合约、预言机、自动化任务）。*
