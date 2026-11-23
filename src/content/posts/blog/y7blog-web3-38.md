---
title: 37｜如何创建 CCIP 跨链 NFT 合约？
published: 2026-11-13
pinned: false
draft: false
comment: true
description: 这篇从一份 Solidity 合约开始，搭一个支持 CCIP 的跨链 NFT：源链上烧掉再发消息，目标链上收到消息再铸出来。按 Chainlink CCIP 2.0 的最新写法，用 CCIPReceiver 收消息、ExtraArgsV3 配 Gas 上限，两条链上部署同一份合约、互相配好白名单，再跑一次 Sepolia 到 Fuji 的实测。
image: https://www.y7img.ccwu.cc/file/1795226831666_y7blog-web3-38-1600.png
tags: [CCIP,跨链NFT,ERC721,Solidity,Chainlink]
category: Web3
slug: blog/y7blog-web3-38
series: "区块链百科"
seriesOrder: 1
---

你手里有一张 NFT，在 Ethereum Sepolia 上 Mint 的。现在你想把它拿到 Avalanche Fuji 上用。源链上先烧掉再发消息，链下验证节点签名背书，目标链上验证通过才铸出新的——流程是这样，但合约还没写：到底哪几行代码负责烧、哪几行负责发消息、目标链上又是谁在等消息？

这篇就动手写这份合约。目标很具体：**一份 Solidity 合约，部署到 Sepolia 和 Fuji 两条链上，能把一张 NFT 从 Sepolia 搬到 Fuji，搬过去之后还是同一个 tokenId、同一份 metadata**。写完你会发现，跨链 NFT 没有你想的那么神秘：它就是一个普通的 ERC721 合约，外加“发消息”和“收消息”两组函数。

> 💡 **先说清楚**：这篇的合约是学习用的骨架，照着 Kaia 官方博客的实测合约、按 CCIP 2.0 的最新写法改的，没有经过审计，不能直接拿去生产环境用。动手之前先在测试网练手、小额试。本文是知识科普，不是投资建议。

---

## 一、动手之前：先想清楚这份合约要干哪几件事

写代码之前，先把合约的活儿分清楚。一份跨链 NFT 合约要干的活儿，其实只有两件：**在源链上把 NFT 发出去，在目标链上把 NFT 接回来**。发出去的那一半，要先烧掉你手里的 NFT，再调 CCIP 的 Router 把消息发走；接回来的那一半，要先验明消息确实是对方那份合约发来的，再按同一个 tokenId 把 NFT 铸出来。

这里有个选择要先做：发和收，是写在一个合约里，还是写成两个合约？两种写法都有人在用：

| 写法 | 是什么样的 | 谁在用 | 适合谁 |
| --- | --- | --- | --- |
| **一个合约，两边部署** | 同一份合约文件，部署到 Sepolia 一份、Fuji 一份；每份既会发消息、也会收消息 | Kaia 官方博客的 CrosschainNFT 实测 | 第一次写跨链合约：代码只有一份，改起来只改一个地方 |
| **两个合约，各管一边** | 源链上一个发送合约（SourceMinter），目标链上一个接收合约（DestinationMinter）加一个 NFT 合约（MyNFT） | QuickNode 的跨链 NFT 教程、Chainlink 官方旧教程 | 目标链上的 NFT 合约已经存在、不能改的情况 |

这篇用第一种写法：**一份合约，两边部署**。原因很实在：学习的时候代码越少越好，一份文件改一个地方，两边都跟着变。而且 Kaia 官方博客就是这么写的，整条链路已经在 Sepolia 和 Kaia 测试网之间实测跑通过，可以直接照着学。

路线选 burn-and-mint：源链上烧掉，目标链上重新铸。为什么不选 lock-and-mint？因为 burn-and-mint 的合约最简单——源链上不用留一个金库合约替你保管原件，逻辑只有“烧”和“铸”两步。lock-and-mint 要多一个金库、还要处理“烧包装版、解锁原件”的回程，下一篇讲从一条链 Mint 到另一条链的完整往返时再展开。

还有一个事先要知道的坏消息：Chainlink 官方原来那篇跨链 NFT 教程已经下线了，2026 年 11 月 20 日核对时原地址返回 404；现在官方的入门套件（Foundry 和 Hardhat 3 两个版本）里也只有 Token 转移、消息收发和 CCT 的例子，没有 NFT 的例子。所以这篇的合约不是照抄官方教程，而是**拿 CCIP 2.0 的基础零件（CCIPReceiver、Client、ExtraArgsCodec），照着 Kaia 官方博客那份实测过的合约拼出来的**。零件是官方 2.0 的最新版，拼法是 Kaia 验证过的。

---

## 二、准备工作：先把依赖和地址备齐

动手写代码之前，先把三样东西备齐：开发环境、依赖包、两条链的地址。缺一样，后面都会卡住。

### 1. 开发环境：Hardhat 3

