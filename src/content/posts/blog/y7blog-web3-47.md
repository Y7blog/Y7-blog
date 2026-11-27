---
title: 46｜智能合约如何调用 API？CRE 实战
published: 2026-11-22
pinned: false
draft: false
comment: true
description: 这篇直接动手：跟着官方的“链上计算器”教程，用 TypeScript 写一个完整的工作流——每 30 秒触发一次，从公开 API 取一个随机数，再读 Sepolia 上一个合约里的数，加起来写回另一份合约。从调 API、读链、写链到本地模拟和部署，一步步跑通。
image: https://www.y7img.ccwu.cc/file/1795593914541_y7blog-web3-47-1600.png
tags: [Chainlink, CRE, 智能合约, API, Web3]
category: Web3
slug: blog/y7blog-web3-47
series: "区块链百科"
seriesOrder: 1
---

想象一下，你想做一个最简单的链下计算器：每隔 30 秒，去网上随机取一个数，再读一下链上合约里存着的另一个数，把两个数加起来，写回链上。

这件事看起来很小，但它把智能合约调用 API 的完整链路都走了一遍：定时触发、调外部 API、读链上数据、算一算、把结果可信地写回链上。能把这个小例子跑通，CRE 的实战就入门了——50 篇的天气案例、51 篇的新闻应用，都是在这个骨架上换数据、换逻辑。

这篇就跟着 Chainlink 官方的入门教程，一步步把这个“链上计算器”跑起来。

> 💡 **先说清楚**：这篇是知识科普，不是投资建议。CRE 正式上线才一年，工具链和文档还在演进，本文按 2026 年 11 月 25 日核对的官方文档写；如果你照着动手，遇到和本文不一致的地方，以官方文档为准，先在测试网练手。文里用到的合约地址都是官方教程预先部署在 Sepolia 上的，不用你自己部署。

---

## 一、今天要跑通什么：链上计算器全景

先把整条链路看清楚，再动手。官方入门教程做的“链上计算器”工作流，每次执行就做四件事：

```
Cron 触发器响了（每 30 秒一次）
        ↓
调一个公开 API，取一个 1 到 100 的随机数
        ↓
读 Sepolia 上一个 Storage 合约里存着的数
        ↓
两个数加起来，生成一份 DON 签名的报告
        ↓
把报告写回 CalculatorConsumer 合约，链上能查到结果
```

这四步正好对应 CRE 的四个核心能力：**Cron 触发、HTTP 调 API、EVM 读、EVM 写**。跑通这一个例子，等于把 CRE 最常用的能力都摸了一遍。

这里有两点要先建立感觉：

- **工作流的代码不在合约里。** 逻辑写在一个独立的 TypeScript 工程里，编译成 WASM，部署到 Chainlink 的 DON 网络上跑。合约只负责接收结果，不负责发请求。
- **调 API 和读链是两拨节点在干活。** HTTP 能力由专门的 Capability DON 执行，EVM 读写由另一拨节点执行，每一步都有多个节点各自独立做、再用共识对出一个结果。你的代码只要按 SDK 的写法调用，不用直接跟这些网络打交道。

## 二、准备工作：账号、CLI 和一点 Sepolia ETH

动手之前，先把三样东西准备好：

### 1. Chainlink 平台账号

到 Chainlink 平台（app.chain.link/cre/discover）创建一个账号。这是所有 CLI 命令的前提。注册本身不花钱。

### 2. 装 cre CLI 和 Bun

装 `cre` 命令行工具。TypeScript 路线还需要 Bun 1.4 或更高版本（用 `bun --version` 检查；Bun 1.3.x 会在装依赖时报错）。版本号变得很快，装的时候以官方安装页为准——OpenZeppelin 的实测教程用的是 CRE CLI 1.34.0、`@chainlink/cre-sdk` 1.19.1、Bun 1.4.0。

装好之后先登录并确认身份：

```
cre login
cre whoami
```

`cre whoami` 还会显示你的部署权限状态，部署那一步会用到，先看一眼心里有数。

