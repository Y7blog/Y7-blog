---
title: 31｜如何用 Solidity 创建一个 NFT 智能合约？
published: 2026-11-07
pinned: false
draft: false
comment: true
description: 想把一张自己画的图变成一枚真正的 NFT，不是点几下按钮，而是亲手写一个智能合约。这篇从零开始：继承哪个合约、名字和符号怎么定、Mint 函数怎么写、Metadata 怎么接上去，一行一行讲清楚，照着做就能在 Remix 里跑起来。
image: https://www.y7img.ccwu.cc/file/1794967896757_y7blog-web3-32-1600.png
tags: [NFT,Solidity,ERC721,OpenZeppelin,Remix]
category: Web3
slug: blog/y7blog-web3-32
series: "区块链百科"
seriesOrder: 1
---

想象一下：你有一张自己画的图，想把它变成一枚真正的 NFT——不是在某个平台上点几下按钮生成，而是**亲手写一个智能合约**，把这张图变成链上独一无二的 Token。

听起来是不是很难？其实写一个最简单的 NFT 合约，核心代码不到 30 行。今天这篇就带你从零写出来：继承哪个合约、名字和符号怎么定、Mint 函数怎么写、Metadata 怎么接上去，一行一行讲清楚。你不需要先成为 Solidity 高手，跟着做一遍就能跑起来。

> 💡 **先说清楚**：本文是知识科普，只讲怎么写一个 NFT 智能合约，不推荐你去买任何 NFT，更不构成投资建议。写合约、部署合约都要先在测试网练手，确认流程没问题再考虑别的。主网上的每一次部署和 Mint 都是真金白银，别拿着没测试过的合约直接上主网。

---

## 一、写 NFT 合约之前，先想清楚三件事

很多新手一上来就打开编辑器写代码，写到一半才发现不知道自己到底要什么。写之前先把这三个问题想清楚，后面会顺很多：

### 1. 这个 NFT 系列叫什么名字？符号是什么？

每个 NFT 合约都有两个基本信息：**名字（name）和符号（symbol）**。比如无聊猿的名字是 "Bored Ape Yacht Club"，符号是 "BAYC"。名字可以随便起，符号一般是 3-5 个大写字母，相当于这个系列的简称。

这两个东西一旦写进合约部署上去，就改不了了。所以起名字之前想好，别部署完了才发现打错了字——改不了，只能重新部署一个新合约。

### 2. 谁可以 Mint？

Mint 就是“铸造”，把一个新的 NFT 创造出来。谁有这个权力？常见的有两种设计：

- **只有合约主人能 Mint**：你部署了合约，你是主人，只有你能决定 Mint 几张、给谁。适合你自己发行一个小系列。
- **谁都可以 Mint（可能要付钱）**：合约写一个公开的 Mint 函数，任何人调用就能 Mint 一张，有的要付一点 ETH 作为价格。适合公开发售。

刚开始学，建议先用第一种：只有主人能 Mint。逻辑最简单，也最不容易出问题。等你熟悉了，再去研究公开 Mint、限量、价格这些玩法。

### 3. Metadata 放在哪？

第 29 篇讲过，NFT 的 Metadata（名字、描述、图片链接）不在链上，而是一份 JSON 文件，合约里的 `tokenURI` 指向它。写合约之前就要想好这份文件放哪：

- **放在 IPFS 上**：最常见的做法，内容寻址，地址不会变，适合长期保存。
- **放在自己的服务器上**：灵活，但服务器一关图就没了。
- **直接生成在链上**：第 30 篇讲过，图片由合约当场画出来，最去中心化，但只能画简单图形，成本也高。

这篇先用 IPFS 的做法，因为它是最通用、最适合新手的一条路。具体的 Metadata 文件怎么做，第四节会一步一步讲。

**一句话记住：名字、谁能 Mint、Metadata 放哪——这三件事定下来，合约的骨架就出来了。**

---

## 二、不用从零写：OpenZeppelin 的 ERC721

ERC721 标准定义了一大堆函数：`balanceOf`、`ownerOf`、`transferFrom`、`approve`、`tokenURI`……如果从零开始自己写，你要把每个函数的逻辑、每个边界情况都处理好，还要保证没有安全漏洞。这对新手来说几乎不可能一次写对。