这篇跟着 Kaia 的教程走，用 Hardhat 3。Hardhat 3 有一个对新手很友好的改动：私钥和 RPC 地址不用写进配置文件，存在加密的 keystore 里，用的时候再取。这个后面部署那节会讲到。

如果你更习惯 Foundry，官方的 CCIP Foundry 入门套件也是一条路，两个套件都钉在同一个版本组合上：Chainlink Local v0.3.1、`@chainlink/contracts-ccip` 2.0.0、solc 0.8.26。工具可以二选一，合约写法是一样的。

### 2. 装依赖：三个包，版本要钉死

```
npm i @chainlink/contracts-ccip@2.0.0 --save-dev
npm i @chainlink/contracts --save-dev
npm i @openzeppelin/contracts@^5.7.0 --save-dev
```

版本号这里要多说一句。`@chainlink/contracts-ccip` 一定要写 `@2.0.0`，这是 CCIP 2.0 的包，2026 年 11 月 19 日官方文档刚更新到这个版本；不写版本号装到的也可能是旧版，旧版里没有 ExtraArgsV3 的编码器，第七节的写法就用不了。`@openzeppelin/contracts` 装 `^5.7.0`，这是 2026 年 7 月 30 日发布的最新版。31 篇核对的时候最新还是 v5.6.1，现在 5.7.0 已经出来了，本篇用到的 ERC721、ERC721URIStorage、ERC721Burnable 这几个件在 5.7 里都没变，放心用。

### 3. 两条链的地址：动手之前去 CCIP Directory 查一遍

部署的时候，构造函数要填三样东西：Router 地址、LINK 地址、当前链的 chain selector。下面这张表是按官方 CCIP Directory 和之前文章核对过的，Sepolia 和 Fuji 的 Router 地址是 CCIP 2.0 的新版路由器：

|  | Ethereum Sepolia | Avalanche Fuji |
| --- | --- | --- |
| Chain ID | 11155111 | 43113 |
| Chain Selector | 16015286601757825753 | 14767482510784806043 |
| CCIP Router | 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59 | 0xF694E193200268f9a4868e4Aa017A0118C9a8177 |
| LINK | 0x779877A7B0D9E8603169DdbD7836e478b4624789 | 0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846 |

Fuji 的 LINK 地址是 27 篇实战时核对过的，动手之前最好再去 CCIP Directory（ccip.chain.link）上查一遍——地址这种东西，宁可多查一次，也别凭记忆填。Chain ID 和 chain selector 是两套编号，别搞混，36 篇讲过，填错了消息发不出去。

### 4. 测试币：三样都要有

| 测试币 | 用来干什么 | 从哪领 |
| --- | --- | --- |
| Sepolia ETH | 付 Sepolia 上的 Gas | faucets.chain.link |
| Fuji AVAX | 付 Fuji 上的 Gas | faucet.avax.network |
| LINK | 付 CCIP 跨链费 | faucets.chain.link |

LINK 要领两份的量：部署完之后要给两边的合约各充一点，发送那次的费用是从合约余额里扣的，不是你钱包里直接扣。这点后面第五节还会讲到，很多人第一次都在这里卡住。

---

## 三、合约长什么样：先看整体结构

先把整份合约的骨架摆出来，再一个函数一个函数讲。这份合约叫 `CrosschainNFT`，继承的东西有点多，一个一个说：

```
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {ExtraArgsCodec} from "@chainlink/contracts-ccip/contracts/libraries/ExtraArgsCodec.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";
```

| 继承 / 引入 | 是干什么的 |
| --- | --- |
| `ERC721` | NFT 本体：tokenId、持有人、转账这些基本功能 |
| `ERC721URIStorage` | 每个 tokenId 存一份自己的 metadata 链接（tokenURI） |
| `ERC721Burnable` | 提供 `burn` 函数，源链上烧 NFT 就靠它 |
| `CCIPReceiver` | CCIP 2.0 的接收基类：帮你验明只有 Router 能调 `ccipReceive`，你只要实现 `_ccipReceive` |
| `ReentrancyGuard` | 防重入：发消息和收消息的函数都加上 `nonReentrant` |
| `OwnerIsCreator` | Chainlink 的轻量权限：部署者就是 owner，只有 owner 能配白名单、提款 |
| `Client` / `ExtraArgsCodec` | 组 CCIP 消息、编码 extraArgs 的工具库 |
| `IRouterClient` / `LinkTokenInterface` | 调 Router 发消息、调 LINK 付费用的接口 |

Solidity 版本用 `^0.8.26`，跟官方入门套件钉的 solc 0.8.26 一致。

合约里的状态，核心就三样：

```
IRouterClient internal immutable i_ccipRouter;
LinkTokenInterface internal immutable i_linkToken;
uint64 private immutable i_currentChainSelector;

mapping(uint64 destChainSelector => crosschainNFTDetails crosschainNFTPerChain) public s_chains;
```

`s_chains` 是这份合约的“通讯录”：key 是目标链的 chain selector，value 里存两样东西——对方那份合约的地址，和发给那条链时用的 extraArgs。`enableChain` 就是往通讯录里加人，`disableChain` 是删人。消息发出去之前，先查通讯录：这条链在不在通讯录里？不在，直接 revert。