### 3. 一个有 Sepolia ETH 的钱包

模拟阶段如果工作流不写链，只读数据、调 API，填一个占位私钥就能跑。但这个例子最后要把结果写回 Sepolia，模拟写链需要一个有 Sepolia ETH 的账号付 Gas。去 faucets.chain.link 领一点测试币就行，这是测试网的币，不值钱。

| 准备项 | 用来干什么 | 没有会怎样 |
|---|---|---|
| Chainlink 平台账号 | 登录 CLI、管理组织 | CLI 命令跑不起来 |
| cre CLI + Bun 1.4+ | 初始化项目、本地模拟、部署 | 写不了、跑不了工作流 |
| 有 Sepolia ETH 的账号 | 模拟和部署时付写链的 Gas | 只能模拟读数据，写链那步跑不通 |

## 三、工作流长什么样：一个工程，四份文件

跑 `cre init`，按向导选好项目名、语言（TypeScript）、模板（Helloworld）和第一个工作流的名字，就会生成一个标准工程。核心文件只有四份：

| 文件 | 管什么 |
|---|---|
| `main.ts` | 工作流代码：注册触发器、写回调逻辑、调用各个能力 |
| `config.json` | 非机密的运行配置：API 地址、合约地址、链名、Gas 上限 |
| `secrets.yaml` | 机密声明：哪些值是密钥，本地用 `.env` 提供，生产上走 Vault DON |
| `workflow.yaml` | 工作流元数据：名字、归属、密钥路径、目标环境、部署用哪个 registry |

这个例子里，`config.json` 长这样（地址是官方教程预先部署在 Sepolia 上的，直接抄就行）：

```
{
  "schedule": "*/30 * * * * *",
  "apiUrl": "https://api.mathjs.org/v4/?expr=randomInt(1,101)",
  "evms": [
    {
      "storageAddress": "0xa17CF997C28FF154eDBae1422e6a50BeF23927F4",
      "calculatorConsumerAddress": "0x95e10BaC2B89aB4D8508ccEC3f08494FcB3D23cb",
      "chainName": "ethereum-testnet-sepolia",
      "gasLimit": "500000"
    }
  ]
}
```

注意 `schedule` 是 6 段的 Cron 表达式，`*/30 * * * * *` 的意思是每 30 秒触发一次——这也是 Cron 触发器最短的间隔，再短就不行了。`apiUrl` 用的是 math.js 的公开接口，`randomInt(1,101)` 返回一个 1 到 100 的随机整数，不用密钥，适合练手。

`main.ts` 的骨架也很好认：一个 `initWorkflow` 注册处理器，一个 `onCronTrigger` 回调做正事：

```
const initWorkflow = (config: Config) => {
  const cron = new CronCapability()

  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}
```

`handler(触发器, 回调)` 就是 45 篇讲过的“处理器”：把“什么时候跑”和“跑起来干什么”连在一起。一个工作流可以有多个处理器，这里先用一个。

下面四节，把 `onCronTrigger` 里的四步逐个拆开讲。

## 四、第一步：调 API 拿一个随机数

调 API 用的是 HTTP 能力。写法上有两个地方和平时写 TypeScript 不一样，新手最容易在这里卡住：

**第一，调 API 的代码要包在 `runInNodeMode` 里跑。**

HTTP 请求是让 DON 里的多个节点各自独立去调一次 API，再把结果拿出来对账——这一步发生在“节点模式”下。所以取数的函数要单独写成一个函数，再用 `runInNodeMode` 包起来，并指定用“中位数共识”来聚合各节点的结果：

```
const fetchMathResult = (nodeRuntime: NodeRuntime<Config>): bigint => {
  const httpClient = new HTTPClient()

  const req = {
    url: nodeRuntime.config.apiUrl,
    method: "GET" as const,
  }

  const resp = httpClient.sendRequest(nodeRuntime, req).result()
  const bodyText = new TextDecoder().decode(resp.body)
  const val = BigInt(bodyText.trim())

  return val
}
```

然后在回调里这样调用它：