所以实际开发中没有人从零写 NFT 合约。大家用的都是 **OpenZeppelin** 提供的、经过审计的 ERC721 实现。你只需要继承它，再写上自己需要的几个函数就行。

### OpenZeppelin 是什么？

OpenZeppelin 是一套开源的智能合约库，里面的合约都经过专业审计，是整个行业最常用的“标准零件”。它的 ERC721 实现，就是把 ERC721 标准里要求的所有函数都写好了，你直接拿来用。

安装它只需要一行命令（如果你用 Hardhat 或者 Foundry 的本地项目）：

```
npm install @openzeppelin/contracts
```

如果你用 Remix（第五节会讲），连安装都不用，Remix 会自动帮你找到这个库。

### 现在的最新版本是 v5

这里要特别提醒一句：**网上很多 NFT 教程用的是 OpenZeppelin v4 的写法，照着抄到 v5 上会编译失败。**

OpenZeppelin Contracts 现在的最新版是 v5.x（2026 年 2 月审计的 v5.6.0 之后又出了 v5.6.1，要求 Solidity ^0.8.20）。v5 相对 v4 有几个变化，直接影响你怎么写代码：

| 变化 | v4 的写法 | v5 的写法 |
|---|---|---|
| 计数器 | `Counters` 库，`_tokenIds.increment()` | 库被移除了，直接用 `uint256` 变量，自己加 1 |
| Ownable 构造函数 | `constructor() {}`，部署者自动成为主人 | 必须传一个地址：`Ownable(msg.sender)` |
| 转账钩子 | `_beforeTokenTransfer`、`_afterTokenTransfer` | 钩子被移除，统一改成 `_update` 函数 |

**这是最容易踩的坑**：你照着一篇 2022 年、2023 年的教程抄代码，编译器报一堆错，原因往往不是你的代码有问题，而是教程用的库版本太老了。写合约之前先确认两件事：你用的 OpenZeppelin 是哪个大版本，教程是不是同一个版本。版本对不上，先对版本，别硬改代码。

### 继承哪一个合约？ERC721 还是 ERC721URIStorage？

OpenZeppelin 提供了两个常用的 ERC721 实现，选哪个取决于你的 Metadata 怎么管理：

|  | ERC721 | ERC721URIStorage |
|---|---|---|
| Metadata 怎么定 | 统一的基础地址 + 编号拼出来，比如 `ipfs://QmXx.../1.json`、`ipfs://QmXx.../2.json` | 每个编号单独存一个完整的 tokenURI |
| 适合场景 | 系列里每张图的 Metadata 格式统一、按编号排列 | 每张图的 Metadata 地址都不一样、需要单独指定 |
| 成本 | 便宜，不用一个个存地址 | 稍贵，每个 tokenURI 都要单独存上链 |

新手建议先用 **ERC721URIStorage**：每张 NFT 的 Metadata 地址你想填什么就填什么，最直观、最不容易搞错。等系列做大了、Metadata 都是按编号排好的，再换成基础的 ERC721 + `_baseURI` 的做法。

---

## 三、完整合约，一行一行讲清楚

前面的准备工作做完，现在写出完整的合约。先给完整代码，再一行一行拆开讲：

```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyFirstNFT is ERC721URIStorage, Ownable {
    uint256 private s_tokenCounter;

    constructor() ERC721("My First NFT", "MFN") Ownable(msg.sender) {}

    function mintNft(string memory tokenURI) public onlyOwner returns (uint256) {
        uint256 newTokenId = s_tokenCounter;
        s_tokenCounter++;
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        return newTokenId;
    }
}
```

整个合约不到 30 行。下面按顺序拆开：

### 1. 开头的两行：许可证和 Solidity 版本

```
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
```

第一行是开源许可证声明，MIT 是最常用的一个，照抄就行。第二行指定 Solidity 版本。注意这里写的是 `^0.8.20`，意思是 0.8.20 及以上、0.9.0 以下的版本都能用。这个版本号要和你用的 OpenZeppelin v5 对上——v5 要求 Solidity 最低就是 0.8.20，写低了会报错。

### 2. 导入：把别人写好的合约拿进来

```
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
```

这两行就是把 OpenZeppelin 的两个合约导入进来：`ERC721URIStorage` 负责 NFT 的核心逻辑，`Ownable` 负责“只有主人能调用某些函数”这个权限控制。