构造函数要填三个参数：Router 地址、LINK 地址、当前链的 chain selector。同一份合约部署到 Sepolia 和 Fuji，填的参数不一样——Sepolia 那份填 Sepolia 的 Router 和 LINK，Fuji 那份填 Fuji 的。部署脚本那节会具体写。

---

## 四、核心函数一：mint 和 enableChain

### mint：只能在“老家”那条链上铸

```
uint256 private _nextTokenId;
uint256 constant HOME_CHAIN_ID = 11155111; // Ethereum Sepolia

function mint() external onlyHomeChain {
    uint256 tokenId = _nextTokenId++;
    _safeMint(msg.sender, tokenId);
    _setTokenURI(tokenId, tokenURI);
}
```

注意 `onlyHomeChain` 这个限制：**mint 只能在 Sepolia 上调**。这是 Kaia 教程里的做法，原因是一个经常犯的错：**两边都能 mint，tokenId 会撞车**。

想想看：`_nextTokenId` 是从 0 开始数的计数器。Sepolia 上 mint 了 tokenId 0、1、2，Fuji 上也 mint 了 tokenId 0、1、2。过几天你把 Sepolia 上的 tokenId 1 搬到 Fuji，Fuji 一查：tokenId 1 已经有人了，`_safeMint` 直接 revert，整条跨链消息在目标链上执行失败。更糟的是，这不是偶尔才发生——两边只要都 mint 过，撞车的概率随着数量越长越高。

解决办法就是 Kaia 用的这个：**只允许一条链当“老家”，新 NFT 只在老家铸，另一条链只负责接收**。tokenId 只在老家产生，永远不会撞。换一条主链当老家，就改 `HOME_CHAIN_ID` 这个数。如果你确实需要两边都能 mint，那就要给 tokenId 分号段（比如 Sepolia 从 0 开始、Fuji 从 1,000,000 开始），那是进阶做法，这篇先不展开。

### enableChain：部署完第一件事，先互相打招呼

```
function enableChain(uint64 chainSelector, address crosschainNFTAddress, bytes memory ccipExtraArgs)
    external
    onlyOwner
    onlyOtherChains(chainSelector)
{
    s_chains[chainSelector] = crosschainNFTDetails({
        crosschainNFTAddress: crosschainNFTAddress,
        ccipExtraArgsBytes: ccipExtraArgs
    });
    emit ChainEnabled(chainSelector, crosschainNFTAddress, ccipExtraArgs);
}
```

`enableChain` 是 owner 才能调的，调一次就是往通讯录里加一条：目标链的 selector、对方合约的地址、发给那条链时用的 extraArgs。`onlyOtherChains` 是个保护：不能把自己这条链加进通讯录，否则合约会给自己发消息，白白烧钱。

部署完之后要调两次：Sepolia 那份合约调一次，把 Fuji 的 selector 和 Fuji 合约地址登记上；Fuji 那份合约调一次，把 Sepolia 登记上。**两边都要配，只配一边，消息发过去会被接收方拒收**——接收那边的 `_ccipReceive` 会查通讯录，查不到发送方就 revert。这是 36 篇讲过的白名单，写合约的时候就要把它做进函数里，而不是靠部署之后凭记忆去配。

---

## 五、核心函数二：crossChainTransferFrom——烧掉、问价、发消息

这是源链上最关键的函数，干四件事：读 metadata、烧 NFT、组消息、发消息。

```
function crossChainTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    uint64 destinationChainSelector,
    PayFeesIn payFeesIn
) external nonReentrant onlyEnabledChain(destinationChainSelector) returns (bytes32 messageId) {
    string memory tokenUri = tokenURI(tokenId);
    _burn(tokenId);

    Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
        receiver: abi.encode(s_chains[destinationChainSelector].crosschainNFTAddress),
        data: abi.encode(from, to, tokenId, tokenUri),
        tokenAmounts: new Client.EVMTokenAmount[](0),
        extraArgs: s_chains[destinationChainSelector].ccipExtraArgsBytes,
        feeToken: payFeesIn == PayFeesIn.LINK ? address(i_linkToken) : address(0)
    });

    uint256 fees = i_ccipRouter.getFee(destinationChainSelector, message);

    if (payFeesIn == PayFeesIn.LINK) {
        if (fees > i_linkToken.balanceOf(address(this))) {
            revert NotEnoughBalanceForFees(i_linkToken.balanceOf(address(this)), fees);
        }
        i_linkToken.approve(address(i_ccipRouter), fees);
        messageId = i_ccipRouter.ccipSend(destinationChainSelector, message);
    } else {
        if (fees > address(this).balance) {
            revert NotEnoughBalanceForFees(address(this).balance, fees);
        }
        messageId = i_ccipRouter.ccipSend{value: fees}(destinationChainSelector, message);
    }

    emit CrossChainSent(from, to, tokenId, i_currentChainSelector, destinationChainSelector);
}
```

