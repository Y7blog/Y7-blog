---
title: 39｜NFT 如何读取 BTC 价格并改变自己的表情？
published: 2026-11-15
pinned: false
draft: false
comment: true
description: 一张 NFT，BTC 涨了换笑脸、跌了换哭脸。做法是让合约的 tokenURI 每次被问到时，现读 Chainlink BTC/USD 喂价，再按涨跌返回不同的 metadata。会写一份能直接在 Remix 上跑的 MoodNFT 合约，讲清 8 位小数、喂价地址、OpenSea 刷新这几个最容易踩的坑，也会说清官方教程里 Automation 定时改写的做法为什么现在不建议照抄。
image: https://www.y7img.ccwu.cc/file/1795313414481_y7blog-web3-40-1600.png
tags: [动态NFT,Data Feeds,BTC,ERC721,Chainlink]
category: Web3
slug: blog/y7blog-web3-40
series: "区块链百科"
seriesOrder: 1
---

想象一下，你钱包里有一张 NFT，上面画着一张脸。早上 BTC 涨了，打开钱包一看，它在笑；晚上 BTC 跌了，再打开，它愁眉苦脸。你没有点过任何按钮，也没有人手动帮你换过图——这张 NFT 自己在“看行情”。

这听起来像魔法，其实就是动态 NFT 加上价格喂价，拼在一起。这篇就把这个想法真的动手做出来：写一份合约，Mint 一张会跟着 BTC 价格变脸的 NFT。

> 💡 **先说清楚**：这篇的合约是没经过审计的学习代码，跑在 Sepolia 测试网上，只为讲明白原理，不能直接拿去生产环境。动手之前先在测试网练手、小额试。本文是知识科普，不是投资建议。

---

## 一、NFT 的“表情”到底存在哪？

先把一个最容易搞混的点说清楚：**NFT 图片本身并不存在链上**（至少这篇的做法不是）。一张 NFT 在链上其实只有两样东西：一个 tokenId，和一个指向 metadata 的地址。

这个地址就是 `tokenURI`。钱包、OpenSea 这些地方拿到 tokenId 之后，会去问合约：“这张 NFT 的 tokenURI 是什么？”合约返回一个链接，比如 `ipfs://Qm.../0.json`，里面是一份 JSON：

```
{
  "name": "会变脸的 NFT #0",
  "description": "一张跟着 BTC 价格改变表情的 NFT",
  "image": "ipfs://Qm.../happy.png",
  "attributes": [
    { "trait_type": "心情", "value": "开心" },
    { "trait_type": "BTC 价格", "value": "97400" }
  ]
}
```

你看到的那张脸，其实是这份 JSON 里 `image` 字段指向的图片。**表情存在 metadata 里，metadata 的地址存在合约的 `tokenURI` 里。**

所以“让 NFT 变脸”这件事，翻译成技术语言就是：**让 `tokenURI` 返回的内容跟着 BTC 价格变**。图片本身不用动，你只需要准备三张图——笑脸、平静脸、哭脸——再准备三份 metadata，分别指向这三张图。价格涨了，`tokenURI` 返回笑脸那份；价格跌了，返回哭脸那份。

这也是动态 NFT 和普通 NFT 的根本区别：普通 NFT 的 `tokenURI` 是 Mint 的时候写死、以后再也不变的；动态 NFT 的 `tokenURI` 每次被问到，都会重新算一遍答案。

|  | 普通 NFT | 动态 NFT |
| --- | --- | --- |
| `tokenURI` | Mint 时写死，之后不变 | 每次被调用时重新计算 |
| 图片 | 一张图看到底 | 价格、时间、比赛结果变了，图跟着变 |
| 合约要不要读外部数据 | 不用 | 要，靠预言机把链下数据读进来 |
| 典型例子 | 大部分头像类 NFT | 跟着币价变脸、跟着球赛数据变 stats 的 NFT |

30 篇里提过的 LaMelo Ball 那套 NFT 就是真实例子：他的球星卡 NFT 用 Chainlink 的体育数据喂价，比赛打完，卡面上的真实赛季数据就跟着更新。原理和这篇要做的变脸 NFT 一模一样，只是换了一组数据。

---

## 二、BTC 价格怎么进合约：Data Feeds

智能合约有个天生的限制：它自己上不了网。BTC 现在多少钱，这个数字在链下，合约读不到。18 篇讲过，解决办法就是预言机，而 Chainlink Data Feeds 就是现成的、专门干这件事的服务。

