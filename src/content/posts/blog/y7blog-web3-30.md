---
title: 29｜NFT 是怎么工作的？Token、Metadata 和图片到底是什么关系？
published: 2026-11-05
pinned: false
draft: false
comment: true
description: 钱包里那张猿猴图片，到底存在哪？链上的 NFT 其实只有合约地址、编号和主人三条记录，图片藏在另外两层后面。这篇把 Token、Metadata 和图片三层一层一层拆开：tokenURI 是怎么找到那份 JSON 文件的，一份 Metadata 里写了什么，图片放在 IPFS、服务器和链上有什么区别，以及为什么有的 NFT 图片会突然打不开。
image: https://www.y7img.ccwu.cc/file/1794881370446_y7blog-web3-30-1600.png
tags: [NFT,ERC721,Metadata,tokenURI,IPFS]
category: Web3
slug: blog/y7blog-web3-30
series: "区块链百科"
seriesOrder: 1
---

打开钱包，你看到一张猿猴的图片：金色毛发、橙色背景、戴着一顶会转的帽子。

你点开它，能看到名字、特征、交易记录。你理所当然地以为：**这张图片，就存在区块链上。**

其实不是。链上那个 NFT 里没有图片，一个像素都没有。图片存在另外的地方，中间隔了整整两层。

这三层到底是怎么连起来的？今天就把这条链路一层一层拆开——**Token、Metadata 和图片，到底是什么关系。**

> 💡 **先说清楚**：本文是知识科普，只讲 NFT 的 Token、Metadata 和图片是怎么连起来的，不推荐你去买任何 NFT，更不构成投资建议。NFT 的价格波动很大，很多 NFT 最后接近归零，动手之前先在测试网把流程走熟，再用你输得起的金额尝试。

---

## 一、NFT 其实是三层，不是一张图

先给一张总图，后面每一节都是在拆这张图里的一层：

```
第一层：链上（区块链里）
  NFT 合约：0xBC4C...（某个 NFT 系列的合约）
  编号：#8817
  主人：0x1234...
  tokenURI → 指向一份 JSON 文件
         │
         ▼
第二层：Metadata（一份 JSON 文件）
  {
    "image": "ipfs://QmTtM1.../图片",
    "attributes": [
      {"trait_type": "Fur", "value": "Solid Gold"},
      ...
    ]
  }
         │
         ▼
第三层：图片文件（存在 IPFS 或服务器上）
  一张 PNG 图片
```

三层各干各的事：

| 层 | 是什么 | 存在哪 | 干什么 |
|---|---|---|---|
| 第一层：Token | 链上的一条所有权记录 | 区块链 | 证明“编号 #8817 这个 NFT 归谁” |
| 第二层：Metadata | 一份 JSON 描述文件 | 链下（IPFS、服务器或链上） | 写着这个 NFT 叫什么、长什么样、有什么特征 |
| 第三层：图片 | 一个图片文件 | 链下（IPFS、服务器或链上） | 你眼睛实际看到的那张图 |

**钱包和市场显示给你的那张图，是顺着这三层一路找过去、再拼起来给你看的。** 任何一层断了，图就显示不出来了——但链上那个 NFT 还在，归你，还是你的。

这就是理解 NFT 工作方式最关键的一句话：**NFT 不是图片，NFT 是一条“指向图片的链路”。**

---

## 二、第一层：链上只记三件事

第 28 篇讲过，ERC721 合约里最核心的是一张“按编号记归属”的表：

```
mapping(uint256 => address) owners
```

翻译过来就是：**编号 #8817 这个 NFT，现在归谁。**

除此之外，链上还记了两件事：

1. **这个 NFT 属于哪个合约**——合约地址就是这个系列的“身份证”，比如无聊猿的合约地址是 `0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D`；
2. **去哪找它的 Metadata**——也就是下面要讲的 `tokenURI`。

