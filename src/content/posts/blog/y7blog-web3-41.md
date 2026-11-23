---
title: 40｜链上生成 NFT 图片是什么？On-chain NFT 入门
published: 2026-11-16
pinned: false
draft: false
comment: true
description: 你买的 NFT，图片到底存在哪？大多数 NFT 的图片并不在链上，只有一串指向图片的链接，链接一断，图片就没了。链上 NFT 把图片本身写进智能合约：用 SVG 文本加 base64 编码，让 tokenURI 直接返回一幅完整的画。这篇讲清楚 SVG、Metadata 和合约是怎么配合的，链上图片贵在哪、适合什么场景，以及买 NFT 之前最容易搞错的几件事。
image: https://www.y7img.ccwu.cc/file/1795334425022_y7blog-web3-41-1600.png
tags: [NFT,链上NFT,SVG,ERC721,智能合约]
category: Web3
slug: blog/y7blog-web3-41
series: "区块链百科"
seriesOrder: 1
---

你有没有想过，你钱包里那张 NFT 图片，到底存在哪？

点开一张 NFT，图片清清楚楚地显示在屏幕上。可这张图片是存在区块链上，还是存在某个你根本不知道的服务器上？如果存图片的那个网站倒闭了，你的 NFT 还剩什么？

这个问题不是假设。2026 年 1 月，NFT 交易平台 Nifty Gateway 宣布关停，进入只能提现的模式，同年 4 月正式关闭；老牌平台 Foundation 也在同年把所有权转给了另一家公司，交易市场下线。平台可以倒闭、可以转手，但链上的 Token 不会跟着消失——真正会跟着消失的，是那些只存在平台服务器上的图片和 metadata。

这篇就讲清楚：NFT 的图片到底存在哪，什么叫“链上生成图片”，以及它贵在哪、好在哪。

> 💡 **先说清楚**：这篇是知识科普，不是投资建议。链上存图片是一种技术选择，不是越链上就越值钱；一张 NFT 值不值钱，和图片存在哪没有必然关系。

---

## 一、NFT 的图片到底存在哪？

先把一个最常见的误会拆开：**你买到的 NFT Token，和你看到的那张图片，是两样东西。**

Token 本身住在链上：合约里记着 tokenId 属于哪个地址、谁能转它、它有没有被授权过。这些数据和区块链同生共死，只要这条链还在，它们就在。

但图片通常不住在链上。从钱包或交易市场点开一张 NFT，背后其实走了一条四步的链路：

```
智能合约 → tokenURI → Metadata JSON → image 字段 → 图片文件
  链上        链上        链下        链下        链下
```

- **tokenURI**：合约里的一个函数，输入 tokenId，返回一个地址（URL）。
- **Metadata JSON**：那个地址指向的一份 JSON 文件，里面写着名字、描述、属性，和一个 `image` 字段。
- **image 字段**：又是一个地址，指向真正的图片文件。

也就是说，大多数 NFT 在链上存的只是一个“指针”，图片本体在链下：可能是项目方的服务器，可能是 IPFS，也可能是 Arweave。指针本身没问题，问题是**指针指着的东西，合约管不着**。服务器关了、IPFS 没人固定（pin）了、网关挂了，图片就打不开，只剩一个打不开的 Token。

那有没有办法让图片也住进链上？有。这就是“链上 NFT”要解决的事。

| 存在哪 | 图片本体位置 | 链没了会怎样 | 谁保证图片还在 |
| --- | --- | --- | --- |
| 中心化服务器 | 项目方自己的服务器 | 图片可能跟着平台一起消失 | 项目方 |
| IPFS | 分布式节点网络 | 没人固定文件就可能找不到 | 固定文件的节点 |
| Arweave | Arweave 永久存储网络 | 一次付费、长期保存 | 存储激励机制 |
| 完全链上 | 智能合约本身 | 链在，图片就在 | 区块链本身 |

## 二、图片是怎么塞进合约的？SVG、Base64 和 data URI