Data Feeds 的用法，你在 18 篇和 20 篇已经见过两次了，这里再快速过一遍，因为这篇的代码就是建立在这上面的。

### 喂价是一个已经部署好的合约

Chainlink 在每条链上都部署了一批喂价合约，每个交易对一个地址。你想读 BTC/USD，就去找 BTC/USD 那个喂价合约的地址，然后调它的 `latestRoundData()`。这篇用 Sepolia 测试网：

|  | 地址 | 小数位 |
| --- | --- | --- |
| Sepolia BTC/USD | `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43` | 8 |
| 以太坊主网 BTC/USD | `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c` | 8 |

这两个地址是 2026 年 11 月 22 日从 Chainlink 官方文档核对过的。注意一个经常犯的错：**测试网和主网的喂价地址不一样**。把主网地址抄到 Sepolia 的合约里，读出来的要么是错的、要么直接 revert。换链必查地址，官方文档的 Price Feed Addresses 页面就是干这个用的。

### 读一次，返回五个值

`latestRoundData()` 一次返回五个值：

```
(
  uint80 roundId,      // 这是第几轮报价
  int256 answer,       // 价格，BTC/USD 喂价是 8 位小数
  uint256 startedAt,   // 这轮报价开始的时间
  uint256 updatedAt,   // 这轮报价最后更新的时间
  uint80 answeredInRound
)
```

我们最关心的是 `answer` 和 `updatedAt` 两个。`answer` 是价格，但要记住它是 8 位小数的：BTC 卖 97,400 美元，`answer` 返回的是 `9740000000000`，也就是 97,400 后面再加 8 个 0。**小数位是这篇最容易踩的坑**，后面第六节会单独讲。

`updatedAt` 是这轮报价最后更新的时间戳，用来判断数据新不新鲜。喂价不是每个区块都更新的——BTC/USD 主网喂价大约每小时至少更新一次（心跳 1 小时），价格波动幅度够大时才会提前更新。也就是说，你读到的价格，可能是几分钟前、也可能是几十分钟前的。这个延迟对一张变脸 NFT 来说完全够用，但你要是指望它做高频交易的价格源，那就想错了地方。

### 读喂价不用花 LINK

还有一点新手经常问：读 Data Feeds 要不要 LINK？**不用。**`latestRoundData()` 是一个 view 函数，只读不写，调用它不花 Gas、不用 LINK。花钱的只有部署合约和 Mint 那两次写操作。20 篇那个 Token 购买系统也是这个道理：读价免费，写操作才花钱。

读喂价的最小代码，官方文档长这样：

```
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract DataConsumerV3 {
    AggregatorV3Interface internal dataFeed;

    constructor() {
        dataFeed = AggregatorV3Interface(0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43);
    }

    function getChainlinkDataFeedLatestAnswer() public view returns (int256) {
        (, int256 answer, , , ) = dataFeed.latestRoundData();
        return answer;
    }
}
```

构造函数里把喂价地址写死，之后每次调 `getChainlinkDataFeedLatestAnswer()`，拿到的就是最新的 BTC 价格（8 位小数版）。这篇的 MoodNFT，就是在这份代码外面再包一层 ERC721。

---

## 三、两种让表情跟着价格变的办法

知道价格怎么读之后，还有一个设计问题要先定：**价格变了，谁来触发 NFT 换表情？**这里有两种做法，选哪种，决定了合约要怎么写。

### 做法 A：被问到时现读现算（这篇的主线）

`tokenURI` 本来就是一个 view 函数——钱包问它，它才返回答案。我们可以在 `tokenURI` 里面当场读一次喂价，当场判断涨跌，当场决定返回哪份 metadata。

```
钱包问 tokenURI(0) ──► 合约现读 BTC 价格 ──► 和 Mint 时的价格比一比
     ──► 涨了 5% 以上，返回笑脸 metadata
     ──► 跌了 5% 以上，返回哭脸 metadata
     ──► 中间，返回平静脸 metadata
```

好处很明显：**不用任何定时任务，不用 LINK，不用 upkeep**。价格变了，下一次有人打开钱包问 `tokenURI`，表情自动就是新的。坏处也有：NFT 自己不会“主动”变脸——没人问它，它就静静待在那；而且每次返回的答案取决于“被问的那一刻”的价格，同一张 NFT 在不同时间被问，可能返回不同的 metadata。OpenSea 那边还要手动点刷新（30 篇讲过，刷新是异步排队，没有固定时长），不然你看到的还是缓存里的旧脸。