**经常犯的错**：把导入路径抄错一个字母，或者抄了 v4 的路径。v5 的路径就是上面这两行，照抄不会错。

### 3. 合约声明：继承

```
contract MyFirstNFT is ERC721URIStorage, Ownable {
```

`is ERC721URIStorage, Ownable` 的意思就是：我的合约继承了这两个合约的功能。你不用自己写转账、查余额、查主人这些函数，继承来的合约里都有了。

### 4. 计数器：给每张 NFT 发编号

```
    uint256 private s_tokenCounter;
```

`s_tokenCounter` 是一个计数器，记录下一个要 Mint 的 NFT 是几号。它从 0 开始，第一张 Mint 出来的 NFT 是 #0 号，第二张是 #1 号，以此类推。

这里特意用了一个普通的 `uint256` 变量，而不是老教程里的 `Counters` 库——因为 v5 已经把 `Counters` 移除了，照着老教程写 `using Counters for Counters.Counter` 会直接编译失败。这也是第二节那张表里提醒过的变化。

### 5. 构造函数：起名字，定主人

```
    constructor() ERC721("My First NFT", "MFN") Ownable(msg.sender) {}
```

合约部署的时候只运行一次的函数，做两件事：

- `ERC721("My First NFT", "MFN")`：给这个系列起名字叫 "My First NFT"，符号是 "MFN"。
- `Ownable(msg.sender)`：把部署这个合约的人（也就是你）设为主人。v5 的 `Ownable` 必须传一个地址，不传会报错。`msg.sender` 就是当前调用者的地址，部署的时候就是你的钱包地址。

**新手最容易搞混的一点**：构造函数只在部署时运行一次，部署完了就再也不会运行了。名字、符号、主人，都是部署那一刻定死的，之后改不了。想改？只能重新部署一个新合约。

### 6. Mint 函数：这才是你真正写的逻辑

```
    function mintNft(string memory tokenURI) public onlyOwner returns (uint256) {
        uint256 newTokenId = s_tokenCounter;
        s_tokenCounter++;
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        return newTokenId;
    }
```

这是整个合约里唯一一个你自己写的函数，一行一行看：

- `function mintNft(string memory tokenURI)`：函数名叫 `mintNft`，接收一个参数 `tokenURI`，就是这张 NFT 的 Metadata 地址。调用的时候你把准备好的 Metadata 地址传进来。
- `public onlyOwner`：`public` 是说谁都能调用这个函数，但 `onlyOwner` 这个修饰器把它拦住了——只有合约主人能调用，别人调用会直接失败。这是 `Ownable` 提供的功能。
- `uint256 newTokenId = s_tokenCounter;`：先把当前计数器的值拿出来，作为新 NFT 的编号。
- `s_tokenCounter++;`：计数器加 1，下次 Mint 就是下一个编号。
- `_safeMint(msg.sender, newTokenId);`：把这张新 NFT Mint 给主人（`msg.sender`，也就是你）。用的是 `_safeMint` 而不是 `_mint`，区别在于 `_safeMint` 会检查接收方能不能正常接收 NFT——如果接收方是一个合约，它必须实现 `onERC721Received` 这个函数才能收 NFT，不然这笔 Mint 会失败。这个检查能防止 NFT 被 Mint 到一个永远取不出来的地址里。
- `_setTokenURI(newTokenId, tokenURI);`：把你传进来的 Metadata 地址和这个编号绑定在一起。这就是 `ERC721URIStorage` 提供的函数。
- `return newTokenId;`：把新 NFT 的编号返回给你，方便你知道这次 Mint 的是几号。

**一个很多人第一次都会问的问题**：ERC721 标准里为什么没有现成的 Mint 函数？因为标准只规定了“NFT 应该有什么功能”（转账、授权、查询），没规定“NFT 应该怎么被创造出来”。Mint 的规则每个项目都不一样：谁能 Mint、一次能 Mint 几张、要不要付钱、编号从几开始——这些都由你自己定。所以 Mint 函数必须自己写，标准里不会替你写。

### 继承之后，你免费得到了哪些函数？

写了上面这 30 行，你的合约自动就有了 ERC721 标准要求的全部功能：