一行一行拆开看：

**第 1 步：先读 tokenURI，再烧。** 顺序不能反。`tokenURI(tokenId)` 要在 `_burn(tokenId)` 之前调，因为烧掉之后这个 tokenId 就不存在了，再读就 revert。`_burn` 用的是 `ERC721Burnable` 的 burn，只有 tokenId 的主人或者被主人授权的人才能调——你不是主人，调这个函数第一步就失败。这是好事，别人拿不走你的 NFT。

**第 2 步：组消息。** `data` 里装四样东西：`from`（原来是谁的）、`to`（搬过去给谁）、`tokenId`（搬哪一张）、`tokenUri`（metadata 链接）。`tokenAmounts` 是空数组——NFT 本身不走 CCIP 的 Token 转移，消息里不带任何 Token，只带数据。`feeToken` 看你选哪种付费：LINK 就填 LINK 地址，原生币就填零地址。

**第 3 步：先问价，再发送。** `getFee` 问一次价，拿到费用再决定怎么付。LINK 付费要先 `approve` 给 Router 足够的额度；原生币付费就把币放在 `msg.value` 里。费用不够，发送直接 revert。

这里是最容易踩的坑之一：**LINK 要先转给合约，不是留在你钱包里**。费用是从合约的余额里扣的，合约里没有 LINK，`NotEnoughBalanceForFees` 直接 revert。部署完之后，记得往合约地址转一点 LINK 再发第一条消息。36 篇讲费用的时候提过，转给谁这个问题 27 篇也讲过：转给你部署在源链上的那个合约地址，不是转给 Router。

最后返回的 `messageId` 一定要记下来，第九节查状态就靠它。

---

## 六、核心函数三：_ccipReceive——验身份、再铸出来

目标链上的接收逻辑，CCIP 2.0 推荐继承 `CCIPReceiver`，只实现一个 `_ccipReceive`：

```
function _ccipReceive(Client.Any2EVMMessage memory message)
    internal
    override
    nonReentrant
    onlyEnabledChain(message.sourceChainSelector)
    onlyEnabledSender(message.sourceChainSelector, abi.decode(message.sender, (address)))
{
    (address from, address to, uint256 tokenId, string memory tokenUri) =
        abi.decode(message.data, (address, address, uint256, string));

    _safeMint(to, tokenId);
    _setTokenURI(tokenId, tokenUri);

    emit CrossChainReceived(from, to, tokenId, message.sourceChainSelector, i_currentChainSelector);
}
```

`CCIPReceiver` 这个基类已经帮你干了一件最重要的事：**只有 Router 能调 `ccipReceive`**。它的 `ccipReceive` 函数带 `onlyRouter` 检查，通过了才调你的 `_ccipReceive`。所以你不用自己再写一遍“验 msg.sender 是不是 Router”，基类已经验过了。你要验的只剩两层：

| 验什么 | 怎么验 | 防的是什么 |
| --- | --- | --- |
| 源链在不在通讯录里 | `onlyEnabledChain(message.sourceChainSelector)` | 不是你登记过的链发来的消息，直接拒收 |
| 发送方是不是对方那份合约 | `onlyEnabledSender(...)`，比对 `message.sender` 解出来的地址 | 有人仿造一条消息、冒充你的合约发过来 |

Kaia 的教程是另一种写法：直接实现 `IAny2EVMMessageReceiver` 接口，自己写 `onlyRouter` 检查。两种写法效果一样，官方文档建议大多数应用直接用 `CCIPReceiver`，因为 Router 检查和 ERC-165 接口检测都已经写好了，不容易漏。只有需要完全自己控制验证逻辑的时候，才直接实现接口。

解码之后就两行：`_safeMint(to, tokenId)` 按同一个 tokenId 铸出来，`_setTokenURI(tokenId, tokenUri)` 写同一份 metadata。搬过去的 NFT 和原来那张是同一个编号、同一张图、同一个 metadata——这就是 burn-and-mint 要保证的“只有一份有效”。

这里有个细节很容易忽略：`_safeMint` 的 `to` 如果是一个合约地址，那个合约必须实现 `onERC721Received`，否则铸造直接 revert，整条消息在目标链上执行失败、状态变 FAILURE。平时你搬 NFT 都是搬给自己的钱包地址（EOA），没这个问题；但如果你要搬给一个合约地址（比如一个游戏合约），先确认它能收 ERC721。

还有 `withdraw` 和 `withdrawToken` 两个函数，是给 owner 提款用的：合约里多余的原生币和 LINK 可以提出来。代码很短，照着 Kaia 的写就行。部署完别忘了留一点 LINK 在合约里，下次发送还要用。

---

## 七、extraArgs 到底怎么配：V3 是新的，V1 还能用

`extraArgs` 是消息里最容易让人看晕的部分，因为它换过三代。CCIP 2.0 的规则是：**新写的用 V3，老的 V1/V2 照样能用**，OnRamp 会在内部把老格式转成 V3。