```
const offchainPromise = runtime.runInNodeMode(fetchMathResult, consensusMedianAggregation())()
```

`consensusMedianAggregation()` 的意思是：多个节点各自调 API 拿到的数，取中位数作为最终结果。某个节点调失败了、或者返回了一个离谱的值，中位数能把它顶掉。这就是“去中心化调 API”和“自己写个脚本调 API”的根本区别：结果不是某台服务器说了算，是网络共识出来的。

**第二，SDK 里的异步调用是两步走的，不是 async/await。**

所有能力调用都是“先发起、再拿结果”：

```
const request = httpClient.sendRequest(runtime, { url: ... })
const response = request.result()
```

直接写 `await` 是行不通的——工作流编译成 WASM 后跑在 QuickJS 环境里，不是完整的 Node.js。记住这个两步模式，后面读链、写链全是同一个套路。

还有一个小细节：**日志只能用 `runtime.log()`，`console.log` 在 WASM 环境里不输出。** 调试的时候没日志会很抓狂，这一行要记牢：

```
runtime.log(`Successfully fetched offchain value: ${offchainValue}`)
```

## 五、第二步：读 Sepolia 上合约里的数

读链用的是 EVM 客户端。先要把配置里的人类可读链名（`ethereum-testnet-sepolia`）转成链选择器，再 new 一个客户端：

```
const network = getNetwork({
  chainFamily: "evm",
  chainSelectorName: evmConfig.chainName,
})
const evmClient = new EVMClient(network.chainSelector.selector)
```

然后构造一次合约调用。官方教程里读的是一个极简的 Storage 合约的 `get()` 方法，用 viem 的 `encodeFunctionData` 把调用编码出来，再用 `encodeCallMsg` 包一层：

```
const callData = encodeFunctionData({
  abi: Storage,
  functionName: "get",
})

const contractCallPromise = evmClient.callContract(runtime, {
  call: encodeCallMsg({
    from: zeroAddress,
    to: evmConfig.storageAddress as `0x${string}`,
    data: callData,
  }),
  blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
})
```

`blockNumber: LAST_FINALIZED_BLOCK_NUMBER` 是个值得注意的细节：读的是**最新已确认 finalized 的区块**，而不是最新挖出来的区块。读 finalized 的区块，结果才稳定，不会因为链重组变来变去。

拿到结果后，用 viem 的 `decodeFunctionResult` 解码：

```
const contractCall = contractCallPromise.result()

const onchainValue = decodeFunctionResult({
  abi: Storage,
  functionName: "get",
  data: bytesToHex(contractCall.data),
}) as bigint
```

到这里，链下随机数和链上存的数都有了。回调里把它们加起来，就是这次执行的计算结果：

```
const finalResultValue = onchainValue + offchainValue
```

还有一个效率上的细节：调 API 和读链这两步互相不依赖，官方代码是让它们**同时发起**、再按固定顺序收结果的。两步串行跑要等两份时间，并行跑只要等最慢的那一份。写复杂工作流的时候，这个习惯能省不少执行时间。

## 六、第三步：把结果写回链上

写链分两步走，这是 CRE 里最核心的一个模式，理解了它，就理解了 CRE 怎么保证“结果可信”：

```
生成一份 DON 签名的报告 → 把报告提交给消费端合约
```

### 先生成签名报告

```
const reportResponse = runtime
  .report({
    encodedPayload: hexToBase64(reportData),
    encoderName: "evm",
    signingAlgo: "ecdsa",
    hashingAlgo: "keccak256",
  })
  .result()
```

`reportData` 是先用 viem 的 `encodeAbiParameters` 按合约 ABI 编码好的结果——这个例子里是三个数：链下随机数、链上读到的数、加起来的最终结果，类型分别是 `uint256`、`int256`、`uint256`。编码方式必须和消费端合约里定义的结构体完全一致，对不上号，合约解码会失败。

`runtime.report()` 做的事情是：让 DON 网络对这份数据做共识、签名，生成一份报告。这份报告就是“网络共同认可的结果”的凭证。

### 再把报告提交给消费端合约

