---
title: 44｜用 Chainlink VRF 做一个区块链小游戏
published: 2026-11-20
pinned: false
draft: false
comment: true
description: 这篇就动手：用 Chainlink VRF v2.5 在 Sepolia 测试网上做一个猜骰子小游戏。从游戏规则开始，到创建订阅、充值、写 play() 和 fulfillRandomWords，再到 Remix 上完整跑一遍——随机数怎么从一次请求变成一局输赢，整个过程一次讲透，顺带把新手最容易踩的坑都排一遍。
image: https://www.y7img.ccwu.cc/file/1795507771864_y7blog-web3-45-1600.png
tags: [ChainlinkVRF,区块链游戏,智能合约,Solidity,Sepolia]
category: Web3
slug: blog/y7blog-web3-45
series: "区块链百科"
seriesOrder: 1
---

想象一下这个场景：你和朋友在桌上玩猜骰子。你先猜一个数字，1 到 6 之间，然后掷骰子。猜中了，你赢；猜错了，朋友赢。

现在把这个游戏搬到区块链上。规则看起来一样，但多了一个麻烦：**骰子谁来掷？**

现实里，骰子一扔就出结果，谁都看得见，没人能动手脚。链上不一样：智能合约里写 `block.timestamp % 6 + 1`，这个数字所有人都能提前算出来——玩家可以挑一个必赢的时机下注，矿工也能轻微影响它。这就不是游戏了，这是送钱。

这篇就动手解决这个问题：用 Chainlink VRF 做一个真正能玩的猜骰子游戏。游戏很简单，猜一个 1 到 6 的数字，合约向 VRF 要一个随机数，随机数回来之后算出骰子点数，猜中就赢。麻雀虽小，VRF 的整套流程——**订阅、请求、回调、查结果**——都在里面。跑通这一个，抽奖、开箱、抽卡这些玩法，换的只是规则，骨架都一样。

> 💡 **先说清楚**：这篇文章是一篇实操教程，带你在 Sepolia 测试网上用 Chainlink VRF v2.5 写一个猜骰子游戏合约。全程用测试币，不花真钱。本文是知识科普，不是投资建议；涉及真金白银的合约逻辑，上线前一定要经过专业审计，先在测试网把流程跑通。

---

## 一、这个游戏怎么玩？先把规则定下来

写代码之前，先把游戏规则定死。规则不定下来，代码写到一半就得返工。这是经常犯的错：急着写合约，规则却含含糊糊，最后回调里的逻辑和想玩的根本对不上。

我们的游戏叫 DiceGame，规则只有四条：

| 规则 | 内容 |
| --- | --- |
| 怎么玩 | 玩家猜一个 1 到 6 的数字，调 `play(猜的数字)` |
| 怎么算输赢 | 合约向 VRF 要一个随机数，骰子点数 = 随机数 % 6 + 1，点数等于猜的数字就是赢 |
| 等多久 | 随机数不是马上回来，要等几个区块，Sepolia 上通常约 1 分钟 |
| 记什么 | 每个玩家的胜场和总局数都记在链上，谁都能查 |

为什么是猜 1 到 6，而不是猜大小、猜单双？因为规则越简单，合约越好懂。猜中的概率是六分之一，输赢一眼就能看明白。等你把这个跑通了，改成猜大小、掷两个骰子比点数，都是改几行代码的事，这篇最后一节会讲。

还有一个规则，是 VRF 的机制逼出来的：**一局没出结果之前，不能开下一局**。随机数在路上飞的时候，你的上一局还没结算，这时候再猜一次，两个结果会打架。所以合约里要记一个“等待中”的状态，等结果回来了，才能再玩。

整个游戏的流程，长这样：