| 格式 | 编码方法 | 能配什么 | 2.0 里什么状态 |
| --- | --- | --- | --- |
| `EVMExtraArgsV1` | `Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: ...}))`，tag 是 `0x97a657c9` | 只有 Gas 上限 | 还能用，老教程里都是它 |
| `GenericExtraArgsV2` | `Client._argsToBytes(...)`，带 `allowOutOfOrderExecution` | Gas 上限 + 乱序执行 | 还能用，但乱序那个参数在 2.0 里已经废弃了 |
| `ExtraArgsV3` | `ExtraArgsCodec._getBasicEncodedExtraArgsV3(gasLimit, finalityConfig)`，tag 是 `0xa69dd4aa` | Gas 上限 + 最终确认方式 + 验证器 + 执行器 | **新写的用这个** |

官方文档给的 V3 写法是这样的：

```
import {ExtraArgsCodec} from "chainlink-ccip/libraries/ExtraArgsCodec.sol";

bytes memory extraArgs = ExtraArgsCodec._getBasicEncodedExtraArgsV3(
    500_000, // gasLimit：目标链上执行时给接收合约的 Gas 上限
    bytes4(0) // finalityConfig：默认，等源链完整终局
);
```

这份合约把 extraArgs 存在 `s_chains` 通讯录里，`enableChain` 的时候一起传进去。你可以先用上面这段代码算好，调 `enableChain` 的时候把结果填进去。

### Gas 上限给多少合适

Kaia 的教程给的是 500,000。官方 Client 文档的例子给的是 300,000。到底给多少？**先在测试网实测，再留余量**。`_ccipReceive` 里干的活儿是 `_safeMint` 加 `_setTokenURI`，实际用量一般在 15 万到 20 万 Gas 之间，500,000 是留了充足余量的数。给太低，执行到一半没 Gas 了，消息变 FAILURE；给太高，报价的时候就多收你钱。36 篇讲费用的时候说过，目标链执行成本是按你定的 Gas 上限报价的。

### 最终确认方式：默认就好，别乱改

`bytes4(0)` 的意思是“默认”：等源链完整终局再放行。2.0 有一个 Faster-Than-Finality 的可选项，可以不等完整终局就放行，速度更快，但要自己承担重组风险。还有一个坑：**继承 `CCIPReceiver` 的合约默认只接受完整终局的消息**。如果你发送的时候选了 Faster-Than-Finality，接收方又是普通的 `CCIPReceiver` 合约，这条消息会被拒收——想接快速确认的消息，接收方要实现 `IAny2EVMMessageReceiverV2` 接口、自己声明接受哪种终局配置。学习阶段用默认就行，别碰这个选项。

---

## 八、部署到两条链：先部署、再互相打招呼

合约写好了，接下来部署。Kaia 的教程用 Hardhat 3 的 Ignition 部署，两条链各写一个部署模块：

```
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ETHEREUM_SEPOLIA_ROUTER_ADDRESS = `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59`;
const ETHEREUM_SEPOLIA_LINK_TOKEN_ADDRESS = `0x779877A7B0D9E8603169DdbD7836e478b4624789`;
const ETHEREUM_SEPOLIA_CHAIN_SELECTOR = `16015286601757825753`;

const CrosschainNFTSepoliaModule = buildModule("CrosschainNFTSepoliaModule", (m) => {
  const crosschainNFTSepolia = m.contract("CrosschainNFT", [
    ETHEREUM_SEPOLIA_ROUTER_ADDRESS,
    ETHEREUM_SEPOLIA_LINK_TOKEN_ADDRESS,
    ETHEREUM_SEPOLIA_CHAIN_SELECTOR,
  ]);
  return { crosschainNFTSepolia };
});

export default CrosschainNFTSepoliaModule;
```

Fuji 那份模块一模一样，只是三个值换成 Fuji 的：Router `0xF694E193200268f9a4868e4Aa017A0118C9a8177`、LINK `0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846`、selector `14767482510784806043`。

部署的顺序是固定的：

```
npx hardhat ignition deploy ignition/modules/deployEthereumSepolia.ts --network ethereumSepolia
npx hardhat ignition deploy ignition/modules/deployFuji.ts --network avalancheFuji
```

部署完先别急着发消息，还有两件事：

| 步骤 | 在哪做 | 干什么 |
| --- | --- | --- |
| 1. 部署 Sepolia 合约 | Sepolia | 记下合约地址 A |
| 2. 部署 Fuji 合约 | Fuji | 记下合约地址 B |
| 3. Sepolia 上调 `enableChain` | Sepolia | 登记 Fuji 的 selector 和合约地址 B，extraArgs 用 V3 编码好的字节 |
| 4. Fuji 上调 `enableChain` | Fuji | 登记 Sepolia 的 selector 和合约地址 A |
| 5. 给 Sepolia 合约转 LINK | Sepolia | 转给合约地址 A，不是转给 Router |
| 6. Sepolia 上调 `mint()` | Sepolia | 铸一张 NFT，记下 tokenId |