就这三件事：**哪个合约、哪个编号、归谁，外加一个指向 Metadata 的链接。** 没有名字、没有描述、没有图片、没有特征。

为什么链上只记这么少？因为在链上存东西要花 Gas，存一张图片贵得离谱。EIP-721 的作者在写标准的时候就想得很清楚：**把最少、最关键的东西放链上，把重的、大的东西放链下，用链接连起来。**

所以你在 Etherscan 上查一个 NFT，能看到的就是这三件事：合约地址、编号、主人地址，外加一串交易记录。你看不到图片——图片根本不在那。

---

## 三、第二层：tokenURI 是通往 Metadata 的地址

链上那个 NFT 是怎么指向 Metadata 的？靠一个函数：

```
function tokenURI(uint256 tokenId) external view returns (string);
```

这是 ERC721 元数据扩展里规定的函数。调用它，传一个编号进去，它返回一个字符串——**这个字符串就是 Metadata 文件的地址。**

### 合约是怎么拼出这个地址的？

实际写合约的时候，有两种常见做法。

**做法一：基础地址 + 编号。**

合约里只存一个基础地址（baseURI），调用 `tokenURI` 的时候，把编号拼在后面：

```
tokenURI(8817) = baseURI + "8817"
```

OpenZeppelin 的 ERC721 就是这么实现的：`_baseURI()` 返回基础地址，`tokenURI` 把基础地址和编号拼起来。比如基础地址是 `ipfs://QmeSjS.../ `，那 `tokenURI(8817)` 返回的就是 `ipfs://QmeSjS.../8817`，也就是 8817 号那份 JSON 文件的地址。整个系列 1 万个 NFT，共用一个基础地址，每人一份 JSON 文件，整整齐齐排在同一个文件夹里。

**做法二：每个 Token 单独存一个地址。**

OpenZeppelin 还提供了一个叫 `ERC721URIStorage` 的扩展：合约里有一张表，给每个编号单独存一个地址。Mint 的时候，项目方一个一个把地址写进去。这种做法更灵活——每个 NFT 的地址可以完全不一样，但也更贵，因为每个地址都要单独上链存一次。

两种做法的差别，可以这样记：

|  | baseURI 拼接 | ERC721URIStorage 单独存 |
|---|---|---|
| 地址存在哪 | 合约里只存一个基础地址 | 每个编号单独存一个完整地址 |
| 适合 | 编号连续、文件整齐排列的系列 | 每个 NFT 地址都不一样的项目 |
| 成本 | 便宜 | 贵，每个地址都要上链 |
| 改起来 | 改一个基础地址，全系列都变了 | 一个一个改，只动指定的那几个 |

不管用哪种做法，结果都一样：**`tokenURI` 返回一个地址，顺着这个地址，就能找到第二层那份 JSON 文件。**

### 这个地址可以指向哪？

`tokenURI` 返回的字符串，开头决定了 Metadata 存在哪：

| 开头 | 意思是 |
|---|---|
| `https://` | 一份放在普通服务器上的 JSON 文件 |
| `ipfs://` | 一份放在 IPFS 上的 JSON 文件 |
| `ar://` | 一份放在 Arweave 上的 JSON 文件 |
| `data:application/json;base64,...` | JSON 直接写在链上，用 Base64 编码嵌在返回值里 |
| `web3://` | 通过链上调用直接返回 JSON（ERC-4804，OpenSea 已支持） |

这五种里，前三种最常见，第四种是“全链上 NFT”的做法，第五种是比较新的标准。第六节会一个一个比较它们的取舍。

---

## 四、拿一只真猿猴走一遍：BAYC #8817 的完整链路

光讲原理容易晕，我们拿一个真实存在的 NFT，把三层完整走一遍。

主角是无聊猿（Bored Ape Yacht Club）的 #8817。它的合约地址是 `0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D`，任何人都可以在 Etherscan 上查到。

### 第一步：问合约要地址