```
玩家调 play(3)，猜 3 点
    │
    │  合约向 VRF 发请求，记下：这次请求是谁玩的、猜的是 3
    │  玩家状态变成“等待中”
    │
    ▼
VRF 节点生成随机数 + 证明（等几个区块，约 1 分钟）
    │
    ▼
回调 fulfillRandomWords 被调用
    │
    │  骰子点数 = 随机数 % 6 + 1
    │  点数是 3 → 赢了，胜场 +1；不是 3 → 输了
    │  总局数 +1，状态改回“已出结果”
    │
    ▼
玩家查 lastResult，看到点数和输赢
```

这个流程就是 42 篇讲过的“请求—接收”循环，现在它有了一个具体的样子：请求是 `play()`，接收是 `fulfillRandomWords()`，中间等的那一分钟，就是 VRF 在链下生成随机数和证明的时间。

---

## 二、游戏合约的骨架：先把 VRF 接进来

先把合约的骨架搭起来。骨架分三部分：**引入 VRF 的库、写死 Sepolia 的配置、定义要记的数据**。

### 引入的两个库

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract DiceGame is VRFConsumerBaseV2Plus {
}
```

这里有一个新手最容易踩的坑，值得先说：**一定要用 v2.5 的库，也就是名字里带 V2Plus 的这两个**。Chainlink VRF v1 和 v2 已经在 2026 年 11 月停用了——v1 是 11 月 18 日停，v2 是 11 月 30 日停。网上很多老教程用的还是 `VRFConsumerBaseV2`（没有 Plus），照着抄，编译都过不了，或者部署上去根本收不到随机数。认准名字里的 `Plus`，就是 v2.5。

`VRFConsumerBaseV2Plus` 是你要继承的父合约，它里面已经写好了接收随机数回调的入口。`VRFV2PlusClient` 是帮你把请求参数打包成标准格式的工具库。

### Sepolia 的配置参数

```solidity
uint256 s_subscriptionId;
address vrfCoordinator = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;
bytes32 s_keyHash = 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;
uint32 callbackGasLimit = 100000;
uint16 requestConfirmations = 3;
uint32 numWords = 1;
```

这五个参数，每一个都有讲究：

| 参数 | 这篇用的值 | 是什么意思 |
| --- | --- | --- |
| s_subscriptionId | 部署时填 | 你的订阅编号，VRF 的费用从这个订阅里扣，部署合约的时候传进来 |
| vrfCoordinator | 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B | Sepolia 上 VRF 协调器合约的地址，所有请求都发给它 |
| s_keyHash | 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae | Gas 通道，决定你愿意为一次请求付多高的 Gas 价；这个值对应 500 gwei 那条通道 |
| callbackGasLimit | 100000 | 回调函数最多能用多少 Gas；回调里要更新战绩、发事件，给 100000 比较宽裕 |
| requestConfirmations | 3 | VRF 节点等几个区块确认之后再生成随机数；Sepolia 上最少填 3，填少了会报错 |
| numWords | 1 | 一次要几个随机数；掷一颗骰子，1 个就够了，单次请求最多可以要 500 个 |

`callbackGasLimit` 值得多说一句。官方入门例子里写的是 40000，因为那个例子回调里只做一件事：存一个数字。我们的回调要做的事更多——更新胜场、总局数、发事件——40000 就有点紧了，所以这里给 100000。**这个值不是越大越好**：它必须小于协调器合约的上限，而且每次请求的费用是按实际用的 Gas 算的，设得再大，没用掉的部分不花钱。真正要避免的是设得太小：回调 Gas 不够会直接失败，而且失败了也不会重试，生成随机数的钱照扣，结果也没写进去。

### 要记的数据

```solidity
uint8 private constant ROLL_IN_PROGRESS = 7;

mapping(uint256 => address) private s_requestToPlayer;
mapping(uint256 => uint8) private s_requestToGuess;
mapping(address => uint8) private s_lastResult;
mapping(address => uint256) public wins;
mapping(address => uint256) public plays;

event DiceRequested(uint256 indexed requestId, address indexed player, uint8 guess);
event DiceLanded(uint256 indexed requestId, address indexed player, uint8 dice, bool won);