第 3、4 步的顺序是反不过来的：必须先拿到两边的合约地址，才能互相登记。这也是为什么部署脚本和 `enableChain` 要分两步走。

私钥怎么放？Hardhat 3 的做法是存在加密 keystore 里：

```
npx hardhat keystore set PRIVATE_KEY
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set FUJI_RPC_URL
```

**私钥不要写进 hardhat.config.ts，也不要写进 .env 文件再提交到 Git**。这是老生常谈，但每次都有人中招。测试网的私钥丢了只是丢测试币，养成坏习惯以后会丢真钱。

---

## 九、跑一次跨链：从 Mint 到 Fuji 上验货

都配好了，就可以跑第一次跨链了。全程四步：

```
1. Sepolia 上 mint()，拿到 tokenId（比如 0）
2. 转一点 LINK 到 Sepolia 的合约地址 A
3. Sepolia 上调 crossChainTransferFrom(
     你的地址, 你的地址, 0,
     14767482510784806043,  // Fuji 的 chain selector
     0                      // PayFeesIn.LINK = 0，用 LINK 付费
   )
4. 记下返回的 messageId
```

调完之后，Sepolia 上的那张 NFT 已经被烧掉了，Fuji 上那张还没出现——这段时间别慌。消息要等 Sepolia 完整终局（大约 12.8 分钟）、等验证节点签名、等默认执行器提交执行，整个过程按分钟算。去 CCIP Explorer（ccip.chain.link）上粘贴 messageId 或者源链交易哈希，就能看到这条消息走到哪一步了：已发送、验证中、已执行。

状态变成 Success 之后，去 Fuji 的浏览器上查：按 tokenId 找到那张 NFT，确认持有人是你、tokenURI 和原来那张指向同一份 metadata。都对上了，第一次跨链就跑通了。

**等不及就重复发一次，是最容易出现的问题**。消息还没到，你一着急又调了一次 `crossChainTransferFrom`——第一次那张已经烧掉了，第二次调的时候 tokenId 已经不存在，直接 revert，倒还好；怕的是你第一次 mint 了两张一样的、或者流程没走对，重复发可能烧掉两张、铸出两张。先去 Explorer 上查状态，确认卡在哪一步再说。

---

## 十、动手之前先在本地测：Chainlink Local

上测试网之前，最好先在本地把整条链路跑通。Chainlink 官方的本地测试工具叫 Chainlink Local，最新是 v0.3.1，专门为 CCIP 2.0 做的，钉在 `@chainlink/contracts-ccip` 2.0.0 和 solc 0.8.26 上。

| 模式 | 是干什么的 | 适合什么时候 |
| --- | --- | --- |
| `CCIPLocalSimulator`（不分叉） | 在本地模拟两条链，消息在 `ccipSend` 里同步送达，不用 RPC、不用 LINK | 第一次跑通：部署、enableChain、发消息、收消息，全流程走一遍 |
| `CCIPLocalSimulatorFork`（分叉） | 分叉 Sepolia 和 Fuji 的真实状态，跑真实链上的 Router 和 OffRamp | 上测试网之前最后一道检查：确认合约在真实路由器上也能跑 |

本地模式有个限制要先知道：**它不模拟执行器和手动执行**。你在本地测的时候，消息是立刻送达的；到了测试网上，执行是默认执行器帮你提交的，失败了 8 小时内重试。本地跑通了不代表测试网上一定秒到，第九节那个等待时间还是要留出来。

官方入门套件里 Example01 到 Example10 讲的都是 Token 转移、消息收发、CCT，没有 NFT 的例子。所以本地测试也只能测“消息能不能收发”这一层：发一条带 tokenId 的消息过去，接收方能不能正确解码、正确铸出来。NFT 那一层的逻辑（tokenId 会不会撞、metadata 对不对得上），要靠你自己写测试用例去覆盖。

---

## 十一、最容易踩的坑

前面讲的都是“应该怎么做”，这一节讲“经常犯的错”。动手之前先对照一遍，能省掉大半调试时间。

### 1. 合约里没 LINK 就发消息

费用是从合约余额里扣的，不是你钱包里直接扣。部署完忘了往合约里转 LINK，调 `crossChainTransferFrom` 直接 revert `NotEnoughBalanceForFees`。先转 LINK，再发消息。

### 2. 只配了一边的白名单

Sepolia 上配了 Fuji，Fuji 上忘了配 Sepolia。消息发过去了，接收方一查通讯录：发送方不在里面，拒收。部署完两边都要调 `enableChain`，缺一边都不行。

### 3. Gas 上限给太低

`_ccipReceive` 里 `_safeMint` 加 `_setTokenURI` 的 Gas 不够，消息在目标链上执行失败，状态变 FAILURE。好在失败可以重试：把 Gas 上限调高，重新发一次就行。但重新发要重新付一次跨链费，所以动手之前先在测试网实测实际用量。

### 4. 两边都能 mint，tokenId 撞了