### 做法 B：定时触发，改写存好的 tokenURI（官方教程的做法）

Chainlink 官方有一篇《Dynamic Metadata with Automation》的教程，做法是另一条路：合约里存一个 `tokenURI`，再写一个符合 Automation 规范的 `checkUpkeep` / `performUpkeep`，每隔一段时间（教程里是 30 秒）自动触发一次，读价格、改写存好的 `tokenURI`。花开了几片叶子、NFT 到了哪个阶段，都是这么推进的。

这条路的好处是 NFT 会“自己动”，不用等别人来问。但有两个地方，2026 年 11 月的现在不能照抄：

第一，**Chainlink Automation 正在退役**。33 篇核对过的时间线：Automation v1.x 在 2026 年 6 月 30 日弃用、v2.1 在 2026 年 7 月 31 日弃用、测试网 2026 年 6 月 2 日已下线，2027 年 6 月 2 日全面下线，接替它的是 Chainlink Runtime Environment（CRE）。官方那篇教程现在页面上还写着 Automation，但新项目照着它注册 upkeep，等于往一条正在关闭的路上走。34 篇已经按这个方向改成了 CRE 的写法。

第二，定时改写要花钱。每次触发都是一次链上写操作，要付 Gas，还要给 upkeep 充 LINK。只为换一张表情，每 30 秒付一次 Gas，性价比很低。

所以这篇选做法 A：**把判断写进 `tokenURI`，被问到时现读现算**。对一张变脸 NFT 来说，这是最简单、最便宜、也最不容易出错的做法。如果你以后确实需要 NFT 自己定时动起来，再去看 CRE 的文档——34 篇第五节那份 CRE Keeper Bot 模板就是起点。

|  | 做法 A：现读现算 | 做法 B：定时改写 |
| --- | --- | --- |
| 判断写在哪 | `tokenURI` 里，每次被问时算 | `performUpkeep` 里，定时触发时算 |
| 要不要 upkeep / LINK | 不用 | 要， upkeep 要充 LINK |
| 花不花 Gas | 读是 view 调用，不花钱 | 每次触发都要写链上，花 Gas |
| NFT 会不会自己动 | 不会，等别人来问 | 会，按设定的间隔自己动 |
| 官方教程 | —— | 《Dynamic Metadata with Automation》，但 Automation 正在退役，新项目应走 CRE |
| 适合 | 变脸、按价格换图这类“读时决定”的场景 | 花开、养成、倒计时这类“到点推进”的场景 |

---

## 四、动手写一份 MoodNFT 合约

设计定下来，开始写代码。这份合约叫 `MoodNFT`，跑在 Sepolia 上，逻辑很简单：

1. Mint 的时候，读一次当时的 BTC 价格，记下来当“基准价”。
2. 以后每次有人问 `tokenURI`，再读一次现在的价格，跟基准价比。
3. 涨了 5% 以上 → 笑脸；跌了 5% 以上 → 哭脸；中间 → 平静脸。

三张脸对应三份 metadata，事先传到 IPFS 上。metadata 里 `image` 指向三张不同的图，`attributes` 里写上当时的心情和价格区间。传 IPFS 的步骤 31 篇讲过，这里直接用占位地址代替，你动手时换成自己的：

```
笑脸 metadata：ipfs://QmHappy.../0.json
平静脸 metadata：ipfs://QmCalm.../0.json
哭脸 metadata：ipfs://QmSad.../0.json
```

合约全文如下，在 Remix 里新建 `MoodNFT.sol` 就能编译：