```
const writeReportResult = evmClient
  .writeReport(runtime, {
    receiver: evmConfig.calculatorConsumerAddress,
    report: reportResponse,
    gasConfig: {
      gasLimit: evmConfig.gasLimit,
    },
  })
  .result()
```

`writeReport` 会把签名报告发给消费端合约，返回交易哈希。去 Sepolia Etherscan 上查这个哈希，就能看到结果确实写进链了。

### 消费端合约长什么样

官方教程预先部署的 `CalculatorConsumer` 合约继承了 `ReceiverTemplate` 模板，核心就一个方法：收到报告后，把里面的三个数解码、存起来、发一个事件：

```
contract CalculatorConsumer is ReceiverTemplate {
  struct CalculatorResult {
    uint256 offchainValue;
    int256 onchainValue;
    uint256 finalResult;
  }

  CalculatorResult public latestResult;
  uint256 public resultCount;
  mapping(uint256 => CalculatorResult) public results;

  event ResultUpdated(uint256 indexed resultId, uint256 finalResult);

  function _processReport(
    bytes calldata report
  ) internal override {
    CalculatorResult memory calculatorResult = abi.decode(report, (CalculatorResult));

    resultCount++;
    results[resultCount] = calculatorResult;
    latestResult = calculatorResult;

    emit ResultUpdated(resultCount, calculatorResult.finalResult);
  }
}
```

注意两点：

- **合约不验证 API 的数据本身。** 它验证的是报告的签名：`ReceiverTemplate` 会检查调用者是不是 Chainlink 的 Forwarder、报告是不是 DON 签过名的。签名对了，才接受；签名不对，直接拒绝。信任的根在 DON 共识，不在某一次 API 返回。
- **部署时要传 Forwarder 地址。** 构造函数要求一个 `_forwarderAddress`，这是安全的第一层：只有 Forwarder 能调 `onReport`。自己部署消费端合约的时候，这个地址要从官方文档里找对应链的，不能随便填一个。

和 Functions 时代的消费端对比一下，变化很直观：

|  | Functions（已退役） | CRE |
|---|---|---|
| 合约怎么收到结果 | DON 调 `fulfillRequest()` 回调 | Forwarder 调 `onReport()`，再进 `_processReport()` |
| 合约要继承什么 | `FunctionsClient` | `ReceiverTemplate`（实现 `IReceiver`） |
| 结果可不可信 | DON 签名后回调 | DON 签名报告，合约验签后才接受 |
| 谁先发起 | 合约调 `sendRequest()` 主动发请求 | 工作流被触发后执行，最后把结果写回来 |

## 七、本地模拟：不用审批就能跑通

CRE 的上手路径有个很友好的设计：**模拟不需要审批，部署才需要**。装好 CLI 就能直接在自己电脑上把工作流跑起来：

```
cre workflow simulate my-calculator-workflow --target staging-settings
```

模拟会把工作流编译成 WASM，在你自己的机器上跑，但**调的是真实的 API、读的是真实的公链**。本地跑通了，部署到 DON 上大概率也能跑通——这是模拟最有价值的地方。

模拟和部署的区别要记牢：

|  | 本地模拟 | 部署到 DON |
|---|---|---|
| 要不要审批 | 不需要，装好就能跑 | 需要，先跑 `cre account access` 申请部署权限 |
| 在哪跑 | 你自己的机器 | Chainlink 的 DON 网络 |
| 调真实 API 吗 | 调，真实的 | 调，真实的 |
| 写链真的上链吗 | 默认不广播，加 `--broadcast` 才会真的发交易 | 真的写链 |

最后那行最容易踩坑：模拟里写链的操作，**默认只模拟、不广播**。想让模拟真的把交易发到 Sepolia 上，要加 `--broadcast`：

```
cre workflow simulate --target staging-settings --config config.staging.json main.ts --broadcast
```

不加这个 flag，模拟跑完你去链上查不到交易，还以为写链失败了——其实是根本没发出去。这也是官方 SDK 文档里专门提醒的一点。