在 Etherscan 上打开这个合约，点“Read Contract”，找到 `tokenURI`，输入 `8817`，点查询。返回的结果是：

```
ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/8817
```

这就是无聊猿的做法：合约里存了一个基础地址 `ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/`，`tokenURI` 把编号 `8817` 拼在后面。

### 第二步：顺着地址找到 JSON 文件

把上面这个地址通过 IPFS 网关打开，拿到的是一份只有 398 字节的 JSON 文件，全文如下：

```
{
  "image": "ipfs://QmTtM1G6GNodp6u4sENHkeirgR3aCq3nqcy43jb5FQW7B4",
  "attributes": [
    {"trait_type": "Hat", "value": "Spinner Hat"},
    {"trait_type": "Background", "value": "Orange"},
    {"trait_type": "Eyes", "value": "Sleepy"},
    {"trait_type": "Clothes", "value": "Wool Turtleneck"},
    {"trait_type": "Mouth", "value": "Bored Party Horn"},
    {"trait_type": "Earring", "value": "Silver Hoop"},
    {"trait_type": "Fur", "value": "Solid Gold"}
  ]
}
```

注意两个细节：

**第一，这份 JSON 里没有 `name`，也没有 `description`。** 很多人以为每份 Metadata 都有名字和简介，其实不是——这两个字段在标准里是可选的，无聊猿就没写。你在 OpenSea 上看到的“Bored Ape #8817”这个名字，是市场拿系列名加上编号，自己拼出来的。

**第二，`image` 字段指向的是另一个 IPFS 地址。** 图片文件有自己的内容哈希（`QmTtM1...`），和 Metadata 文件的哈希（`QmeSjS...`）不一样。Metadata 和图片是两个独立的文件，各有各的地址。

### 第三步：顺着 image 字段找到图片

打开 `ipfs://QmTtM1G6GNodp6u4sENHkeirgR3aCq3nqcy43jb5FQW7B4`，拿到的就是那张图：一只金色毛发、橙色背景、戴着旋转帽子的猿猴。

整条链路走完，就是这样：

```
Etherscan 查 tokenURI(8817)
   │
   ▼  ipfs://QmeSjS.../8817
JSON 文件（398 字节）
   │  image 字段
   ▼  ipfs://QmTtM1...
图片文件（一张 PNG）
```

**钱包和 OpenSea 显示给你看的那只猿猴，就是顺着这条链，一步一步找过去、再拼出来的。** 链上那个 NFT 本身，从头到尾只参与了第一步。

---

## 五、第三层：一份 Metadata JSON 里到底写了什么

BAYC 的 JSON 只有两个字段，是最简版。完整版的 Metadata 一般长这样：

```
{
  "name": "Solar Cat #142",
  "description": "A unique NFT from the Solar Cat collection.",
  "image": "ipfs://bafy.../142.png",
  "animation_url": "ipfs://bafy.../142.mp4",
  "external_url": "https://example.com/cats/142",
  "background_color": "FFFFFF",
  "attributes": [
    {"trait_type": "Background", "value": "Blue"},
    {"trait_type": "Eyes", "value": "Laser"},
    {"trait_type": "Accessory", "value": "Gold Chain"}
  ]
}
```

这些字段是 OpenSea 的 Metadata 标准里规定的（官方文档 2026 年 11 月 12 日更新），一张表讲清楚：

| 字段 | 写什么 | 是不是必须的 |
|---|---|---|
| `name` | 这个 NFT 显示的名字 | 不是，但几乎人人都会写 |
| `description` | 一段介绍这个 NFT 的文字，支持 Markdown | 不是 |
| `image` | 图片文件的地址 | 不是，但没有它市场就没图可显示 |
| `animation_url` | 视频、音频、3D 模型或交互网页的地址 | 不是，有动态内容的才写 |
| `external_url` | 指向项目官网的链接 | 不是 |
| `background_color` | 显示时的背景色，6 位十六进制，不带 `#` | 不是 |
| `attributes` | 特征列表，每个特征是一对 `trait_type`（特征名）和 `value`（特征值） | 不是，但决定了稀有度排序 |

