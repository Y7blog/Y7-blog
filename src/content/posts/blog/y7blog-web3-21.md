---
title: 20｜从 ERC20 到价格预言机：做一个链上 Token 购买系统
published: 2026-10-27
pinned: false
draft: false
comment: true
description: 手里有了自己的 ERC20 Token，也学会了读链上的实时价格，下一步就是把它们拼成一个能真正运转的系统：一个按实时 ETH 价格卖 Token 的链上自动售货机。本文带你从零写出 TokenSale 合约——先读 Chainlink 喂价算出 1 个 ETH 能换多少 Token，再处理 8 位与 18 位小数的换算坑，最后在 Remix 里部署、转入 Token、实测买入，并在 Sepolia 浏览器上验证全过程。
image: https://www.y7img.ccwu.cc/file/动态图标/1794272835270_y7blog-web3-21-1600.png
tags: [ERC20,预言机,Chainlink,智能合约,Token 购买]
category: Web3
slug: blog/y7blog-web3-21
series: "区块链百科"
seriesOrder: 1
---

上一篇我们搞懂了一个很底层的问题：智能合约为什么不能直接上网，以及价格数据必须怎样进来。

现在，拼图的碎片已经齐了：

- 第 15、16 篇：你有了一个自己的 ERC20 Token，知道它是怎么发行、转账和授权的；
- 第 17、18 篇：你学会了让合约读 Chainlink Data Feeds，拿到链上的实时价格；
- 第 19 篇：你明白了价格为什么必须以这种方式进来，而不是合约自己上网去查。

今天，我们把这些碎片拼成一个**能真正运转的东西**：一个链上 Token 购买系统。

想象一台自动售货机：你投进去 ETH，它按当时的市场价，自动把对应数量的 Token 吐给你。不需要客服、不需要人工报价、不需要你去哪个交易所挂单——规则写进合约，任何人、任何时间都能来买，价格永远按实时行情算。

这篇文章会带你亲手把它做出来。从「为什么不能写死汇率」开始，到算式、小数换算、完整合约代码，再到 Remix 部署和链上验证，一步都不少。

> ⚠️ **先说清楚**：今天做的系统跑在 **Sepolia 测试网**上，用的全是测试币，没有任何真实价值。它是一个教学用的最小模型，不是能直接上主网卖 Token 的产品——文末会专门讲它离「真正能用」还差什么。**本文是知识科普，不是投资建议。**

---

## 一、我们要做什么：一台链上的自动售货机

先把目标说清楚，免得写着写着跑偏。

### 这个系统长什么样？

系统里只有两个主角：

| 角色 | 是什么 | 从哪来 |
|---|---|---|
| **你的 Token** | 第 16 篇亲手创建的 ERC20 Token，比如叫 Y7 Token | 你自己部署的合约 |
| **TokenSale 合约** | 今天要写的新合约，负责「收 ETH、发 Token」 | 今天写 |

再加上一个帮手：**Chainlink ETH/USD Data Feeds**（第 18 篇的老朋友），负责告诉合约「现在 1 个 ETH 值多少美元」。

整个购买过程只有三步：

```
买家
  │
  │ ① 发送 ETH（比如 0.1 ETH）
  ▼
TokenSale 合约
  │ ② 问 Chainlink：现在 ETH 多少钱？
  │    → 比如 3,000 美元
  │ ③ 按「Token 单价 0.5 美元」算出数量
  │    → 0.1 ETH = 300 美元 = 600 个 Token
  ▼
买家收到 600 个 Y7 Token
```

合约里提前放好一堆 Token（由部署者转进去），ETH 留在合约里，部署者之后可以提走。

### 为什么值得做？

这不是一个玩具例子。它是几乎所有链上「卖东西」的雏形：代币发售、链上商店、DeFi 兑换，背后都是「收一种资产、按价格发另一种资产」。

更重要的是，它把第三阶段的全部知识**串在了一起**：ERC20（第 15、16 篇）+ 预言机（第 17、18 篇）+ 确定性（第 19 篇）。做完这篇，第三阶段的拼图就完整了。

---

## 二、为什么不能写死「1 ETH = 1000 个 Token」？

写合约之前，先想一个问题：最简单的卖法是什么？

最简单的写法，是把汇率写死在合约里：

```solidity
// 最简单的写法——但别这样写
uint256 public constant RATE = 1000; // 1 ETH = 1000 个 Token
```