模拟时看日志有两个地方：本地模拟的日志直接打在终端里；部署之后的工作流，去 CRE 界面里选工作流 → Execution → Logs 看。

## 八、部署到 DON：两个 registry 怎么选

本地跑通之后，就可以部署了。CRE 有两个部署目标，选哪个取决于你要什么：

|  | Private Registry（私有） | Onchain Registry（链上） |
|---|---|---|
| 是什么 | Chainlink 托管的链下注册表 | 以太坊主网上的 Workflow Registry 合约 |
| 部署要不要钱包和 Gas | 不需要，凭 CRE 登录会话授权 | 需要，注册交易要付主网 ETH Gas |
| 部署权限 | 需要组织里有 CRE Developer 或 Admin 角色，CLI v1.15.0+ | 需要先跑 `cre account access` 申请部署权限 |
| 适合谁 | 快速测试、练手 | 正式的生产部署 |

部署命令本身是一样的，只是指向不同的目标环境：

```
cre workflow deploy my-workflow --target staging-settings
```

这条命令会一口气做三件事：把工作流编译成 WASM、把编译产物和配置文件上传到 CRE 存储服务、再注册到你选的 registry 里。注册到私有 registry 是立即生效的，没有交易哈希；注册到链上 registry 会返回一笔主网交易，钱包里要有 ETH 付 Gas，`project.yaml` 里还要配好 `ethereum-mainnet` 的 RPC。

部署之前，先确认两件事：

```
cre whoami
cre registry list
```

前者看部署权限是不是 `Enabled`，后者看组织里有没有可用的私有 registry（`Type: off-chain` 的那一行）。权限没批下来之前，`deploy` 是跑不通的——这是设计，不是故障，排计划的时候要给审批留出时间，官方没有承诺审批要多久。

部署之后，工作流的管理（激活、暂停、更新、删除）也都走 CLI，在 CRE 界面里能看到每次执行的日志和指标。

## 九、经常踩的坑

**拿平时写 TypeScript 的习惯写工作流。**

`async/await` 在能力调用上行不通，要用“先发起、再 `.result()`”的两步模式；`console.log` 在 WASM 里不输出，要用 `runtime.log()`。这两个是官方文档和 SDK 说明里反复强调的，照着 Node.js 的习惯写，编译能过、跑起来没反应，查起来很费时间。

**模拟写链没加 `--broadcast`，以为写链失败了。**

模拟默认不广播交易。本地跑完去链上查不到结果，先检查是不是忘了加这个 flag。

**模拟写链用的账号里没有 Sepolia ETH。**

只读数据、只调 API 的模拟不需要真钱，写链的模拟要付 Gas。去 faucets.chain.link 领一点再跑，别在报错里绕圈子。

**Cron 表达式写成 5 段。**

CRE 的 Cron 是 6 段（秒、分、时、日、月、周），最短 30 秒。按 Linux crontab 的 5 段写法写，触发器配不对，工作流不会按你想的时间跑。

**报告编码和合约结构体对不上。**

`encodeAbiParameters` 里的类型顺序、类型本身，必须和消费端合约的 struct 一字不差。差一个类型，合约解码失败，整次执行白跑。改合约结构体的时候，工作流那边的编码也要同步改。

**以为装好 CLI 就能部署。**

模拟不用审批，部署要。`cre account access` 是专门申请部署权限的命令，批下来之前，`deploy` 跑不通。私有 registry 还要组织里有对应角色。部署这一步要提前规划，别等到要上线当天才发现权限没批。

**照着 Functions 的老教程写消费端合约。**

Functions 的消费端是 `fulfillRequest()`，CRE 的是实现 `IReceiver`、继承 `ReceiverTemplate`、重写 `_processReport()`。两个接口长得完全不一样，老代码复制过来编译都过不了。网上 2025 年甚至 2026 年上半年的 Functions 教程，照着写很可能跑不通——不是你的问题，是教程过时了。

---

## 总结