constructor(uint256 subscriptionId) VRFConsumerBaseV2Plus(vrfCoordinator) {
    s_subscriptionId = subscriptionId;
}
```

这里的四个映射，是整个游戏的“账本”：

- `s_requestToPlayer`：请求编号对应哪个玩家。回调回来的时候，只带一个请求编号，不带玩家地址，不记这个，你就不知道随机数是给谁的。
- `s_requestToGuess`：请求编号对应玩家猜的是几点。同样，回调的时候要靠它来算输赢。
- `s_lastResult`：每个玩家上一局的结果。0 表示还没玩过，1–6 是上一局的骰子点数，7 是个特殊标记，表示“正在等结果”。骰子只有 1 到 6 点，7 永远不可能是真实点数，正好拿来当“等待中”的信号——官方的掷骰子例子用的也是这个套路，只不过它用的是 42。
- `wins` 和 `plays`：每个玩家的胜场和总局数，公开的，谁都能查。

构造函数只做一件事：把部署时传进来的订阅编号存下来，同时把协调器地址传给父合约。

---

## 三、第一步：创建订阅、充钱、把合约加进去

合约写好之前，先把“钱”的事办了。VRF 不是免费的，每次请求都要付费，费用从**订阅**里扣。订阅是 Chainlink 给 VRF 设计的付费方式：你先开一个订阅账户、往里充钱，再把你的合约加进这个订阅的白名单，合约每次要随机数，费用就从订阅里扣。

顺序不能反：**先有订阅，再部署合约**。因为部署合约的时候，构造函数就要传订阅编号。

### 1. 领测试币

去 Chainlink 水龙头 https://faucets.chain.link/sepolia，连接 MetaMask，选 Sepolia 网络，一次能领 0.1 个 Sepolia ETH 和一些测试 LINK。Sepolia ETH 是付部署合约的 Gas 用的，LINK 是给 VRF 订阅充值的。

注意，Sepolia 的 Chain ID 是 11155111，MetaMask 里如果还没加 Sepolia，先把网络加上。LINK 在 MetaMask 里默认不显示，要手动添加 Token，Sepolia 上 LINK 的合约地址是 0x779877A7B0D9E8603169DdbD7836e478b4624789。

### 2. 创建订阅

打开 https://vrf.chain.link，连接钱包，选 Sepolia 网络，点创建订阅。创建本身不花钱，只是一次链上操作，要一点 Sepolia ETH 做 Gas。

创建好之后，你会拿到一个订阅编号——一串数字，比如 1234。**把这个编号记下来，部署合约的时候要填**。

### 3. 给订阅充值

在订阅页面点充值。你有两个选择：充 LINK，或者充 Sepolia ETH。v2.5 开始，订阅同时有两个余额，两种币都能付 VRF 的费用。测试网练手，充 LINK 就行，充几个 LINK 够玩几十局了。

这里有两个最容易出现的问题：

- **订阅里没钱就发请求，请求会一直挂着。** 协调器不会在请求的时候检查余额，请求发出去之后才发现钱不够，随机数就一直等不到。官方文档写得很明确：余额不足的请求最多挂 24 小时，之后就过期作废。所以顺序是：先充值，再玩。
- **充了钱，但忘了把合约加进订阅。** 订阅有个 Consumer 白名单，只有名单里的合约才能花订阅的钱。部署完合约之后，回到订阅页面，把合约地址加进 Consumer 名单，再点一次确认。漏了这一步，`play()` 一调就 revert，报错信息还不太直白，新手经常在这里卡半天。

---

## 四、第二步：写 play()——向 VRF 要一个随机数

订阅的事办完了，回到合约。玩家玩一局，调的就是 `play()`：

```solidity
function play(uint8 guess) external returns (uint256 requestId) {
    require(guess >= 1 && guess <= 6, "Guess must be 1-6");
    require(s_lastResult[msg.sender] != ROLL_IN_PROGRESS, "Wait for last roll");
    requestId = s_vrfCoordinator.requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest({
            keyHash: s_keyHash,
            subId: s_subscriptionId,
            requestConfirmations: requestConfirmations,
            callbackGasLimit: callbackGasLimit,
            numWords: numWords,
            extraArgs: VRFV2PlusClient._argsToBytes(
                VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
            )
        })
    );
    s_requestToPlayer[requestId] = msg.sender;
    s_requestToGuess[requestId] = guess;
    s_lastResult[msg.sender] = ROLL_IN_PROGRESS;
    emit DiceRequested(requestId, msg.sender, guess);
}
```

这个函数做的事，按顺序拆开看：

**第一，先检查两个条件。** 猜的数字必须在 1 到 6 之间；玩家上一局的结果不能是“等待中”。第二个检查就是第一节说的规则：**一局没结算，不能开下一局**。没有这个检查，玩家可以一口气发十个请求，回调回来的时候，战绩就全乱了。

**第二，向协调器发请求。** `requestRandomWords` 的参数是一个结构体，里面的六个字段就是第二节那张表里的配置。注意 `extraArgs` 这一行：`nativePayment: false` 表示这次请求用 LINK 付费。如果你给订阅充的是 Sepolia ETH，想用 ETH 付，就把这里改成 `true`——但别忘了，订阅里要有对应币种的余额，充 LINK、改 `true`，一样会失败。

**第三，记账。** 请求发出去之后，协调器立刻返回一个 `requestId`，也就是这次请求的编号。马上把三件事记下来：这个编号是谁玩的、他猜的是几点、他的状态改成“等待中”。这三行必须写在请求之后、函数结束之前，因为回调随时可能回来——虽然实际上要等几个区块，但逻辑上，记账这件事不能拖。

**第四，发事件。** `DiceRequested` 事件是给链下看的：前端页面、区块浏览器，都靠事件知道“有人玩了一局，正在等结果”。没有事件，前端就只能一遍遍去查合约的状态，又慢又费事。

整个 `play()`，玩家只花一次 Gas。剩下的事——生成随机数、回调、算输赢——都是 VRF 那边和回调的 Gas 在出，费用从订阅里扣。

---

## 五、第三步：写 fulfillRandomWords——随机数回来了，算输赢

随机数回来的时候，协调器会调用你合约里的 `fulfillRandomWords`。这个函数是父合约 `VRFConsumerBaseV2Plus` 里定义好的，你只需要重写它：

```solidity
function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
    address player = s_requestToPlayer[requestId];
    uint8 dice = uint8((randomWords[0] % 6) + 1);
    s_lastResult[player] = dice;
    plays[player] += 1;
    bool won = (dice == s_requestToGuess[requestId]);
    if (won) {
        wins[player] += 1;
    }
    emit DiceLanded(requestId, player, dice, won);
}
```

逐行看：

**第一行，先找回玩家。** 回调只带了 `requestId` 和随机数数组，玩家是谁、猜的是什么，全靠第二节记的那两个映射查回来。这就是为什么 `s_requestToPlayer` 和 `s_requestToGuess` 不能少——回调的时候，合约自己是“失忆”的，全靠请求时记的账。

**第二行，算骰子点数。** `randomWords[0]` 是 VRF 给的 256 位随机数，对 6 取模得到 0 到 5，再加 1，就是 1 到 6 的点数。这个写法和官方文档的例子一模一样：`(randomWords[0] % 20) + 1` 是 20 面骰，`(randomWords[0] % 6) + 1` 是 6 面骰。

新手经常会问：取模会不会让概率变歪？43 篇已经讲过：256 位随机数取模的偏差小到可以忽略，真正要小心的是**点数换算别写错**。比如写成 `% 6` 忘了 `+ 1`，点数就变成 0 到 5，0 点是不存在的，猜 6 的玩家永远赢不了——随机数是干净的，规则是你自己写歪的。

**第三到第五行，更新战绩。** 先把玩家的状态从“等待中”改成这次的点数，再把总局数加 1。如果点数等于他猜的数字，胜场加 1。

**最后一行，发事件。** `DiceLanded` 把请求编号、玩家、点数、输赢一次发出来，前端靠这个事件把结果显示给玩家。

还有一个配套的查询函数，让玩家随时查自己上一局的结果：

```solidity
function lastResult(address player) external view returns (uint8) {
    return s_lastResult[player];
}
```

返回 0 是还没玩过，返回 7 是正在等结果，返回 1 到 6 就是上一局的点数。

到这里，合约的三个部分拼起来就是完整版：第二节的骨架 + 第四节的 `play()` + 第五节的 `fulfillRandomWords()` 和 `lastResult()`。Remix 里新建一个 `DiceGame.sol`，把三部分按顺序贴进去，就能编译了。

---

## 六、在 Remix + Sepolia 上完整跑一遍

合约写好了，接下来在 Remix 里部署到 Sepolia，完整玩一局。

### 部署前的检查清单

| 步骤 | 做什么 | 容易漏的地方 |
| --- | --- | --- |
| 1 | 水龙头领 Sepolia ETH 和 LINK | LINK 要在 MetaMask 里手动添加 Token 才看得见 |
| 2 | vrf.chain.link 上创建订阅、充值 | 订阅编号记下来，部署时要填 |
| 3 | Remix 里新建 DiceGame.sol，编译器选 0.8.19 | import 的是 @chainlink/contracts，Remix 会自动从 GitHub 拉取 |
| 4 | 部署时填订阅编号 | 填错编号，请求会失败 |
| 5 | 回到订阅页面，把合约地址加进 Consumer | 漏了这一步，play() 直接 revert |

### 玩一局

部署成功之后，在 Remix 的部署面板里找到你的合约：

1. 调 `play`，参数填你猜的数字，比如 `3`，点确认，MetaMask 里付一次 Gas。
2. 等一等。Sepolia 上回调通常约 1 分钟到。你可以去 Sepolia Etherscan 上搜你的合约地址，看 `DiceRequested` 事件，确认请求已经发出去了。
3. 回调到了之后，调 `lastResult`，填你的地址，返回值就是骰子点数。如果是 3，你赢了；`wins` 里你的胜场会变成 1，`plays` 变成 1。
4. 再调一次 `play`，猜个别的数字，重复玩几局，看看胜场和总局数的变化。

如果等了两三分钟，`lastResult` 还是 7（等待中），先别急着重玩，按第七节的清单逐项排查——最常见的原因就三个：订阅没钱、合约没加进 Consumer、回调 Gas 不够。

### 大概要花多少钱

测试网上，部署合约花的是 Sepolia ETH，水龙头领的 0.1 个够部署好几次。VRF 请求本身花的是订阅里的 LINK，主网上的参考价是**一次请求约 0.1 到 0.5 个 LINK**，再加上回调的 Gas。这个数字会随着 LINK 的价格和 Gas 价格波动，测试网上的 LINK 是免费领的，放心玩。但先算账这个习惯要养成：以后上了主网，每次请求都是真钱，游戏规则设计的时候，就得先把“玩一局要花多少钱”算进去。

---

## 七、新手最容易踩的坑

把上面六节跑通，游戏就能玩了。但下面这几个坑，是照着教程一步步做也很容易踩到的，提前排一遍：

**坑一：照着老教程用 VRF v1 / v2。**

网上搜到的很多 VRF 教程是 2024 年甚至更早写的，用的还是 `VRFConsumerBaseV2`。v1 在 2026 年 11 月 18 日已经停用，v2 在 11 月 30 日停用，照着老教程部署，合约根本收不到随机数。认准 `VRFConsumerBaseV2Plus` 和 `VRFV2PlusClient`，这是 v2.5 的写法，也是现在唯一能用的版本。

**坑二：订阅没钱，或者合约没加进 Consumer。**

这是两个不同的错，但症状很像，都是 `play()` 调不通。排查顺序：先去 vrf.chain.link 看订阅余额够不够，再看 Consumer 名单里有没有你的合约地址。记住顺序：**充值 → 部署 → 加 Consumer → 再玩**。

**坑三：回调 Gas 设得太小。**

`callbackGasLimit` 设得不够，回调执行到一半 Gas 用完，整个回调失败。失败了不会重试，生成随机数的费用照扣，战绩也没更新，等于白花钱。我们的回调要更新好几个存储变量、发事件，100000 是比较稳妥的值。以后回调逻辑变复杂了，这个值也要跟着往上调。

**坑四：结果不满意就重新请求。**

玩了一局，点数不是自己猜的，就想再发一次请求、重新掷一次——这是作弊，官方文档直接把这种做法列为错误用法。VRF 的随机数一旦生成，证明就定死了，重新请求就是换一个结果。游戏规则必须写死：**一个请求对应一局，结果出来了就认**。

**坑五：以为随机数是马上回来的。**

`play()` 调完，点数不会立刻出现在 `lastResult` 里。中间要等 VRF 节点等几个区块确认、生成证明、再回调回来，Sepolia 上通常约 1 分钟。前端一定要有个“等待中”的状态，直接拿 7 这个标记来显示就行。没有等待状态的游戏，玩家会以为合约卡住了，连点好几次 `play()`，结果全是“等待中”的报错。

**坑六：在请求发出之后，还让玩家改规则。**

比如允许玩家在随机数回来之前改自己猜的数字——他可以先看链上的数据，等随机数快出来了再改成必赢的数字。官方文档的要求是：**提交随机数请求之后，就不应该再接受任何用户提供的输入**。我们的合约里，`play()` 一调，猜的数字就锁死在 `s_requestToGuess` 里了，谁也改不了，这就是正确的做法。

---

## 八、这个游戏还能怎么变着花样玩

猜骰子跑通了，骨架就有了。换规则，基本不用动 VRF 的部分，改的都是游戏逻辑：

| 变法 | 怎么改 | 难度 |
| --- | --- | --- |
| 掷 20 面骰 | 点数改成 `(randomWords[0] % 20) + 1`，20 点大奖、1 点大失败 | 改一行 |
| 猜大小 | 1–3 算小、4–6 算大，猜中的概率变成一半，适合想赢得频繁一点的玩法 | 改几行 |
| 一次掷三颗骰子 | `numWords` 改成 3，回调里拿 `randomWords[0]`、`[1]`、`[2]` 各算一颗，比点数总和 | 改几行 |
| 加奖池 | 玩一次交一点 Sepolia ETH，猜中了分走奖池的一部分 | 要加收钱、发奖的逻辑，先想好防刷规则 |
| 连胜纪录 | 再记一个连胜数，猜中加 1、猜错清零，连续猜中 3 次有额外奖励 | 加一个映射 |
| 战绩 NFT | 每赢一局，给玩家 Mint 一个带点数的纪念 NFT | 要接 ERC721，工作量大一些 |

这几个变法里，前面三个可以直接在测试网上试。后面三个要多想一步：**奖池一加上真钱，安全要求就完全不一样了**。奖金怎么分、会不会有人刷胜场、合约被攻击了怎么办——这些问题在测试网上可以慢慢试，但上主网之前，一定要经过专业审计。游戏好玩是其次，钱不出问题才是底线。

还有一个方向，是把这个游戏和前面的文章串起来：39 篇的 NFT 是按 BTC 价格变表情的，如果把 VRF 的随机数也接进去，NFT 的表情就可以既看价格、又看运气——价格涨了笑、随机数掷出 6 点再戴一顶皇冠。等 52 篇的 dApp 实战篇，会把这些零件拼成一个完整的东西。

---

## 总结

- 猜骰子游戏的规则很简单：玩家猜 1 到 6，合约向 VRF 要随机数，点数 = 随机数 % 6 + 1，猜中就赢。简单规则的好处是：合约好懂，VRF 的流程看得清楚。
- 合约继承 `VRFConsumerBaseV2Plus`，用 `VRFV2PlusClient` 打包请求。认准名字里的 Plus，这是 v2.5；v1 和 v2 在 2026 年 11 月已经停用，老教程不能再照着抄。
- Sepolia 的关键配置：协调器 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B，keyHash 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae，requestConfirmations 最少 3，callbackGasLimit 按回调逻辑留够，这篇用 100000。
- 顺序不能反：水龙头领币 → vrf.chain.link 创建订阅、充值 → Remix 部署（填订阅编号）→ 把合约加进订阅的 Consumer 名单 → 再调 play()。订阅没钱，请求会挂起 24 小时后过期。
- `play()` 只做四件事：检查猜的数字和等待状态、发请求、记账（请求编号对应谁、猜的什么）、发事件。请求发出之后，猜的数字就锁死了，谁也不能改。
- `fulfillRandomWords()` 是回调：按请求编号找回玩家和猜的数字，算出点数，更新胜场和总局数，发事件。回调失败不会重试，Gas 要留够。
- 新手最容易踩的坑：用老版本库、订阅没钱、合约没加 Consumer、回调 Gas 太小、结果不满意重新请求、以为随机数马上回来、请求发出后还让玩家改输入。
- 这个骨架能变出很多玩法：20 面骰、猜大小、一次掷三颗骰子、加奖池、连胜纪录、战绩 NFT。加真钱之前，先审计。

---

## 下一篇是第 45 篇：

[[y7blog-web3-46]]

游戏做完了，随机数这条线也走完了。下一篇进入第八阶段：CRE 是什么？Chainlink Functions 主网已经关闭，接替它的是 Chainlink Runtime Environment——智能合约不能直接访问互联网，那它怎么知道今天的天气、最新的新闻？CRE 就是干这个的，让智能合约通过 Chainlink 网络去调外部 API，把现实世界的数据带回链上。

---

*参考资料：Chainlink VRF v2.5 官方入门教程（VRFD20 掷骰子例子、Sepolia 配置与回调写法，2026-11-24 核对，https://docs.chain.link/vrf/v2-5/getting-started）；Chainlink VRF v2.5 概述（订阅与直接资助两种方式、v2.5 新增特性，https://docs.chain.link/vrf/v2-5/overview）；Chainlink VRF v1/v2 停用公告（v1 2026-11-18 停用、v2 2026-11-30 停用，迁移到 v2.5，https://docs.chain.link/vrf/llms-full.txt）；Chainlink 领取测试 LINK（Sepolia LINK 地址 0x779877A7B0D9E8603169DdbD7836e478b4624789、水龙头 faucets.chain.link，https://docs.chain.link/resources/acquire-link）；Chainlink VRF v2.5 支持网络与 Sepolia 配置（https://docs.chain.link/vrf/v2-5/supported-networks）；Chainlink VRF v2.5 计费说明（订阅余额、LINK 与原生币两种付费方式，https://docs.chain.link/vrf/v2-5/billing）；Chainlink VRF v2.5 最佳实践（请求编号映射、请求后不再接受输入、回调失败不重试，https://docs.chain.link/vrf/v2/best-practices）；CryptoHawking《Verifiable Randomness in Blockchain: Chainlink VRF and Commit-Reveal Schemes》（2026 年，主网单次请求费用约 0.1–0.5 LINK，https://www.cryptohawking.com/blog/verifiable-randomness-chainlink-vrf-commit-reveal）；Chainlink VRF v2.5 订阅说明（余额不足的请求最多挂起 24 小时后过期，https://docs.chain.link/vrf/v2-5/overview/subscription）。*