```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MoodNFT is ERC721, Ownable {
    AggregatorV3Interface internal priceFeed;

    uint256 private _tokenIdCounter;

    // Mint 时的 BTC 价格（8 位小数），当作判断涨跌的基准
    mapping(uint256 => int256) public mintPrice;

    string private happyURI = "ipfs://QmHappy.../0.json";
    string private calmURI = "ipfs://QmCalm.../0.json";
    string private sadURI = "ipfs://QmSad.../0.json";

    // Sepolia BTC/USD 喂价
    constructor() ERC721("Mood NFT", "MOOD") Ownable(msg.sender) {
        priceFeed = AggregatorV3Interface(0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43);
    }

    function mint(address to) public onlyOwner {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        // Mint 当场读一次价格，记下来
        (, int256 price, , , ) = priceFeed.latestRoundData();
        mintPrice[tokenId] = price;
        _safeMint(to, tokenId);
    }

    // 每次被问到 tokenURI，都现读一次价格再决定返回哪份 metadata
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        (, int256 currentPrice, , , ) = priceFeed.latestRoundData();
        int256 basePrice = mintPrice[tokenId];

        // 涨了 5% 以上：笑脸
        if (currentPrice * 100 >= basePrice * 105) {
            return happyURI;
        }
        // 跌了 5% 以上：哭脸
        if (currentPrice * 100 <= basePrice * 95) {
            return sadURI;
        }
        // 中间：平静脸
        return calmURI;
    }

    function getLatestPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price;
    }
}
```

几处要说明的地方：

**为什么用 Mint 时的价格当基准？** 用一个固定的数字（比如 100,000 美元）当分界线也可以，但 BTC 的价格区间一直在变，写死一个数字，过几个月就失效了。用 Mint 时的价格当基准，每张 NFT 都有自己的参照点：不管你什么时候 Mint，笑脸永远表示“比你 Mint 那会儿涨了 5% 以上”。这个做法还有一个好处——每张 NFT 的“心情”都是相对它自己的出生价而言的，讲起来也好理解。

**为什么阈值是 5%？** 因为喂价不是每秒都在变的，而且 BTC 一天上下浮动 1-2% 很常见。阈值设得太小（比如 0.5%），表情会来回跳，今天笑、明天哭、后天又笑，看着很闹心；设得太大（比如 50%），一年也变不了一次脸。5% 是个练手用的中间值，你可以按自己的想法改。

**`tokenURI` 里为什么能调 `latestRoundData()`？** 因为 `tokenURI` 和 `latestRoundData()` 都是 view 函数，只读不写。view 函数里调 view 函数，是完全合法的。而且 `tokenURI` 被钱包调用时，调用方付的只是读数据的成本，不用上链、不花 Gas。

**`currentPrice * 100 >= basePrice * 105` 这行会不会溢出？** `currentPrice` 是 int256，BTC 价格 8 位小数大概是 10 万后面加 8 个 0，也就是 10^13 量级，乘以 100 是 10^15，离 int256 的上限（约 10^77）还差得远，不用担心。真正要注意的是 `answer` 有没有可能是负数或 0——价格喂价正常情况下不会是负数，但严谨的写法应该先检查 `answer > 0`，第六节会讲。

**OpenZeppelin 的版本**：这份代码按 OpenZeppelin Contracts v5.x 写（`Ownable(msg.sender)` 这种构造函数传地址的写法是 v5 的风格，v5.7 是 2026 年 7 月 30 日发布的最新版）。如果你在 Remix 里用向导生成的旧版代码，`Ownable` 的写法会不一样，编译不过时先看版本。

---

## 五、部署、Mint、看它变脸

合约写好了，接下来在 Sepolia 上跑一次。流程和 32 篇部署 NFT 那篇一样，这里只讲这篇特有的步骤。

### 第 1 步：准备三张图和三份 metadata

先画（或找）三张脸：笑脸、平静脸、哭脸，传到 IPFS 上。再写三份 metadata JSON，每份的 `image` 指向其中一张图，`attributes` 里写上心情：

```
{
  "name": "会变脸的 NFT #0",
  "description": "一张跟着 BTC 价格改变表情的 NFT",
  "image": "ipfs://QmHappy.../happy.png",
  "attributes": [
    { "trait_type": "心情", "value": "开心" },
    { "trait_type": "状态", "value": "BTC 比 Mint 时涨了 5% 以上" }
  ]
}
```

三份 metadata 只有 `image` 和 `attributes` 不一样，`name` 和 `description` 可以共用一套。把这三份 JSON 也传到 IPFS，拿到三个地址，填进合约里的 `happyURI` / `calmURI` / `sadURI`。

这里有个新手经常犯的错：**metadata 的 `image` 一定要指向图片文件，不能指向另一份 metadata**。`image` 字段里放 JSON 地址，钱包会把 JSON 当图片去解析，结果就是一片空白。

### 第 2 步：Remix 编译、部署到 Sepolia

Remix 里打开 `MoodNFT.sol`，编译器选 0.8.20 以上，部署时环境选 Injected Provider 接 MetaMask，网络切到 Sepolia。部署要花一点测试网 ETH，读喂价不花钱。