买家发 1 个 ETH，拿走 1000 个 Token。代码简单、Gas 便宜、不用预言机。看起来很美好，对吧？

问题是：**ETH 的价格是活的。**

### 写死汇率，亏的永远是其中一方

假设你发 Token 时定价「1 个 Token = 0.5 美元」，写合约那天 ETH 是 3,000 美元，所以你算出 `1 ETH = 6000 个 Token`，把 6000 写死进合约。

一个月后，ETH 涨到 6,000 美元：买家花 1 个 ETH（现在值 6,000 美元），按写死的汇率只拿到 6000 个 Token（值 3,000 美元）——**买家亏了一半**，没人会再来买。反过来，如果 ETH 跌到 1,500 美元，买家花 1 个 ETH（值 1,500 美元）却拿到价值 3,000 美元的 Token——**你亏了一半**，几天就被买空。

写死汇率，等于你和买家之间有一个人在**赌 ETH 的价格走势**。而价格这东西，一天之内上下波动 10% 都是常事。

### 真正的解法：价格从链外实时读

所以，汇率不能写死，必须**每次交易都现算**：

- Token 的单价（美元）可以固定，比如 0.5 美元一个——这是你定的售价；
- ETH 的美元价格必须实时读取——这是市场定的；
- 每次有人来买，合约先问预言机「ETH 现在多少钱」，再算出「他这笔 ETH 能换多少 Token」。

这正是第 18 篇 Data Feeds 的用武之地，也是第 19 篇那道「墙」的意义所在：**合约不能自己上网查价，但可以读预言机已经写上链的价格。**

这套设计还有一个好处：**定价权和市场价分开了**。你决定「我的 Token 卖多少钱一个」，市场决定「ETH 现在值多少钱」，合约只负责把两者换算清楚。两边各管各的，互不干扰。

---

## 三、核心算式：1 个 ETH 到底能买多少 Token？

在写代码之前，先把数学算清楚。智能合约里的数学和你平时用的计算器不一样——**它没有小数**。这是新手最容易翻车的地方，值得单独讲透。

### 先算「人话版」

假设：

- ETH 现价：**3,000 美元**
- 你的 Token 单价：**0.5 美元**
- 买家付：**0.1 ETH**

人话版算式很简单：

```
0.1 ETH × 3,000 美元 = 300 美元
300 美元 ÷ 0.5 美元/个 = 600 个 Token
```

答案：600 个 Token。没什么难度。

### 再算「合约版」：小数去哪了？

Solidity 里没有 `0.1`、`3000.5` 这样的小数，所有数字都是整数。区块链用「放大倍数」来表示小数：

| 数字 | 人话 | 合约里的整数 | 放大倍数 |
|---|---|---|---|
| ETH 金额 | 0.1 ETH | 100000000000000000（0.1 × 10¹⁸） | 10¹⁸（wei，18 位小数） |
| ETH 价格 | 3,000 美元 | 300000000000（3,000 × 10⁸） | 10⁸（Chainlink 喂价，8 位小数） |
| Token 单价 | 0.5 美元 | 50000000（0.5 × 10⁸） | 10⁸（和喂价对齐） |
| Token 数量 | 600 个 | 600000000000000000000（600 × 10¹⁸） | 10¹⁸（ERC20 默认 18 位小数） |

注意看：**ETH 用 18 位小数，Chainlink 价格用 8 位小数，Token 用 18 位小数**。三种数字的「放大倍数」各不相同，混在一起算，稍不留神就会差出几万倍。

合约版算式分两步走：

**第 1 步：算出这笔 ETH 值多少美元**

```
美元价值 = ETH 金额 × ETH 价格 ÷ 10⁸
         = 10¹⁷ × 3×10¹¹ ÷ 10⁸
         = 3×10²⁰
```

3×10²⁰ 就是「300 美元」，只不过带着 18 位小数（300 × 10¹⁸）。

为什么除以 10⁸？因为 ETH 金额已经带了 18 位小数，ETH 价格又带了 8 位小数，乘出来就带了 26 位小数；我们要的是 18 位小数，所以要除掉多余的 8 位。

**第 2 步：用美元价值除以 Token 单价**

```
Token 数量 = 美元价值 × 10⁸ ÷ Token 单价
           = 3×10²⁰ × 10⁸ ÷ 5×10⁷
           = 6×10²⁰
```