| 函数 | 作用 |
|---|---|
| `name()`、`symbol()` | 查系列的名字和符号 |
| `balanceOf(地址)` | 查某个地址有多少张 NFT |
| `ownerOf(编号)` | 查某张 NFT 现在属于谁 |
| `tokenURI(编号)` | 查某张 NFT 的 Metadata 地址 |
| `transferFrom(从, 到, 编号)` | 转账 |
| `approve(地址, 编号)`、`setApprovalForAll(地址, 是/否)` | 授权别人操作你的 NFT |
| `supportsInterface(接口 ID)` | 告诉别人“我是一个 ERC721 合约” |

这些你一行都不用写，继承来的合约里全都有了。这就是用 OpenZeppelin 的意义：你只写属于你自己的逻辑，标准的部分交给经过审计的库。

---

## 四、Metadata 那份 JSON 文件怎么做？

合约写好了，但它还不知道你的 NFT 长什么样。长相在 Metadata 那份 JSON 文件里，Mint 的时候通过 `tokenURI` 传给合约。

### 先传图片，再写 JSON

顺序是这样的：先把图片传上 IPFS，拿到图片地址；再写 JSON 文件，把图片地址填进去；最后把 JSON 文件也传上 IPFS，拿到 JSON 的地址。这个 JSON 地址，就是调用 `mintNft` 的时候要传的 `tokenURI`。

传文件上 IPFS，最常用的是 **Pinata**（pinata.cloud）：注册账号、上传文件，它会给你一个 CID（一串以 `Qm` 开头的哈希），图片地址就是 `ipfs://Qm...` 这种格式。Pinata 有免费额度，练手完全够用。

### JSON 文件长什么样？

一份标准的 NFT Metadata JSON 是这样的：

```
{
    "name": "我的第一张 NFT #0",
    "description": "这是我亲手写合约 Mint 出来的第一张 NFT。",
    "image": "ipfs://QmXx.../我的图.png",
    "attributes": [
        {
            "trait_type": "背景",
            "value": "蓝色"
        },
        {
            "trait_type": "等级",
            "value": "新手"
        }
    ]
}
```

四个部分：

- **name**：这张 NFT 的名字，会显示在市场上。
- **description**：一句话介绍。
- **image**：图片地址，指向你刚传上 IPFS 的那张图。
- **attributes**：特征列表，市场会把它显示成一张张小标签，比如“背景：蓝色”“等级：新手”。

**经常踩的坑**：JSON 文件里多了一个逗号、少了一个引号，文件就解析失败，市场上这张 NFT 就显示不出来。写完 JSON 先找个在线 JSON 校验工具检查一下，确认格式没问题再上传。还有一点：`image` 字段里填的是图片的地址，不是把图片本身塞进 JSON 里。

### tokenURI 传什么格式？

调用 `mintNft` 的时候，`tokenURI` 参数传 JSON 文件的 IPFS 地址，也就是 `ipfs://Qm.../metadata.json` 这种格式。市场拿到这个地址，就会去读 JSON，再根据 JSON 里的 `image` 去读图片，拼出你要看到的那张 NFT 卡片。

也可以传 `https://` 开头的网关地址，比如 Pinata 提供的网关链接。两种格式市场都认，`ipfs://` 更标准一些。

---

## 五、在 Remix 里编译和部署

合约和 Metadata 都准备好了，现在把它部署到测试网上。最适合新手的工具是 **Remix**（remix.ethereum.org）：一个网页版的 Solidity 编辑器，不用安装任何东西，打开浏览器就能写、能编译、能部署。

### 第 1 步：把合约粘贴进 Remix

打开 remix.ethereum.org，在左边文件区新建一个文件，起名 `MyFirstNFT.sol`，把第三节的完整合约粘贴进去。

### 第 2 步：编译

点左边的“编译”按钮（Solidity Compiler），选一个 0.8.20 以上的编译器版本（比如 0.8.20 或者更新的），点“Compile”。如果代码有问题，编译器会告诉你哪一行错了，照着改就行。

**经常犯的错**：编译器版本选得太低。比如选了 0.8.19，但 OpenZeppelin v5 要求最低 0.8.20，编译会直接报错。先看报错信息里提到的最低版本要求，再去选编译器版本。

### 第 3 步：连钱包，切到 Sepolia 测试网