链上空间贵得离谱，这是第一个要面对的现实。一张普通的 JPG 照片几百 KB，直接往合约里写，Gas 费能贵到没人付得起。所以链上 NFT 走了一条巧路：**不用位图，用 SVG**。

SVG 是什么？它不是一格一格的像素点，而是一段文字：用 `<circle>`、`<rect>`、`<path>` 这样的标签，描述“画一个圆、画一条线”。一张简单的 SVG 可能只有几百个字节，而且放大多少倍都不会糊。

既然 SVG 本质上是文字，就能用文字的方式把它塞进合约。做法分三步：

**第 1 步：把 SVG 转成 base64。** base64 是一种把任意内容变成纯 ASCII 文本的编码方式，浏览器和钱包都认。编码后体积会膨胀大约三分之一，这是要付的代价。

**第 2 步：拼成 metadata JSON。** 把编码后的 SVG 放进 JSON 的 `image` 字段，前面加上 `data:image/svg+xml;base64,` 这个前缀，告诉读取方“这不是一个网址，这就是图片本身”。

**第 3 步：再编码一次，塞进 tokenURI。** 把整份 JSON 再做一次 base64 编码，前面加上 `data:application/json;base64,`，让 `tokenURI` 直接返回这一长串字符。

整个过程像俄罗斯套娃，解开是反过来的：

```
tokenURI(1)
  → data:application/json;base64,eyJuYW1lIjoi...
      ↓ 解码
  → {"name": "链上小画 #1", "image": "data:image/svg+xml;base64,PHN2Zy..."}
      ↓ 解码 image 字段
  → <svg>...</svg>  ← 这就是画本身
```

钱包和交易市场拿到 `tokenURI` 的返回值，解码、再解码，就能直接把画渲染出来。**全程没有发一次 HTTP 请求，没有访问任何服务器。** 只要链还在，这幅画就在。

## 三、为什么偏偏是 SVG？

不是所有图片格式都能上链。选 SVG 有三个很实际的原因：

**第一，它是文本。** 合约最擅长处理的就是文本和数字。SVG 可以直接写进合约代码里，或者由合约现拼现算，PNG、JPG 这种二进制格式做不到这一点。

**第二，它很小。** 一张有几百个形状的 SVG 可能只有几 KB，而同样画面的 PNG 动不动几百 KB。在链上，每多一个字节都要多付钱，体积就是成本。

**第三，它能放大。** SVG 是矢量图，描述的是形状而不是像素，放大十倍边缘还是干净的。这对要长期保存、要在各种屏幕上展示的 NFT 来说很重要。

反过来说，SVG 也有它的天花板：它只擅长画几何形状、色块、线条构成的图。照片、复杂插画、手绘质感浓的作品，用 SVG 画出来要么体积爆炸，要么根本画不像。所以链上 NFT 天生适合**生成艺术**：用代码和规则画出来的画，而不是照片。

| 格式 | 本质 | 链上友好度 | 适合画什么 |
| --- | --- | --- | --- |
| SVG | 文本，描述形状 | 高，几 KB 就能画一幅 | 几何、像素风、生成艺术 |
| PNG / JPG | 二进制像素点 | 低，体积大、存不起 | 照片、复杂插画 |
| HTML | 文本，可内嵌 JS | 中，可做交互式 NFT | 交互作品、动态页面 |

## 四、动手写一份链上 SVG NFT 合约

理论讲完了，来看一份能跑的最小实现。思路和前面讲的三步完全一致：合约里拼 SVG，编码两次，从 `tokenURI` 返回。