- 今天跑通的是官方“链上计算器”工作流：Cron 每 30 秒触发一次，调 math.js 的公开 API 取一个 1–100 的随机数，读 Sepolia 上 Storage 合约里的数，加起来写回 CalculatorConsumer 合约。
- 工作流是独立的 TypeScript 工程（`main.ts` + `config.json` + `secrets.yaml` + `workflow.yaml`），编译成 WASM 后由 DON 网络执行；合约只负责接收结果。
- 调 API 用 HTTP 能力，取数函数要包在 `runInNodeMode` 里跑，并用 `consensusMedianAggregation()` 对多个节点的结果取中位数共识。
- SDK 的异步调用是两步走：先发起、再 `.result()`，不用 async/await；日志只能用 `runtime.log()`，`console.log` 在 WASM 里不输出。
- 写链分两步：`runtime.report()` 生成 DON 签名的报告，再用 `evmClient.writeReport()` 提交给实现 `IReceiver` 的消费端合约；合约验签通过后才接受结果。
- 模拟不需要审批，本地就能跑真实 API 和真实公链；模拟写链默认不广播，要加 `--broadcast` 才会真的发交易，账号里要有 Sepolia ETH 付 Gas。
- 部署有两个 registry：私有 registry 不用钱包和 Gas、凭登录会话授权，适合练手；链上 registry 要在以太坊主网注册、付 Gas，适合生产；两种都要先确认部署权限批下来了。
- 容易踩的坑：Cron 是 6 段表达式、报告编码要和合约结构体一字不差、别照 Functions 老教程写消费端合约。

---

## 下一篇是第 47 篇：

[[blog/y7blog-web3-48]]

实战跑通了，下一篇回过头把开发工具讲透：CRE 的开发工具怎么用？写出第一个工作流。下一篇会讲 `cre init` 的各个模板怎么选、`workflow.yaml` 里的目标环境怎么配、模拟和部署的完整命令，以及怎么在 CRE 界面里看日志、查执行记录——把这篇跑通例子时用过的工具，一个个讲清楚。

---

*参考资料：Chainlink CRE 入门教程总览（链上计算器：Cron 触发、HTTP 取数、EVM 读、EVM 写，2026-11-25 核对，https://docs.chain.link/cre/getting-started/overview）；Chainlink CRE 入门第四部分：写回链上（CalculatorConsumer 合约、ReceiverTemplate、runtime.report()、evmClient.writeReport()、Sepolia 合约地址，2026-11-25 核对，https://docs.chain.link/cre/getting-started/part-4-writing-onchain-ts）；Chainlink CRE 入门第二部分：取链下数据（HTTP 能力、runInNodeMode、consensusMedianAggregation，2026-11-25 核对，https://docs.chain.link/cre/getting-started/part-2-fetching-data）；Chainlink CRE TypeScript SDK 核心参考（handler、Runtime、两步异步模式、runtime.log()，https://docs.chain.link/cre/reference/sdk/core-ts）；Chainlink CRE 部署到私有 Registry（权限、cre registry list、无钱包无 Gas，https://docs.chain.link/cre/guides/operations/deploying-to-private-registry-ts）；Chainlink CRE 部署到链上 Registry（Workflow Registry、部署权限申请，https://docs.chain.link/cre/guides/operations/deploying-to-onchain-registry-ts）；Chainlink Functions 迁移到 CRE 官方指南（fulfillRequest 到 IReceiver 的对照、密钥不可导出，https://docs.chain.link/cre/reference/clf-migration）；@chainlink/cre-sdk 说明（Bun 1.4+、cre workflow simulate --broadcast、WASM/QuickJS 环境限制，https://socket.dev/npm/package/@chainlink/cre-sdk）；OpenZeppelin《Chainlink CRE 实战：把 Defender 治理提醒搬到 CRE》（CLI 1.34.0、SDK 1.19.1、Bun 1.4.0 实测版本，https://docs.openzeppelin.com/chainlink-cre/worked-example）；Matrixed.Link《Chainlink CRE: Workflows, Capabilities and DONs》（CRE 架构解析，https://matrixed.link/blog/chainlink-cre）。*