### attributes 是干什么的？

`attributes` 是这份 JSON 里最有用的部分，也是新手最容易忽略的部分。

它是一张“特征清单”：这只猿猴是什么毛色、什么背景、戴什么帽子、穿什么衣服，一条一条列出来。市场拿到这份清单，就能做两件事：

1. **按特征筛选**：你想找“金色毛发”的猿猴，勾一下筛选条件就行；
2. **算稀有度**：全系列 1 万只里，只有 50 只是金色毛发，那金色毛发就稀有，价格往往也更高。

稀有度就是这么算出来的：**特征越少人拥有，越稀有。** 但记住第 28 篇讲过的坑：稀缺不等于值钱，没人想要的特征，再稀有也没用。

### 还有一个容易搞错的点

EIP-721 原始标准里的 Metadata JSON Schema，只规定了 `name`、`description`、`image` 三个字段。`attributes`、`animation_url` 这些，都是后来市场（主要是 OpenSea）约定俗成的扩展，不是 EIP-721 原文里的内容。

所以严格来说，**Metadata 的“标准”分两层**：EIP-721 定了最基本的三个字段和 `tokenURI` 这个函数；市场上实际用的完整字段表，是 OpenSea 的文档在维护。写合约的时候按 OpenSea 的字段写，钱包和市场才能正确显示。

---

## 六、图片到底存在哪？四种地方的取舍

`image` 字段指向的图片文件，存在哪，直接决定了你的 NFT 图片“结不结实”。常见的有四种：

| 存在哪 | 怎么认 | 优点 | 最容易出现的问题 |
|---|---|---|---|
| 项目方自己的服务器（`https://`） | 地址是普通网址 | 便宜、改起来方便 | 服务器一关、域名一过期，图片立刻打不开；项目方随时能换一张图 |
| IPFS（`ipfs://`） | 地址是一串内容哈希（CID） | 内容改一个字节，哈希就变了，没人能偷偷换图 | 只保证“没人能改”，不保证“一直能打开”——没人 Pin，文件会慢慢消失 |
| Arweave（`ar://`） | 地址是一串交易 ID | 一次付费、设计上就是长期保存 | 依赖 Arweave 网络本身能长期运转 |
| 链上（`data:` 开头） | JSON 里直接嵌着 Base64 编码的图片 | 和合约一样结实，合约在图就在 | 太贵，只适合很小的图片，比如 SVG |

### IPFS 那个最容易误解的点，要单独讲清楚

很多人以为“存在 IPFS 上”就等于“永远都在”。不是。

IPFS 的地址是一串内容哈希（CID），哈希是由文件内容算出来的。文件改一个字节，哈希就变了，所以**没人能偷偷把文件换掉**——这叫内容寻址，是 IPFS 最大的优点。

但 IPFS 只管“找得到、验得过”，不管“一直存着”。文件存在某个节点的硬盘上，节点默认会把不常访问、没人 Pin 的内容慢慢清理掉（垃圾回收）。Pin 的意思就是“某个节点答应一直帮你存着”。**如果没有人 Pin，文件最后会消失，CID 还在，但指向的东西已经不在了。**

这个不是理论上的风险。Hedera 的一次扫描检查了 40 多万个 NFT，发现**将近 20% 的 Metadata 和图片已经找不到了**。另一项针对 12,353 个以太坊 NFT 合约的研究也发现，大多数 NFT 的图片都存在链下，Token 和图片之间只靠多层链接连着，研究者把这种连接叫作“弱绑定”——链路越长，断掉的机会就越多。

所以判断一个 NFT 的图片结不结实，不能只看“是不是 IPFS”，要看三件事：