部署成功后，先调一次 `getLatestPrice()` 看看：返回的数字应该是 8 位小数的 BTC 价格，比如 `9740000000000`。如果返回的是 0 或者一串看不懂的小数字，先别急着 Mint，检查一下喂价地址是不是抄错了——十有八九是把主网地址抄到了 Sepolia 上。

### 第 3 步：Mint 一张，看它现在是什么表情

调 `mint()`，`to` 填自己的钱包地址。Mint 成功后，立刻调 `tokenURI(0)` 看返回的是哪个地址：

```
Mint 时 BTC 97,400 美元
  │
  ├─ 现在 102,500 美元（涨了 5.2%）──► 返回 happyURI，笑脸
  ├─ 现在 96,000 美元（跌了 1.4%）──► 返回 calmURI，平静脸
  └─ 现在 91,000 美元（跌了 6.6%）──► 返回 sadURI，哭脸
```

Mint 完那一刻，现价和基准价是同一个数，涨跌幅是 0，所以第一次查一定是平静脸。这很正常——NFT 刚出生，还没见过涨跌。

### 第 4 步：去 OpenSea 上看它

把合约地址粘到 OpenSea 测试网（testnets.opensea.io）上搜，就能看到你这张 NFT。刚 Mint 完它显示的可能是平静脸；等 BTC 价格真的波动超过 5% 之后，在 OpenSea 页面上点右上角的刷新 metadata 按钮，再等一会儿，表情就会换过来。

这里要提醒一句 30 篇讲过的：**OpenSea 刷新 metadata 是异步排队的，没有固定时长**。点了刷新不是立刻就变，有时候几分钟，有时候要等更久。刷新完还没变，先别急着改合约——去 Etherscan 上直接调 `tokenURI(0)` 看合约返回的是什么。如果合约返回的已经是笑脸的地址，只是 OpenSea 还没刷新出来，那就是 OpenSea 的缓存问题，不是你的合约问题。

```
Sepolia 部署 MoodNFT
        │
        ▼
mint() ──► 记下 Mint 时的 BTC 价格（基准价）
        │
        ▼
钱包 / OpenSea 问 tokenURI(0)
        │
        ▼
合约现读 BTC/USD 喂价 ──► 和基准价比涨跌
        │
        ├─ 涨 ≥ 5% ──► 笑脸 metadata
        ├─ 跌 ≥ 5% ──► 哭脸 metadata
        └─ 中间 ──► 平静脸 metadata
```

---

## 六、经常踩的坑

这篇的合约不长，但新手第一次写，十有八九会在下面这几个地方栽跟头。按踩中的频率排个序：

### 1. 8 位小数忘了处理

这是最容易出现的问题，没有之一。`answer` 返回的是 `9740000000000`，不是 `97400`。如果你拿这个数直接跟 `100000` 比，合约会以为 BTC 涨了几百万倍，NFT 永远笑脸。

这篇的合约躲开了这个问题——因为比较的是“现价和基准价的比值”，两边都是 8 位小数，约掉了。但如果你想在合约里算“BTC 现在到底多少钱”，就得自己除以 `1e8`：`9740000000000 / 1e8 = 97400`。更稳妥的做法是调喂价的 `decimals()` 先问它有几位小数，不要把 8 写死在代码里——万一哪天你换了一个 18 位小数的喂价，写死的 8 就全错了。

### 2. 喂价地址抄错链

Sepolia 的 BTC/USD 是 `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43`，主网是 `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c`。两个地址长得都不短，抄错一位，或者把主网的抄到测试网，读出来的价格就是错的。部署之前，先去官方文档的 Price Feed Addresses 页面按链查一遍，别凭记忆抄。

### 3. 拿了底层聚合器地址，没拿代理地址

喂价合约分两层：外面一层是代理（proxy），里面一层是真正干活的聚合器。Chainlink 升级聚合器的时候，代理地址不变，里面换掉。**合约里永远写代理地址**。文档里给的地址都是代理地址，直接抄文档的就行；如果你是从 Etherscan 上随手复制的地址，先确认它是不是代理。

### 4. 没检查数据新不新鲜

`latestRoundData()` 返回的 `updatedAt` 是这轮报价的更新时间。如果喂价出问题、节点长时间没更新，你读到的可能是几个小时前的旧价格。严谨的写法是先判断一下：