点左边的“部署”按钮（Deploy & Run Transactions），环境选 **Injected Provider - MetaMask**，Remix 会请你连接 MetaMask。连接之后，把 MetaMask 切换到 **Sepolia 测试网**。

Sepolia 是现在最常用的以太坊测试网，Chain ID 是 11155111。之前第 24 篇讲过怎么在 MetaMask 里配置多个网络，如果你的钱包里还没有 Sepolia，先按那篇的方法把它加上。再去水龙头领一点测试 ETH——部署合约和 Mint 都要付 Gas，测试 ETH 是免费领的，比如 sepoliafaucet.com。

**最容易出现的问题**：钱包连的是主网，合约一部署就上主网了，Gas 费是真金白银。部署之前养成一个习惯：看一眼 MetaMask 顶部显示的是哪个网络，确认是 Sepolia 再点部署。

### 第 4 步：部署

部署界面选 `MyFirstNFT` 这个合约，点“Deploy”，MetaMask 会弹出确认框，确认之后等一会儿，合约就部署好了。部署成功之后，Remix 下方会出现你的合约地址，复制下来保存好。

部署这一步本身也要付 Gas，测试网上大概花一点测试 ETH，不用心疼，领来的测试 ETH 就是用来练手的。

---

## 六、Mint 第一张 NFT，然后验证它真的存在

合约部署好了，现在 Mint 第一张 NFT：

1. 在 Remix 的部署界面找到你的合约，展开 `mintNft` 函数。
2. 在 `tokenURI` 那一栏填上第四节准备好的 Metadata 地址，比如 `ipfs://QmXx.../metadata.json`。
3. 点交易按钮，MetaMask 弹出确认，确认之后等交易上链。

交易成功之后，怎么确认这张 NFT 真的存在？三个办法：

### 1. 在 Remix 里直接查

展开合约的 `ownerOf` 函数，输入 `0`，点查询——如果返回的是你的钱包地址，说明 #0 号 NFT 已经是你的了。再展开 `tokenURI`，输入 `0`，返回的应该就是你刚才传的 Metadata 地址。

### 2. 去 Sepolia 的区块链浏览器上看

打开 sepolia.etherscan.io，搜你的合约地址，在“合约”页面能看到刚才那笔 Mint 交易。如果合约验证过了，还能直接在浏览器上调用 `ownerOf`、`tokenURI` 这些函数。合约验证的具体步骤，下一篇会细讲。

### 3. 去 OpenSea 测试网上看

打开 testnets.opensea.io，搜你的钱包地址或者合约地址，你 Mint 的 NFT 应该已经出现在这里了，带着你在 Metadata 里写的名字、描述和图片。

**一个新手经常困惑的点**：Mint 完了去 OpenSea 上看，图出不来，或者显示一片空白。先别急，大概率是这几个原因之一：Metadata 的 JSON 格式有问题、图片地址写错了、IPFS 网关暂时读不出来。先按第一种办法在 Remix 里查 `tokenURI`，确认链上存的地址是对的；再直接用浏览器打开那个 `ipfs://` 地址（通过网关），确认 JSON 文件本身能打开。链上地址对了、文件也能打开，剩下的就是等市场刷新缓存。

---

## 七、第一次写 NFT 合约，最容易踩的坑

把前面几节容易出错的地方集中列一下，写之前看一遍，能少走很多弯路：

### 1. 照着老教程抄，编译直接失败

网上大部分 NFT 教程写于 OpenZeppelin v4 时代，用的 `Counters`、无参数的 `Ownable`、 `_beforeTokenTransfer` 这些写法在 v5 里都不存在了。**先确认教程用的库版本和你用的版本是不是同一个大版本**，版本对不上，优先相信官方文档的最新写法，而不是教程里的旧代码。

### 2. `Ownable` 构造函数忘了传地址

v5 的 `Ownable` 必须传一个初始主人的地址，`Ownable(msg.sender)` 是最常见的写法。忘了传，编译器会报错；传错了（比如传了 `address(0)`），部署会直接失败。

### 3. 用 `_mint` 不用 `_safeMint`