1. **Metadata 是不是 IPFS 或 Arweave 地址**——是的话，至少没人能偷偷换文件；
2. **有没有人在 Pin**——项目方有没有用 Pinata 这类固定服务，或者自己跑节点；
3. **图片本身是不是也在 IPFS 或 Arweave 上**——有的项目 Metadata 放 IPFS，图片却还放在自己服务器上，等于只加固了一半。

### 那“全链上 NFT”是怎么回事？

第 40 篇会细讲，这里先提一句：有些 NFT 把 JSON 和图片（通常是 SVG 代码）直接写进合约，`tokenURI` 返回一串 `data:application/json;base64,...` 开头的编码。合约在，图就在，没有任何外部依赖。代价是贵——链上存东西按字节收 Gas，图片越大越贵，所以只适合很小、很简单的图。

---

## 七、钱包和市场是怎么把三层拼成一张图的？

现在把视角换到钱包和市场那边。它们拿到一个 NFT，是这样一步一步显示出来的：

```
1. 读链上：调 ownerOf(8817)，确认这个 NFT 归谁
   │
2. 问地址：调 tokenURI(8817)，拿到 Metadata 的地址
   │
3. 取 JSON：顺着地址下载 Metadata 文件
   │
4. 取图片：读 JSON 里的 image 字段，下载图片文件
   │
5. 显示：名字 + 图片 + 特征列表，一起画在屏幕上
```

### 缓存：为什么改了 Metadata，显示还是旧的？

钱包和市场不会每次都重新走一遍这五步——那样太慢了。它们会把取到的 JSON 和图片**缓存**起来，下次直接用缓存显示。

所以如果你是项目方，改了 Metadata 之后发现 OpenSea 上还是旧图，别慌，多半是缓存还没更新。OpenSea 有“刷新 Metadata”的按钮，点了之后会重新走一遍这五步。

为了让市场知道“Metadata 变了，该重新取了”，还有一个专门的标准：**EIP-4906**。它规定了两个事件，`MetadataUpdate` 和 `BatchMetadataUpdate`：合约改了 Metadata 之后，发出这个事件，市场收到就知道该刷新了。OpenZeppelin 的 `ERC721URIStorage` 在改地址的时候，就会自动发出这个事件。

### Metadata 能改吗？

能——除非项目方主动放弃这个能力。

EIP-721 标准写得很直白：**`tokenURI` 返回的地址是可以变的，标准从来没有要求 Metadata 必须不可变。** 只要合约里留了改地址的函数（比如改 `baseURI` 的函数），项目方就能把整个系列的 Metadata 指向另一批文件。

这就分两种情况：

- **Metadata 可变**：项目方留着改地址的权力。好处是出了错能修、能升级；坏处是你今天买的金色猿猴，明天可能变成另一张图。
- **Metadata 冻结**：项目方把改地址的函数去掉，或者放弃合约的管理权限（`renounceOwnership`），地址就再也改不了了。

这里拿无聊猿当个反直觉的例子：它的合约里确实没有给单个 Token 改地址的函数，但留了一个 `setBaseURI`——只有 owner 能调，理论上可以把整个系列的 baseURI 一次换掉。所以严格说，无聊猿的 Metadata 不算“冻结”，只是自 2021 年 reveal 以来一直没换过。想确认一个项目是不是真冻结，不能只听项目方说，要去 Etherscan 上看两点：合约里有没有 `setBaseURI` 这类改地址的函数，以及 owner 是不是已经放弃了权限。

买 NFT 之前，值得花一分钟看一眼：**这个项目的 Metadata 是不是冻结的。** 没冻结不一定是坏事——第 30 篇要讲的动态 NFT，靠的就是 Metadata 能变——但你得知道自己买的是哪一种。

---

## 八、新手最容易踩的五个坑

### 坑 1：以为图片在链上，其实它在别的地方