```
(, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
require(block.timestamp - updatedAt < 3600, "price is stale");
```

这篇的教学合约为了简洁没加这行，但你真要往生产方向走，这行不能省。`answer <= 0` 也要顺手检查一下，防止喂价返回异常值。

### 5. 以为喂价是实时价格

喂价不是交易所的实时行情。它是多个节点报价聚合出来的结果，价格波动幅度够大、或者到了心跳时间，才会更新一次。主网 BTC/USD 的心跳大约是 1 小时。也就是说，BTC 在交易所一分钟内涨了 1%，喂价可能纹丝不动。拿喂价做变脸 NFT 没问题，因为表情不需要秒级反应；但拿它做短线交易的价格源，就是用错了工具。

### 6. OpenSea 刷新了，表情还是没变

点了刷新、等了半天，表情还是旧的。先别急着改合约，按这个顺序查：第一，去 Etherscan 上直接调 `tokenURI(0)`，看合约返回的是不是新的 metadata 地址——如果合约返回的还是旧的，说明价格还没波动到阈值，或者你的阈值算错了；第二，如果合约返回的已经是新的，那就是 OpenSea 还在排队，再等一会儿，或者换个钱包看一眼。

### 7. 阈值设得太小，表情来回跳

阈值设 0.5%，BTC 一天正常波动就能让表情一天变好几次，看着很闹心。阈值设 50%，可能一年也变不了一次脸。5% 是练手用的中间值，正式玩的时候可以根据自己的想法调——甚至可以设多档：涨 5% 微笑、涨 10% 大笑、涨 20% 狂喜，表情越多越好玩。

还有一个更细的点：价格在阈值附近来回晃的时候，表情会在两档之间反复横跳。比如 BTC 在 +5% 上下徘徊，一会儿笑脸、一会儿平静脸。解决办法是给上行和下行用不同的阈值，留出一段“缓冲带”：涨到 +5% 才换笑脸，但要跌回 +3% 以下才换回平静脸。这叫迟滞（hysteresis），做硬件和交易系统的人常用，道理就是别让一个抖动的地方反复触发切换。

### 8. 照着官方 Automation 教程注册了 upkeep

官方那篇《Dynamic Metadata with Automation》教程本身没错，但它用的 Automation 正在退役（33 篇的时间线：2027 年 6 月 2 日全面下线）。现在照着它注册 upkeep、充 LINK，等于往一条正在关闭的路上走。只想让 NFT 跟着价格变脸，做法 A（`tokenURI` 里现读现算）就够了，不用 upkeep；真需要定时触发，新的做法是 CRE，34 篇第五节有 CRE Keeper Bot 的模板可以参考。

---

## 七、还能怎么玩

变脸 NFT 跑通之后，这个模式能套到很多地方去，思路都是一样的：**找一个喂价 → 定一个判断条件 → 让 `tokenURI` 返回不同的 metadata**。

- **换个喂价**：把 BTC/USD 换成 ETH/USD，NFT 就跟着 ETH 价格变脸；换成 LINK/USD、SOL/USD 也一样，地址去 Price Feed Addresses 页面查。
- **多档表情**：不止三档，可以设五档、七档：涨 5% 微笑、涨 10% 大笑、跌 5% 难过、跌 10% 大哭。档位越多，metadata 和图片准备得越多，但合约逻辑不变，只是多几个 `if`。
- **不只看价格**：Data Feeds 不只有价格，还有储备量证明（Proof of Reserve）这类数据。思路一样：读一个数，按区间返回不同的 metadata。
- **表情之外的变化**：`attributes` 里也可以跟着变，比如心情从“开心”变成“难过”，稀有度标签从“普通”变成“狂喜”。OpenSea 会直接显示这些属性，不用换图也能看出来。
- **和下一篇文章连起来**：这篇的三张脸是事先画好、传到 IPFS 上的图片。下一篇（40 篇）讲的是另一种做法——**图片本身也由合约在链上生成**，连 IPFS 都不用。到时候你会看到，同样的变脸逻辑，换成链上 SVG，整个 NFT 就完全不需要链下存储了。

---

## 总结