```
 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.24;
 import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
 import "@openzeppelin/contracts/utils/Base64.sol";

 contract OnChainNFT is ERC721 {
     uint256 private _tokenIdCounter;

     constructor() ERC721("链上小画", "ONCHAIN") {}

     function mint() public {
         _safeMint(msg.sender, _tokenIdCounter);
         _tokenIdCounter++;
     }

     // 按 tokenId 现拼一幅 SVG：背景色和圆圈位置都由 tokenId 决定
     function generateSVG(uint256 tokenId) public pure returns (string memory) {
         string memory svg = string(abi.encodePacked(
             '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">',
             '<rect width="400" height="400" fill="#',
             tokenId % 2 == 0 ? "7c6ff0" : "f0a56f",
             '"/>',
             '<circle cx="200" cy="200" r="',
             Strings.toString(60 + tokenId * 10),
             '" fill="#ffffff"/>',
             '</svg>'
         ));
         return svg;
     }

     function tokenURI(uint256 tokenId) public view override returns (string memory) {
         _requireOwned(tokenId);
         string memory svgBase64 = Base64.encode(bytes(generateSVG(tokenId)));
         string memory json = string(abi.encodePacked(
             '{"name": "链上小画 #',
             Strings.toString(tokenId),
             '", "description": "一幅完全住在链上的画",',
             '"image": "data:image/svg+xml;base64,',
             svgBase64,
             '"}'
         ));
         return string(abi.encodePacked(
             "data:application/json;base64,",
             Base64.encode(bytes(json))
         ));
     }
 }
```

注意几个关键点：

- **画不是存进去的，是算出来的。** 合约里没有存任何一张现成的图，`generateSVG` 每次被调用时才按 `tokenId` 现拼一幅。这种做法省存储空间，代价是每次读 `tokenURI` 都要多算一点。
- **也可以反过来：部署时存好，读取时直接拼。** 把编码好的 SVG 字符串存在合约的 storage 里，`tokenURI` 只做拼接。部署贵一点，读取便宜一点。两种做法各有利弊，选哪个看你的画变不变、读得多不多。
- **Base64.sol 是 OpenZeppelin 提供的工具库**，不用自己写编码逻辑，直接 import 就能用。
- **metadata 的 `name`、`description`、`image` 三个字段缺一不可**，钱包和市场就靠这三个字段认一张 NFT。

如果你想玩得更高级，可以不按 tokenId 直接拼图，而是只存一个**种子（seed）**，每次调用时用种子算出一整套随机参数，再生成一幅独一无二的画。Nouns 就是这么做的：每天拍卖一只链上生成的像素头像，画的每一个部件都由合约代码当场算出来。

## 五、链上、IPFS、中心化服务器，怎么选？

没有一种存储方式是全方位赢的。选哪个，取决于你最在乎什么：

|  | 完全链上 | IPFS | Arweave | 中心化服务器 |
| --- | --- | --- | --- | --- |
| 永久性 | 最高，链在画就在 | 中，没人固定会丢 | 高，一次付费长期保存 | 最低，平台倒了就没了 |
| 成本 | 最高，主网存 1KB JSON 高峰期可能要几十到上百美元（第三方估算） | 低，只付固定服务费 | 中，一次性付费 | 最低 |
| 能放多大 | 很小，几 KB 到几十 KB | 大，照片视频都行 | 大 | 大 |
| 适合什么 | 生成艺术、高价值藏品 | 大多数 NFT 项目 | 想长期保存的大文件 | 演示、测试、临时内容 |
| 典型项目 | Nouns、Loot、Art Blocks、Autoglyphs | 绝大多数 NFT | 部分长期存档项目 | 早期小项目 |

现实中大多数项目走的是**混合路线**：Token 记录和一个带内容哈希的链接放在链上，真正的图片文件放在 IPFS 或 Arweave 上。这样既有区块链的验证能力，又不用为每一张图付天价 Gas 费。

判断一张 NFT 是不是“完全链上”，有个很简单的方法：去区块浏览器上调它的 `tokenURI`，看返回的东西是不是以 `data:` 开头。如果是 `https://` 或 `ipfs://`，那图片就不在链上；如果以 `data:application/json;base64,` 开头，恭喜，这张 NFT 的画和介绍都住在合约里。

## 六、真实世界里的链上 NFT

链上 NFT 不是纸上谈兵，已经有几个跑了很多年的真实例子：