这是整篇最核心的误会。**链上只有记录和链接，图片在链下。** 买之前点开 `tokenURI` 看一眼：Metadata 是 `https://` 还是 `ipfs://`？图片又存在哪？存在项目方自己服务器上的，风险最高。

**怎么避开：** 在 Etherscan 上查合约，调 `tokenURI` 看一眼返回的地址开头。`ipfs://` 或 `ar://` 开头的，比 `https://` 开头的结实。

### 坑 2：看到 IPFS 就以为高枕无忧

IPFS 保证的是“没人能偷偷换文件”，不是“文件永远都在”。没人 Pin 的文件会慢慢消失。前面提过，扫描发现将近 20% 的 NFT 图片已经找不到了，很多就是这个原因。

**怎么避开：** 看项目方有没有说明用了 Pinata、nft.storage 这类固定服务，或者自己跑节点。什么都没说的，就当它没加固。

### 坑 3：Metadata 被改了，自己还不知道

Metadata 可变的项目，项目方可以换图、换特征、换名字。你买的时候是金色毛发，过段时间可能就不是了。

**怎么避开：** 买之前确认 Metadata 是不是冻结的。合约里有没有改 `baseURI` 的函数，Etherscan 上“Read Contract”里能直接看到。

### 坑 4：只看图片好看，不看 attributes

图片可以右键保存，attributes 才是市场定价的依据。同一系列里，特征组合决定了稀有度排序，也决定了挂单价格。只看图好看就下单，等于没看价签就买东西。

**怎么避开：** 下单之前，先看 attributes 里每条特征在全系列里的占比。OpenSea 的特征栏里，每条特征后面都写着占比。

### 坑 5：以为“图片打不开”就是 NFT 丢了

图片打不开、Metadata 读不出来，很多人第一反应是“我的 NFT 没了”。其实没有：**链上那条“编号 #8817 归你”的记录还在，一点没变。** 丢的只是“显示用的那份文件”，不是 NFT 本身。只要 Metadata 或图片重新有人 Pin、重新上线，图就又能显示出来。

**怎么避开：** 先分清是哪一层断了：Etherscan 上查 `ownerOf`，还在你名下，NFT 就还在；再顺着 `tokenURI` 一层一层找，看到底是 JSON 断了还是图片断了。

> ⚠️ **风险提示**：NFT 涉及真实资产的支出，价格波动极大，流动性也比 ERC20 差得多——想卖的时候不一定有人接。实际操作前请自行核实官方文档，先在测试网（比如 Sepolia）上完整走一遍流程，再考虑主网，而且永远只用你输得起的金额。

---

## 总结

1. **NFT 是三层，不是一张图：** 链上的 Token 记录、链下的 Metadata JSON 文件、再链下的图片文件，三层用链接一层一层连起来。
2. **链上只记三件事：** 哪个合约、哪个编号、归谁，外加一个指向 Metadata 的地址。没有图片，没有名字。
3. **`tokenURI` 是第二层的入口：** 调 `tokenURI(编号)`，拿到 Metadata 文件的地址。合约一般用 baseURI + 编号拼接，或者用 ERC721URIStorage 给每个编号单独存地址。
4. **Metadata JSON 写的是“这个 NFT 是什么”：** `name`、`description`、`image`、`attributes` 这些字段，`attributes` 决定了特征和稀有度。BAYC #8817 的实测 JSON 只有 `image` 和 `attributes` 两个字段，连 `name` 都没有。
5. **图片存在哪，决定了它结不结实：** 服务器最方便也最脆弱，IPFS 防篡改但不包“一直能打开”（没人 Pin 会消失），Arweave 一次付费长期保存，全链上最结实也最贵。
6. **钱包和市场是顺着链路拼图的：** 读链上 → 问 `tokenURI` → 取 JSON → 取图片 → 显示。改了 Metadata 要靠 EIP-4906 事件通知市场刷新，缓存没更新之前看到的还是旧图。
7. **Metadata 默认是可以改的：** EIP-721 从没要求它不可变。冻结不冻结，要看合约里有没有留改地址的函数。
8. **五个坑要记住：** 图片不在链上、IPFS 不包永久保存、Metadata 可能被改、attributes 才是定价依据、图片打不开不等于 NFT 丢了。