第四节讲过：计数器两边都从 0 开始数，搬过去的时候发现目标链上这个 tokenId 已经有人了，`_safeMint` 直接 revert。只让“老家”那条链 mint，或者给两边分号段。

### 5. 搬给一个不会收 NFT 的合约地址

`_safeMint` 的 `to` 如果是合约地址，它必须实现 `onERC721Received`，不然铸造 revert、消息 FAILURE。搬给自己的钱包地址就没这个问题。

### 6. 照抄旧教程的 V1 extraArgs 字节串

网上很多旧教程直接给一串写好的 extraArgs，比如 Kaia 教程里的 `0x97a657c9000000000000000000000000000000000000000000000000000000000007A120`（这是 V1 编码、Gas 上限 500,000）。这串在 2.0 里还能用，OnRamp 会内部转成 V3——但新写的合约应该直接用 `ExtraArgsCodec._getBasicEncodedExtraArgsV3` 生成 V3，别再抄这串旧字节。抄来的东西，你不知道它配了什么，出问题都不知道从哪查起。

### 7. 把私钥写进配置文件

测试网练手也别这么干。Hardhat 3 的 keystore 就是为这个准备的，`npx hardhat keystore set PRIVATE_KEY` 存一次，以后都不用再碰明文私钥。

### 8. 用 Faster-Than-Finality 发给普通的 CCIPReceiver 合约

发送的时候选了快速确认，接收方又是默认的 `CCIPReceiver`，这条消息会被拒收——`CCIPReceiver` 默认只接受完整终局的消息。学习阶段用默认的 `bytes4(0)`，别碰快速确认那个选项。

### 9. tokenURI 先烧后读

`crossChainTransferFrom` 里先读 `tokenURI`、再 `_burn`，顺序不能反。烧掉之后再读，tokenId 已经不存在了，直接 revert。

### 10. 往 11 月 30 日后停用的链上发

36 篇讲过：2026 年 11 月 30 日起，Corn、Core、Metal、Zora、Abstract、Edge、Lisk、Lens、Merlin、Superseed 和 B2 Mainnet 这 11 条链不再支持 CCIP。动手之前先确认目标链还在支持列表里，别在要停用的链上搭新合约。

---

## 十二、还有一条更省事的路：OpenZeppelin 5.7 的跨链桥

写到这里，你可能想问：既然跨链 NFT 要自己写这么多代码，有没有现成的、审计过的件可以直接用？有，而且就是今年 7 月刚出来的。

OpenZeppelin Contracts 5.7（2026 年 7 月 30 日发布）加了两个专门干这件事的件：**`BridgeERC721`** 和 **`ERC721Crosschain`**。前者是一个独立的桥合约，帮你搬 ERC721；后者是直接嵌进 Token 合约里的扩展，Token 自己就能跨链。它们走的是 ERC-7786 跨链消息标准，不是直接调 CCIP。

|  | 手写 CCIP 合约（这篇） | OpenZeppelin 5.7 跨链桥 |
| --- | --- | --- |
| 是什么 | 自己写发送和接收逻辑，直接调 CCIP Router | 审计过的标准件，基于 ERC-7786 网关 |
| 要自己写多少 | 整份合约，从白名单到费用全自己管 | 接好网关、配好参数就能用 |
| 适合什么时候 | 学原理、做定制逻辑（比如跨链的时候顺便改属性） | 想快点上线、不想自己管桥的安全 |
| 风险 | 代码是你自己写的，没审计过 | 件本身审计过，但你的接法还是要自己负责 |

这两条路不是对立的。这篇教你手写，是为了把“烧、发消息、验身份、铸”这四个环节摸透——以后不管用谁的件，你都知道它背后在干什么。真要上生产，先看 OpenZeppelin 的现成件，再找审计。**别把这篇的学习合约直接部署到主网**，那不是它该去的地方。

还有一点要说清楚：OpenZeppelin 的跨链桥和 CCIP 不是同一个东西。CCIP 是 Chainlink 的跨链协议，ERC-7786 是另一套跨链消息标准，OpenZeppelin 的桥是搭在 ERC-7786 网关上的。两条路都能把 NFT 搬过河，走的不是同一座桥。

---

## 总结