**Autoglyphs（2019 年）**：Larva Labs 的作品，被认为是第一个完全链上的生成艺术项目。每一幅画都由合约代码生成，连图片带 metadata 全在链上，没有用到任何外部存储。

**CryptoPunks（2017 年）**：最出名的 NFT 项目之一。它的图片数据后来也被写进了链上——Larva Labs 为此花了约 7300 万 Gas，按当时的价格算大约 2 万美元。这笔钱在今天看不算大，但它说明了一件事：哪怕是 24×24 像素的小头像，上链也不是免费的。

**Nouns（2021 年至今）**：每天拍卖一只 NFT，头像的每个部件——背景、身体、头、配饰——都是链上 SVG，由合约按种子现拼。Nouns 的合约和美术资源全部在链上，任何人只要有一个以太坊客户端就能把画完整地还原出来。

**Loot、Art Blocks**：同样把生成逻辑放在链上，图片不是“存”进去的，而是每次被问到时“算”出来的。这也是为什么这类项目常被叫做“生成艺术”而不是“图片 NFT”。

这些项目的共同点是：**画都很简单**。像素风、几何图形、色块组合——SVG 画得出来的东西。没有哪个链上项目会去挑战存一张照片，因为账算下来根本不划算。

## 七、经常踩的坑

**1. 以为买了 NFT，就买了图片本身。**

没有。默认情况下你买到的只是一个 Token，和一份指向图片的链接。图片的版权、使用权归谁，要看项目的授权条款，和图片存在哪没有关系。链上 NFT 只是保证图片不会丢，不保证你拥有它。

**2. 以为 tokenURI 返回 data:，就万事大吉了。**

还要看合约能不能改。如果合约留了 `setBaseURI` 这样的函数，或者是个可升级合约，项目方之后仍然可以把 `tokenURI` 改成别的。真正的“完全链上”还要加上一条：合约本身不能再改。查项目的时候，`tokenURI` 和“合约能不能升级”要一起看。

**3. 只算了 Mint 的 Gas，没算部署和存储的 Gas。**

把 SVG 存进合约要花钱，部署一个带大段 SVG 的合约更要花钱。按第三方估算，在以太坊主网存 1KB 的 JSON，高峰期可能要 50 到 200 美元，1MB 的量级要上万美元起步。预算要按“部署 + 存储 + Mint”三笔一起算，测试网先跑一遍再上主网。

**4. 合约大小撞上 24KB 上限。**

以太坊有个 EIP-170 的规定：单个合约的字节码不能超过 24KB。SVG 写得太大，合约编译出来超了这个上限，根本部署不上去。解决办法是把 SVG 拆成多个小合约存放，或者改用“种子 + 现算”的生成方式，让合约里只留规则，不留整幅画。

**5. 钱包或市场显示不出来。**

不是所有钱包和市场都支持 `data:` 开头的 tokenURI。有些老版本会直接显示空白，或者干脆不认这张 NFT。上线之前，先在目标钱包和市场上实际看一眼，别等用户来报 bug 才发现。

**6. 把 IPFS 当成“永久存储”。**

IPFS 的内容寻址确实能保证“找到的文件就是原来的文件”，但它不保证“文件一直能找到”。没有节点固定（pin）这份文件，它迟早会从网络里消失。IPFS 需要有人持续付费固定，Arweave 是一次付费、协议层保证长期保存，两者不是一回事。

**7. 在主网直接试，错一次就是真金白银。**

链上 NFT 的调试成本比普通 NFT 高得多，因为每一次写操作都要花 Gas。先在 Sepolia 测试网把 `tokenURI` 返回的字符串完整解码一遍，确认解出来是合法的 JSON、图片字段能正常渲染，再考虑上主网。

## 八、什么时候该用链上，什么时候不该

一张简单的判断清单，动手之前对着过一遍：