到这里，你已经能自己动手验证任何一个 NFT 的完整链路了：**Etherscan 上调 `tokenURI`，顺着地址打开 JSON，再顺着 `image` 打开图片。** 走一遍，你就知道手里那个 NFT 到底结不结实。

---

## 下一篇是第 30 篇：

[[y7blog-web3-31]]

这篇讲了 Metadata 默认是可以改的，但还没讲“改”能用来干什么。如果 NFT 的图片和特征能跟着时间、价格、链上状态自动变化，它就不再是一张静态的图，而是一个会“活”过来的东西。下一篇就讲动态 NFT 是怎么回事，以及它和普通 NFT 的根本区别。到时候见。

---

*参考资料：EIP-721「ERC-721: Non-Fungible Token Standard」（https://eips.ethereum.org/EIPS/eip-721，2018-01-24 提出，2018 年 1 月定稿）关于元数据扩展 tokenURI、Metadata JSON Schema（name / description / image）与 URI 可变性的说明；OpenSea 官方文档「Metadata storage」（https://docs.opensea.io/docs/metadata-storage，2026-11-12 更新）关于 tokenURI 存储方式（Hosted JSON / IPFS / Arweave / Data URI / ERC-4804 / ERC-8493）与元数据字段的说明；OpenSea 官方文档「Media and traits」（https://docs.opensea.io/docs/media-and-traits）关于 NFT 元数据字段 name / description / image / animation_url / attributes / background_color / external_url 的说明；OpenZeppelin 官方文档「ERC721」（https://docs.openzeppelin.com/contracts/5.x/api/token/erc721）关于 ERC721 的 _baseURI 拼接机制、ERC721URIStorage 单独存址与 _setTokenURI 发出 ERC-4906 MetadataUpdate 事件的说明；EIP-4906「ERC-4906: Metadata Update Extension」（https://eips.ethereum.org/EIPS/eip-4906）关于 MetadataUpdate 与 BatchMetadataUpdate 事件的说明；Bored Ape Yacht Club 合约（0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D）baseURI 为 ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/ 的说明（OpenZeppelin 论坛，https://forum.openzeppelin.com/t/how-has-the-metadata-been-added-to-the-tokenid-in-this-nft-contract/15554）；BAYC #8817 Metadata JSON 实测（2026-11-17 通过 IPFS 网关读取，398 B，仅含 image 与 attributes 两个字段，image 为 ipfs://QmTtM1G6GNodp6u4sENHkeirgR3aCq3nqcy43jb5FQW7B4，7 条 attributes：Hat Spinner Hat、Background Orange、Eyes Sleepy、Clothes Wool Turtleneck、Mouth Bored Party Horn、Earring Silver Hoop、Fur Solid Gold）；BAYC 合约 ABI 核查（Etherscan，2026-11-17）：合约含 setBaseURI(string) 函数、无单 Token 改址函数，Metadata 未冻结；NFT Metadata 与存储风险（https://crypto-artwork.com/what-your-nft-actually-points-to-and-why-it-can-break/）关于 12,353 个以太坊 NFT 合约研究与“弱绑定”的说明；Hedera「NFT storage: How NFT artwork can literally disappear」（https://hedera.com/blog/nft-storage-why-it-matters/）关于扫描 40 多万个 NFT、近 20% 的 Metadata 与图片无法找到及 IPFS Pin 必要性的说明；IPFS 与 Arweave 存储取舍（https://www.onchainart.wiki/articles/ethereum/metadata-storage/，2026-02-10 更新）关于内容寻址、Pin、Arweave 与链上存储的说明。*