6×10²⁰ 就是「600 个 Token」，带着 18 位小数（600 × 10¹⁸）。

为什么这里是乘以 10⁸ 再除？因为 Token 单价带了 8 位小数，直接除会把结果缩小 10⁸ 倍，所以要先乘回来。

### 记住这条换算口诀

小数换算最容易错，记住这句口诀就够了：

> 💡 **乘的时候，小数位数会相加；除的时候，小数位数会相减。算完之后，对照目标的小数位数，多了就除、少了就乘，补到一样为止。**

写完算式，**一定要拿一组具体数字手算一遍**（就像上面这样），确认结果和你心算的一致，再部署。链上交易不可逆，算错了就是真金白银的损失——测试网上是测试币，主网上可没有「撤回」按钮。

---

## 四、写合约：TokenSale 的完整代码

数学清楚了，代码就水到渠成了。下面是完整合约，每一段都有注释。你可以直接复制到 Remix 里用。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title TokenSale：按实时 ETH 价格出售 ERC20 Token
/// @notice 教学演示合约，未经审计，仅用于 Sepolia 测试网
contract TokenSale {
    IERC20 public token;                  // 要出售的 Token 合约
    AggregatorV3Interface public priceFeed; // ETH/USD 喂价合约
    address public owner;                 // 合约拥有者（部署者）
    uint256 public tokenPriceUSD;         // 每个 Token 的美元售价，带 8 位小数
    uint256 public constant MAX_PRICE_AGE = 3600; // 价格最长 1 小时，过期拒绝交易

    event TokensPurchased(
        address indexed buyer,
        uint256 ethSpent,
        uint256 tokensBought
    );

    constructor(
        address _token,
        address _priceFeed,
        uint256 _tokenPriceUSD
    ) {
        token = IERC20(_token);
        priceFeed = AggregatorV3Interface(_priceFeed);
        tokenPriceUSD = _tokenPriceUSD;
        owner = msg.sender;
    }

    /// @notice 读取 ETH 最新价格，并检查价格是否新鲜
    /// @return price ETH 美元价（8 位小数）
    function getEthPrice() public view returns (uint256 price) {
        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
        ) = priceFeed.latestRoundData();
        require(answer > 0, "price invalid");
        require(
            block.timestamp - updatedAt <= MAX_PRICE_AGE,
            "price stale"
        );
        return uint256(answer);
    }

    /// @notice 给定 ETH 金额，算出能买多少 Token（不花钱，先问价）
    function getEstimatedTokens(
        uint256 ethAmount
    ) public view returns (uint256) {
        uint256 ethPrice = getEthPrice();
        // 第 1 步：ETH 金额（18 位）× 价格（8 位）÷ 10^8 = 美元价值（18 位）
        uint256 usdValue = (ethAmount * ethPrice) / 1e8;
        // 第 2 步：美元价值（18 位）× 10^8 ÷ 单价（8 位）= Token 数量（18 位）
        return (usdValue * 1e8) / tokenPriceUSD;
    }

    /// @notice 买 Token：发 ETH，拿 Token
    function buyTokens() external payable {
        require(msg.value > 0, "send ETH to buy");
        uint256 tokens = getEstimatedTokens(msg.value);
        require(tokens > 0, "amount too small");
        require(
            token.balanceOf(address(this)) >= tokens,
            "not enough tokens in sale"
        );
        require(token.transfer(msg.sender, tokens), "transfer failed");
        emit TokensPurchased(msg.sender, msg.value, tokens);
    }

    /// @notice 拥有者提取合约里收到的 ETH
    function withdrawETH() external {
        require(msg.sender == owner, "only owner");
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }

    /// @notice 拥有者调整 Token 售价（美元，8 位小数）
    function setTokenPriceUSD(uint256 _tokenPriceUSD) external {
        require(msg.sender == owner, "only owner");
        tokenPriceUSD = _tokenPriceUSD;
    }
}
```

### 代码里值得停下来想的五个点

**1. 为什么 `getEthPrice` 要检查 `updatedAt`？**

第 18 篇讲过：喂价不是每秒更新的，Sepolia 的 ETH/USD 大约每 20 分钟或价格波动 0.5% 时更新一次。如果预言机网络出故障、价格三天没更新，你的合约还按三天前的价格卖 Token，就是在按错误的价格做生意。

`MAX_PRICE_AGE = 3600` 的意思是：价格超过 1 小时没更新，交易直接拒绝。**宁可不卖，也别按过期价格卖。** 这是第 19 篇「检查新鲜度」那条判断力的直接落地。

**2. 为什么要单独写一个 `getEstimatedTokens` 的 view 函数？**

买家在付款之前，总想先知道「我这 0.1 ETH 能拿到多少 Token」。这个函数是 `view` 的——只读不花钱，钱包和前端可以直接调用它显示预估数量，买家确认划算再点「购买」。

这也是个很好的调试习惯：部署后先调这个函数，看算出来的数字对不对，再真金白银地买。

**3. 为什么 `buyTokens` 里先算数量、再转账、最后才发事件？**

顺序是：检查（`require`）→ 算数 → 转 Token → 记事件。这叫「检查—生效—交互」模式，是 Solidity 里防止重入攻击的基本功：**先把自己合约的状态处理完，再和外部合约打交道**。今天这个合约很简单，只转了一次 Token，但把这个顺序养成习惯，以后写复杂合约时能帮你躲掉一大类漏洞。

**4. `owner` 能调价，是优点还是隐患？**

优点是灵活：你想搞促销、想调价，不用重新部署合约。隐患是中心化：`owner` 一个人就能改价格，改成 0.0001 美元就能把 Token 贱卖给自己。

教学演示里这样写没问题，但你要知道：**真正上主网的发售合约，不会把调价权交给一个人的钱包**，而是交给多签钱包或者 DAO 投票，或者干脆把价格写死、到期自动结束。中心化程度，是判断一个发售项目靠不靠谱的重要指标。

**5. 合约里的 Token 从哪来？**

注意：`TokenSale` 合约**不会自己印 Token**。它只负责卖别人转给它的 Token。部署之后，你必须先把一部分 Token 转到销售合约的地址上，它才有货可卖。转多少、卖完怎么办，下一节部署步骤里会讲。

这个设计是故意的：发 Token 和卖 Token 是两件事，分开写，职责才清晰。第 16 篇的合约管「印」，今天的合约管「卖」。

---

## 五、在 Remix 里部署并实测

理论讲完了，上手跑一遍。整个流程大约 15 分钟，全部在 Sepolia 测试网上完成。

### 准备工作

开始之前，确认三样东西就绪：

1. **MetaMask 已切换到 Sepolia 测试网**（链 ID 11155111），钱包里有少量测试 ETH（水龙头免费领，第 10 篇讲过）；
2. **你的 ERC20 Token 已经部署在 Sepolia 上**——用第 16 篇的方法，或者直接用那篇部署好的合约地址；
3. **Remix 已打开**（remix.ethereum.org），环境选 **Injected Provider - MetaMask**。

### 第 1 步：部署 TokenSale 合约

在 Remix 里新建文件 `TokenSale.sol`，粘贴第四节的完整代码，编译通过后部署。部署时构造函数要填三个参数：

| 参数 | 填什么 | 例子 |
|---|---|---|
| `_token` | 你的 ERC20 Token 合约地址 | 第 16 篇部署的地址 |
| `_priceFeed` | Sepolia ETH/USD 喂价地址 | `0x694AA1769357215DE4FAC081bf1f309aDC325306` |
| `_tokenPriceUSD` | Token 单价（美元，8 位小数） | 0.5 美元 → `50000000` |

> ⚠️ **注意**：喂价地址每个网络、每个交易对都不一样。Sepolia 的 ETH/USD 是上面这个地址，主网是另一个，抄错地址，你的合约读到的就是另一条链上另一份数据——或者干脆读不到。部署前务必去 Chainlink 官方目录（data.chain.link）按「网络 + 交易对」核对一次。

### 第 2 步：给销售合约「上货」

部署成功后，打开你的 Token 合约（第 16 篇那个），调用 `transfer`，把一部分 Token 转到 TokenSale 合约的地址上。

比如转 **100,000 个 Token**。注意 Remix 里填的数量要带 18 位小数：`100000` 后面跟 18 个 0，也就是 `100000000000000000000000`。嫌数 0 麻烦，可以先在 Token 合约里调 `decimals()` 确认是 18，再数清楚。

转完之后，在 TokenSale 合约里调 `token.balanceOf`（或者直接在 Token 合约里查 TokenSale 地址的余额），确认货已上架。

### 第 3 步：先问价，再买入

付款之前，先调 `getEstimatedTokens`，输入 `100000000000000000`（0.1 ETH，带 18 位小数），看看返回多少。

假设 ETH 现价 3,000 美元、Token 单价 0.5 美元，你应该看到大约 `600000000000000000000`——也就是 600 个 Token（带 18 位小数）。如果数字差了几万倍，回去检查第三节的换算；如果数字完全不对，检查 `_tokenPriceUSD` 是不是忘了乘 10⁸。

问价没问题，就可以真买了：在 Remix 里选中 `buyTokens`，在上方的 **Value** 栏填 `0.1`、单位选 **Ether**，点 transact，MetaMask 确认。

### 第 4 步：去浏览器上验证

交易确认后，打开 Sepolia Etherscan（sepolia.etherscan.io），做三件事：

1. **查你的钱包地址**：Token 余额是不是多了 600 个？交易记录里是不是有一笔来自 TokenSale 合约的转账？
2. **查 TokenSale 合约地址**：ETH 余额是不是多了 0.1？事件（Events）里是不是有一条 `TokensPurchased`，buyer 是你、ethSpent 是 0.1、tokensBought 是 600？
3. **点开那笔交易的详情页**：把第 13 篇学过的本事用上——看 From、To、Status、Gas、Token Transfers，确认每一项都和你想的一样。

如果三项都对得上，恭喜你：**你刚刚亲手跑通了一个链上 Token 购买系统。** 从「写合约」到「收钱发货」，全程没有中间人。

---

## 六、这个系统有哪些坑？（离「真正能用」还差什么）

跑通了，不等于能直接拿去卖 Token。教学模型和生产系统之间，隔着下面这几道坎。知道它们的存在，比会写代码更重要——以后你评估任何一个发售项目，都可以用这张清单去对照。

### 坑 1：价格在「你点购买」和「交易上链」之间变了

你点下购买时 ETH 是 3,000 美元，交易在内存池里等了 30 秒才被打包，这 30 秒里 ETH 涨到 3,100 美元。合约按打包那一刻的价格算，你拿到的 Token 比点下购买时预估的少了。

这叫**滑点**。真正的交易系统会让买家设一个「最少接受数量」：低于这个数，交易直接失败、ETH 退回。今天的合约没有这个保护——买家只能被动接受打包时的价格。

### 坑 2：价格只检查了「新鲜度」，没检查「合理性」

我们的合约只问了「价格是不是 1 小时内更新的」，没问「这个价格合理吗」。如果预言机被攻击、喂了一个离谱的价格（比如 ETH 突然变成 1 美元），合约会一本正经地按 1 美元卖 Token，几分钟就被搬空。

生产级系统会加**价格合理性检查**：比如和上一次的价格比，单次波动超过 10% 就暂停；或者同时读两个喂价，互相印证。第 18 篇第七节讲的那四个注意事项，放在这里同样适用。

### 坑 3：没有发售上限和时间窗口

今天的合约：只要里面有货，任何人、任何时间、买多少都行。真实的 Token 发售通常有总量上限（卖完即止）、单人限购、时间窗口和白名单。这些规则每加一条，都是几行代码的事，但每一行背后都是一个业务决策。

### 坑 4：owner 的权力太大

前面提过：`owner` 一个人能改价格、能提走全部 ETH。如果 owner 的私钥泄露，或者 owner 本人作恶，整个系统就是他的提款机。

缓解办法按强度递进：**多签钱包**（改价要几个人一起签字）→ **时间锁**（改价 24 小时后才生效，给大家反应时间）→ **去中心化治理**（交给 Token 持有者投票）。越往后越安全，也越复杂。

### 坑 5：合约未经审计

这篇的代码我手写给你、你手敲进 Remix，它能跑，不代表它没漏洞。真实项目上主网之前，会请专业审计公司逐行审代码、做攻击模拟，费用通常是几万到几十万美元。**未经审计的合约不要放真钱**，这条红线没有任何例外。

> ⚠️ **风险提示**：本文是知识科普，不是投资建议。参与任何 Token 发售之前，除了看合约代码，还要看审计报告、团队背景、Token 经济模型和发售规则。不要因为一个合约「能跑通」就默认它安全——「能跑」和「安全」之间，差着一整套专业检查。

---

## 七、回顾：第三阶段，我们学会了什么？

第 20 篇是第三阶段「Token、Oracle 与链上数据」的最后一篇。走到这里，值得停下来，把这一阶段的六篇串成一条线：

| 篇目 | 我们学会了什么 |
|---|---|
| **15｜ERC20 是什么？** | Token 不是「币」，而是一份合约里记的账：余额、转账、授权，六个函数就是全部规则 |
| **16｜如何创建自己的 ERC20 Token？** | 用不到 20 行 Solidity，把 ERC20 从概念变成现实：你的 Token 真的上链了 |
| **17｜区块链为什么需要 Oracle？** | 智能合约看不见链外的世界，Oracle 是唯一的「信使」；信使可不可信，决定了整个系统的可信度 |
| **18｜Chainlink Data Feeds 是什么？** | 预言机不是魔法，是 21 个以上独立节点取数、链下聚合、写上链的工程实现；读价格就是调一个合约函数 |
| **19｜智能合约为什么不能直接访问互联网？** | 确定性是区块链的地基：合约不能上网不是缺陷，是全网对得上账的前提；数据进链的唯一方式是先变成交易 |
| **20｜链上 Token 购买系统（本篇）** | 把前面五篇拼成一个能运转的系统：读价格、算数量、收 ETH、发 Token |

如果用一句话概括第三阶段：

> **Token 告诉我们「链上能记什么账」，预言机告诉我们「链外的数据怎么进来」，而购买系统告诉我们「这两样东西拼在一起，能做成什么事」。**

从「理解一个概念」到「亲手做出一个系统」，这是第三阶段最大的跨越。接下来的第四阶段，我们要解决下一个更大的问题：**不同区块链之间，为什么不能直接说话？**

---

## 总结

今天我们把 ERC20 和价格预言机拼成了一个能真正运转的链上 Token 购买系统：

1. **为什么不能写死汇率**：ETH 价格是活的，写死汇率等于让买卖双方赌价格走势，亏的永远是其中一方。
2. **核心算式**：先用 ETH 金额 × 喂价算出美元价值，再除以 Token 单价得到数量；关键是处理好 18 位与 8 位小数的换算，算完一定要拿具体数字手算验证。
3. **TokenSale 合约**：读价（带新鲜度检查）、问价（view 函数先算后买）、买入（检查—生效—交互的顺序）、提款与调价（owner 权限是把双刃剑）。
4. **Remix 实测**：部署、转 Token 上货、先问价再买入、最后去 Sepolia Etherscan 验证余额、事件和交易详情。
5. **五个坑**：滑点、价格合理性、发售上限、owner 权力过大、未经审计——「能跑通」离「能上主网」还差一整套专业检查。

下次再有人问你「Token 是怎么卖的」，你可以直接回答他：

**不是客服手动报价，是合约每次交易都问一次预言机，按实时价格现算现卖。**

---

## 下一篇预告

下一篇是第 21 篇：

[[y7blog-web3-22]]

这是第四阶段「跨链与 CCIP」的开篇。

第三阶段我们一直在一条链上打转：发 Token、读价格、做买卖。但现实世界里不止有一条链——以太坊、Avalanche、Base、Arbitrum……每条链都像一座孤岛，资产和消息过不去。

为什么过不去？是因为技术上做不到，还是因为每条链都有自己的「账本」和「规则」，天生就没法互相读？跨链到底要解决的，是「搬资产」的问题，还是「传消息」的问题？

下一篇，我们就从「孤岛」这个比喻开始，把跨链这件事彻底讲明白。

到时候见。

---

*参考资料：Chainlink 官方文档「Consuming Data Feeds」（docs.chain.link/data-feeds/getting-started），其中给出 Sepolia BTC/USD 喂价地址 `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43`、`latestRoundData` 返回值结构与 8 位小数的说明；Chainlink 官方文档「Price Feed Contract Addresses」（docs.chain.link/data-feeds/price-feeds/addresses），Sepolia ETH/USD 喂价地址 `0x694AA1769357215DE4FAC081bf1f309aDC325306`；Chainlink 官方文档「Selecting Quality Data Feeds」关于喂价新鲜度与最佳实践的说明；OpenZeppelin Contracts 文档 IERC20 接口说明；文中关于 Sepolia 喂价更新频率（约 20 分钟心跳/0.5% 偏差阈值）的描述以 Chainlink 官方文档为准，部署前请以 data.chain.link 官方目录核对地址。*