- **NFT 的表情存在 metadata 里**：`tokenURI` 返回哪份 metadata，你就看到哪张脸。让 NFT 变脸，就是让 `tokenURI` 的答案跟着外部数据变。
- **BTC 价格靠 Data Feeds 读进来**：Sepolia BTC/USD 喂价是 `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43`，8 位小数，`latestRoundData()` 返回的 `answer` 是 `9740000000000` 这种带 8 个 0 的数。读喂价是 view 调用，不花 Gas、不用 LINK。
- **最简单的做法是现读现算**：在 `tokenURI` 里当场读价格、当场比涨跌、当场决定返回哪份 metadata。不用 upkeep、不用定时任务，价格变了，下一次被问到时表情自动就是新的。
- **官方教程的 Automation 做法正在过时**：Automation v1.x、v2.1 已弃用，2027 年 6 月 2 日全面下线，新项目要走 CRE。只想变脸的话，现读现算的做法连 CRE 都不用。
- **最容易踩的坑**：8 位小数忘了处理、喂价地址抄错链、拿了底层聚合器地址而不是代理地址、没检查 `updatedAt` 新不新鲜、以为喂价是实时价格、OpenSea 刷新是异步排队要等、阈值设太小表情来回跳。

---

## 下一篇是第 40 篇：

[[y7blog-web3-41]]

这篇的三张脸是事先画好、传到 IPFS 上的。下一篇换一种做法：图片本身也由合约在链上生成——SVG 代码直接写进合约，`tokenURI` 返回的 metadata 里就带着图片，连 IPFS 都不用。到时候你会看到，一张完全不需要链下存储的 NFT 是怎么拼出来的，以及这种做法的代价是什么。

*参考资料：Chainlink 官方文档《Using Data Feeds on EVM Chains》（docs.chain.link/data-feeds/using-data-feeds，2026-11-21 更新；Sepolia BTC/USD 喂价 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43、AggregatorV3Interface、DataConsumerV3 示例）；Chainlink 官方文档《Consuming Data Feeds》（docs.chain.link/data-feeds/getting-started，2026-11-21 更新；BTC/USD 喂价 8 位小数、answer 3030914000000 对应 30309.14 美元、Sepolia 测试网读价免费）；Chainlink 官方文档《Data Feeds API Reference》（docs.chain.link/data-feeds/api-reference，2026-11-21 更新；latestRoundData 五个返回值、优先用代理地址、Sepolia ETH/USD 0x694AA1769357215DE4FAC081bf1f309aDC325306）；Chainlink 官方文档《Dynamic Metadata with Automation》（docs.chain.link/quickstarts/dynamic-metadata；Automation upkeep 定时改写 tokenURI 的做法、30 秒间隔、花开示例；注：Automation 正在退役，33 篇已核对 v1.x 2026-06-30 弃用、v2.1 2026-07-31 弃用、2027-06-02 全面下线，接替者为 CRE）；evmquery《Chainlink Price Feed Reader》（evmquery.com/tools/chainlink-price-feed；主网 BTC/USD 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c、8 位小数、心跳 3600 秒，各链地址经 Chainlink 参考数据目录交叉核对）；Oodles Blockchain《A Developer Guide to Creating a Dynamic NFT》（blockchain.oodles.io/dev-blog/create-dynamic-nft/；动态 NFT 结构、Data Feeds + Automation 组合、updateTokenMetadata 与 MetadataUpdated 事件）；Simple NFT Creator《What Are Dynamic NFTs? How On-Chain Data Changes Your Art》（simplenftcreator.com/dynamic-nfts-on-chain-metadata-explained/；tokenURI 决定显示内容、按价格趋势换牛熊图是常见教学示例、LaMelo Ball 用 Chainlink 体育数据更新球星卡）；Klaytn Metaverse Knowledge Kit《dNFT》（metaverse-knowledge-kit.klaytn.foundation/docs/dynamic-nfts/tutorial；用价格喂价更新 NFT metadata、checkUpkeep / performUpkeep 定时触发写法）；OpenZeppelin《Introducing OpenZeppelin Contracts 5.7》（openzeppelin.com，2026-07-30；ERC721、Ownable 构造函数传地址的 v5 写法）；30 篇《什么是动态 NFT？NFT 为什么可以自己发生变化？》（动态 NFT 概念、OpenSea 刷新 metadata 是异步排队、无固定时长）；33 篇《Chainlink Automation 是什么？让智能合约自动执行》（Automation 退役时间线、接替者 CRE）；34 篇《动态 NFT + CRE：让 NFT 自动改变属性》（CRE Keeper Bot 模板、定时触发改写的做法）。*