`_mint` 只管把 NFT 记到对方名下，不管对方能不能收。`_safeMint` 会多做一步检查：如果接收方是个合约，它必须能正确处理 NFT 才能收。**除非你明确知道自己在干什么，否则一律用 `_safeMint`。** 这也是 Chainlink 官方训练营的 NFT 课（PhotoAlbum 合约）里的做法。

### 4. Metadata 地址填错，或者 JSON 格式有问题

Mint 的时候传的 `tokenURI` 一定要再三确认：地址对不对、JSON 能不能打开、图片能不能加载。Mint 完了才发现地址填错了，那张 NFT 的 Metadata 就错了——虽然可以用 `_setTokenURI` 再改（前提是你写了这个功能，我们这个简单合约里没有），但已经 Mint 出去的 NFT 改起来很麻烦。Mint 之前先在浏览器里打开那个地址看一眼。

### 5. 部署到了错误的网络

钱包显示主网，手一滑就部署上去了，Gas 费是真的 ETH。部署之前看一眼网络名字，确认是 Sepolia 测试网。这个习惯越早养成越好。

### 6. 把 Metadata 放在一个随时会消失的地方

图片和 JSON 放在自己的电脑上、放在一个免费图床的临时链接里，链接一失效，NFT 就只剩一个编号。第 29 篇讲过，Metadata 和图片的保存方式决定了 NFT 能活多久。练手的时候无所谓，但凡是想长期保存的系列，图片和 Metadata 一定要放在 IPFS 这种内容寻址的存储上，并且找个 Pin 服务固定住。

---

## 总结

- **写之前先定三件事**：系列的名字和符号、谁可以 Mint、Metadata 放在哪。这三件事定了，合约的骨架就出来了。
- **不用从零写**：继承 OpenZeppelin 的 `ERC721URIStorage`，标准功能（转账、授权、查询）都是现成的，你只需要写 Mint 函数和计数器。
- **注意版本**：现在最新的是 OpenZeppelin v5.x（v5.6.1，要求 Solidity ^0.8.20）。`Counters` 在 v5 里被移除了，改用普通 `uint256` 变量；`Ownable` 的构造函数必须传一个地址，一般是 `Ownable(msg.sender)`。
- **完整合约不到 30 行**：构造函数定名字和主人，`mintNft` 函数做三件事——取编号、计数器加 1、`_safeMint` + `_setTokenURI`。ERC721 标准本身没有 Mint 函数，Mint 规则由你自己写。
- **Metadata 是另一半工作**：图片先传 IPFS，再写 JSON、再传 IPFS，JSON 地址就是 Mint 时要传的 `tokenURI`。JSON 格式错了，NFT 在市场上就显示不出来。
- **部署和验证**：Remix 里编译、连 MetaMask、切 Sepolia 测试网、部署、调用 `mintNft`，再用 `ownerOf` 和 `tokenURI` 查一遍，或者去 Sepolia Etherscan 和 OpenSea 测试网上确认。
- **最容易踩的坑**：照老教程抄导致编译失败、`Ownable` 忘了传地址、用 `_mint` 不用 `_safeMint`、Metadata 地址填错、部署到错误的网络。

---

## 下一篇是第 32 篇：

[[y7blog-web3-33]]

这篇我们在 Remix 里把合约部署到了 Sepolia、Mint 了第一张 NFT。下一篇把这条路走完整：合约怎么在 Etherscan 上验证源码、验证之后能在浏览器上直接调用函数、Mint 出来的 NFT 怎么在市场上确认、以及部署之前还有哪些检查要做。

*参考资料：OpenZeppelin 文档《ERC721》（docs.openzeppelin.com/contracts/5.x/api/token/erc721，2026-11-18 核对，v5.6.1，要求 Solidity ^0.8.20）；OpenZeppelin《Introducing Contracts 5.0》（移除了 Counters、SafeMath，Ownable 构造函数改为传 initialOwner，2023-10-05）；Chainlink 训练营 2024《PhotoAlbum.sol》（github.com/smartcontractkit/chainlink-bootcamp-2024，Session 6 任务 9，ERC721URIStorage + Ownable + mint + _safeMint + _setTokenURI）；Alchemy《How to Create an NFT on Ethereum》（web3.university，Sepolia + Hardhat + Pinata + ERC721URIStorage 流程）；OpenSea 文档《Metadata standards》；EIP-721（eips.ethereum.org/EIPS/eip-721）。*