- **画是代码能生成的吗？** 是 → 适合链上；不是（照片、复杂插画）→ 别硬上。
- **这张 NFT 打算保存多久？** 几十年、上百年 → 链上值得；只是个活动纪念 → IPFS 就够了。
- **预算够吗？** 主网部署加存储的 Gas 费先估一遍，接受不了 → 考虑 L2，或者 IPFS + 链上哈希的混合方案。
- **画会变吗？** 会变（比如动态 NFT）→ 用“种子 + 现算”的方式，别把整幅画写死。
- **受众用什么钱包？** 先确认目标钱包和市场支持 `data:` 的 tokenURI，不支持 → 先解决显示问题。

说到底，链上存图片不是为了炫技，而是为了解决一个很具体的问题：**当所有平台都可能倒闭的时候，这幅画还能不能活下来。** 如果你的答案是“必须活下来”，那就值得为它付 Gas 费；如果答案是“没那么重要”，IPFS 加固定服务已经足够好。

---

## 总结

- 大多数 NFT 在链上存的只是一个指针：合约 → tokenURI → Metadata JSON → image 字段 → 图片文件，图片本体在链下。
- 链上 NFT 把图片本身写进合约：SVG 是文本，可以 base64 编码后嵌进 metadata JSON，再整体编码成 `data:` URI，由 `tokenURI` 直接返回，全程不需要访问任何服务器。
- SVG 之所以是链上图片的首选，是因为它体积小、是文本、放大不糊；代价是只适合几何、像素风这类生成艺术，画不了照片和复杂插画。
- 真实项目已经跑了很多年：Autoglyphs、CryptoPunks、Nouns、Art Blocks 都是链上生成艺术的代表，画的共同点是都很简单。
- 链上不是免费的：主网存 1KB JSON 高峰期可能要几十到上百美元（第三方估算），合约还有 24KB 的大小上限，超了就部署不上去。
- 买 NFT 之前先查两件事：`tokenURI` 是不是 `data:` 开头，以及合约能不能被改。两件事都确认了，才是真正的完全链上。
- 大多数项目更适合混合路线：关键记录和内容哈希放链上，图片文件放 IPFS 或 Arweave，成本和永久性之间取个平衡。

---

## 下一篇是第 41 篇：

[[y7blog-web3-42]]

链上能把一幅画算出来，那能不能算出一个随机数？答案是：不能直接算，至少不能安全地算。区块链要求全网节点算出完全相同的结果，这和“随机”天生就是冲突的。下一篇讲清楚这个冲突到底在哪，以及那些看起来随机的办法为什么会被人钻空子。

---

*参考资料：Flow 官方博客《On-Chain SVG NFTs on Flow》（https://flow.com/post/on-chain-svg-nfts-on-flow）；Kinda Technical《On-Chain vs Off-Chain Metadata and Storage》（2026 年 3 月更新，https://kindatechnical.com/blockchain/on-chain-vs-off-chain-metadata-and-storage.html）；Ernesto Cisneros《Where Your Art Really Lives》（https://ernestocisneros.art/guide-where-your-art-lives-en.html）；Mr Hoelee《Fully On-Chain SVG NFTs: Putting the Artwork Inside the Contract》（https://blog.hoelee.com/posts/fully-on-chain-svg-nfts/）；QuickNode《Onchain vs Offchain Data Explained》（https://www.quicknode.com/answers/on-chain-vs-off-chain）；ChainScoreLabs《L1 vs L2 NFT Metadata Storage: Cost & Scalability Comparison》（https://chainscorelabs.com/comparisons/nft-marketplaces-open-vs-curated/metadata-storage-solutions/storing-metadata-on-l1-vs-l2-solutions-cost-and-scalability）；Blockonomi《NFT Marketplace Collapse: Nifty Gateway, Foundation Lead Wave of Major Platform Shutdowns》（https://blockonomi.com/nft-marketplace-collapse-nifty-gateway-foundation-lead-wave-of-major-platform-shutdowns/）；NFT Culture《NFT Platform Shutdown: What Happens to NFTs》（2026 年 11 月 9 日核对，https://www.nftculture.com/digital-ownership/nft-platform-shutdown/）；OpenZeppelin Contracts 文档 Base64 工具库；EIP-170 合约大小限制。*