- **一份合约，两边部署**：同一份 `CrosschainNFT` 部署到 Sepolia 和 Fuji，既会发消息、也会收消息；路线选 burn-and-mint，源链烧掉、目标链按同一个 tokenId 和同一份 metadata 重新铸。
- **三个核心函数**：`mint`（只在老家那条链上铸，避免 tokenId 撞车）、`crossChainTransferFrom`（先读 tokenURI 再烧、组消息、`getFee` 问价再发）、`_ccipReceive`（验源链、验发送方，再铸出来）。
- **CCIP 2.0 的写法**：装 `@chainlink/contracts-ccip@2.0.0`，继承 `CCIPReceiver`、只实现 `_ccipReceive`，extraArgs 用 `ExtraArgsCodec._getBasicEncodedExtraArgsV3` 生成 V3；老版 V1/V2 还能用，但新写的别再抄旧字节串。
- **部署顺序不能乱**：先部署两边、拿到两个合约地址，再两边各调一次 `enableChain` 互相登记，最后给源链合约充 LINK、再 mint、再发第一条消息。
- **本地先测**：Chainlink Local v0.3.1 不用 RPC、不用 LINK 就能把整条链路跑通；但它不模拟执行器，测试网上的等待时间还是要留出来。
- **还有现成的路**：OpenZeppelin 5.7 的 `BridgeERC721` / `ERC721Crosschain` 是审计过的标准件，学完这篇的原理、再去看现成的件，才知道它帮你省了什么。
- **最容易踩的坑**：合约里没 LINK、只配一边白名单、Gas 上限给太低、两边都能 mint 导致 tokenId 撞车、tokenURI 先烧后读、拿私钥写配置文件。

---

## 下一篇是第 38 篇：

[[y7blog-web3-39]]

这篇把合约写出来了，下一篇把整条链路跑完整：从源链上 Mint 开始，经过 CCIP，到目标链上收到 NFT，再把 NFT 搬回来——一次完整的往返。还会讲到 lock-and-mint 那条路线：原件锁在金库里、搬过去的是包装版，烧掉包装版才能把原件拿回来。

*参考资料：Chainlink 官方文档《CCIP v2.0.0 Client API Reference》（docs.chain.link/ccip/evm/api-reference/v2.0.0/client，2026-11-19 发布；Client.EVM2AnyMessage / Any2EVMMessage 结构、ExtraArgsCodec._getBasicEncodedExtraArgsV3(300_000, bytes4(0))、EVMExtraArgsV1 / GenericExtraArgsV2 编码）；Chainlink 官方文档《CCIP v2.0.0 CCIPReceiver API Reference》（docs.chain.link/ccip/evm/api-reference/v2.0.0/ccip-receiver，2026-11-19 发布；CCIPReceiver 基类、ccipReceive 只认 Router、_ccipReceive 待实现、实现 IAny2EVMMessageReceiverV2）；Chainlink 官方文档《CCIP v2.0.0 IAny2EVMMessageReceiverV2 API Reference》（docs.chain.link/ccip/evm/api-reference/v2.0.0/i-any2-evm-message-receiver-v2，2026-11-19 发布；getCCVsAndFinalityConfig、自定义 CCV 与终局配置）；Chainlink 官方文档《Faster-Than-Finality (FTF) - dApps》（docs.chain.link/ccip/concepts/execution-latency/ftf-dapps；CCIPReceiver 默认只接受完整终局消息、V1 接收方不能接 FTF）；Chainlink 官方文档《CCIP starter kit examples map》（docs.chain.link/chainlink-local/learn/starter-kit-examples，2026-11-19 发布；Foundry 与 Hardhat 3 套件、Example01–Example10、Chainlink Local v0.3.1、@chainlink/contracts-ccip 2.0.0、solc 0.8.26、Sepolia → Polygon Amoy 主通道）；Chainlink 官方文档《CCIP 2.0 behavior in Chainlink Local》（docs.chain.link/chainlink-local/learn/ccip-v2-local；CCIPLocalSimulator 同步送达、CCIPLocalSimulatorFork 分叉模式、本地模式不模拟执行器与手动执行）；Kaia 官方博客《Building Cross-Chain NFTs on Kaia with Chainlink CCIP》（docs.kaia.io/build/tutorials/cross-chain-nft/；CrosschainNFT 完整合约、burn-and-mint、Sepolia ↔ Kairos 测试网实测、Hardhat 3 + Ignition 部署、enableChain、extraArgs V1 编码 0x97a657c9…7A120 对应 Gas 上限 500,000、Sepolia Router 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59、LINK 0x779877A7B0D9E8603169DdbD7836e478b4624789、selector 16015286601757825753）；Jacek's Blog《Bridging NFTs Cross-Chain with Chainlink CCIP》（blog.varkiwi.com，2026-06-29；lock-and-mint 实测、NFTVault + WrappedNFT、Sepolia 到 OP Sepolia 往返、双向白名单）；QuickNode《How to Mint an NFT Across Different Blockchains using Chainlink CCIP》（quicknode.com；MyNFT + SourceMinter / DestinationMinter 三合约写法、Polygon Amoy 到 Avalanche Fuji；用的是 CCIP 1.5 时代的合约包，接口细节以 2.0 文档为准）；OpenZeppelin《Introducing OpenZeppelin Contracts 5.7》（openzeppelin.com，2026-07-30；BridgeERC721、BridgeERC1155、ERC721Crosschain、ERC1155Crosschain，基于 ERC-7786 的跨链桥）；Chainlink 官方文档《CCIP Directory》（docs.chain.link/ccip/directory/testnet，2026-11-19 更新；测试网 64 条链、Router 与 LINK 地址查询入口；Fuji LINK 地址 0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846 另见 27 篇核对）。*
