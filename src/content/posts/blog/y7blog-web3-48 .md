---
title: 47｜CRE 的开发工具怎么用？写出第一个工作流
published: 2026-11-23
pinned: false
draft: false
comment: true
description: Functions 时代的 Playground 已经跟着产品一起退役了，CRE 里没有网页版的试运行入口，开发工具换了一整套：命令行 cre、模板库、本地模拟器，再加上网页上的管理界面。这篇就把这套工具一个个讲清楚：怎么装 CLI、怎么登录、cre init 的四个问题怎么答、工程里的文件各管什么、模板怎么选、Hello World 工作流怎么写、本地模拟的输出怎么看、部署之前还要办什么手续。照着走一遍，第一个工作流就能在自己电脑上跑起来。
image: https://www.y7img.ccwu.cc/file/1795680659843_y7blog-web3-48-1600.png
tags: [Chainlink, CRE, 开发工具, 工作流, Web3]
category: Web3
slug: blog/y7blog-web3-48
series: "区块链百科"
seriesOrder: 1
---

想象一下，你刚学完 CRE 是怎么回事，想亲手写一个工作流试试。打开浏览器，凭着以前的记忆去找 Chainlink Functions Playground——那个能直接在网页上粘贴一段 JavaScript、点一下“运行”就看到结果的在线工具。结果找不到了。

这不是你记错了地址，而是工具本身已经不存在了。Functions 主网在 2026 年 6 月 30 日关闭，测试网在同年 6 月 15 日关闭，Playground 是 Functions 的一部分，跟着产品一起退役了。CRE 没有网页版的 Playground，取而代之的是一套装在你自己电脑上的开发工具：命令行、模板库、本地模拟器，再加一个网页上的管理界面。

这篇就把这套工具一个个讲清楚：怎么装、怎么登录、第一个项目怎么建、模板怎么选、最小的 Hello World 工作流长什么样、本地模拟的输出怎么看、部署之前还要办什么手续。照着走一遍，第一个工作流就能在自己电脑上跑起来。

> 💡 **先说清楚**：这篇是知识科普，不是投资建议。CRE 正式上线才一年，工具链和文档还在演进，本文按 2026 年 11 月 26 日核对的官方文档写，CLI 以当时最新的 v1.40.0 为准；如果你照着动手，遇到和本文不一致的地方，以官方文档为准，先在测试网练手。文里提到的 Functions 退役日期只写到“已退役/已关闭”，因为不同来源对具体日期的说法并不一致。

---

## 一、先认清：CRE 的开发工具是一套，不是一个网页

Functions 时代的开发体验是“网页为主”：打开 Playground，粘贴代码，点运行，看结果，觉得行了再去配订阅、写合约。整个过程不需要在自己电脑上装任何东西。

CRE 的开发体验反过来了，是“本地为主、网页为辅”：

```
装 cre 命令行工具
        ↓
创建账号、登录 CLI
        ↓
cre init 生成一个标准工程
        ↓
在本地写代码、本地模拟跑通
        ↓
部署到 DON 网络上跑
        ↓
去网页界面看执行记录和日志
```

网页界面（app.chain.link/cre）还在，但它的角色变了：不再是写代码、试运行的地方，而是**管账号、管组织、看部署后的工作流跑得怎么样**的地方。写代码和试运行都在你自己的电脑上完成。

这个变化对初学者其实是好事：本地模拟调的是真实的 API、读的是真实的公链，跑通了再部署，心里有底。唯一要适应的，是得先花十几分钟把工具装好。

|  | Functions 时代 | CRE |
|---|---|---|
| 写代码、试运行的地方 | 网页 Playground | 自己电脑上的工程 + 本地模拟器 |
| 上手第一步 | 打开网页就能写 | 装 CLI、建账号、登录 |
| 起步代码从哪来 | Playground 里粘贴示例 | `cre init` 从模板生成 |
| 部署之后去哪看运行情况 | Functions 界面 | app.chain.link/cre 平台界面 |
| 模拟要不要审批 | 不需要 | 不需要，装好就能跑 |

## 二、装三样东西：账号、CLI 和 Bun

动手之前，先把三样东西准备好。和 46 篇一样，顺序是：先有账号，再装工具。

### 1. Chainlink 平台账号

到 app.chain.link 创建一个账号，建一个组织，开双重验证（2FA）。这是所有 CLI 命令的前提，注册本身不花钱。没有账号，`cre login` 没法完成，后面的命令也跑不起来。

### 2. 装 cre CLI

在 macOS 或 Linux 上，一行命令就能装：

```
curl -sSL https://app.chain.link/cre/install.sh | bash
```

这行脚本会自己判断你的系统和芯片架构，下载对应的二进制文件、校验完整性，装到 `$HOME/.cre` 下面。装完验证一下：

```
cre version
```

按 2026 年 11 月 26 日核对的官方文档，装完应该显示 `CRE CLI version v1.40.0`。版本号变得很快，装的时候以官方安装页为准——如果显示的版本比这个旧，跑 `cre update` 升级。

不想用脚本安装，也可以去 GitHub 的 cre-cli 发布页手动下载对应系统的压缩包，下载后先用 `shasum -a 256` 核对 SHA-256 校验和，确认文件没被动过，再解压、改名、放到 PATH 里。手动装多几步，但道理一样：**先核对校验和，再装**，别从不明来源下载二进制文件。

### 3. 装 Bun

TypeScript 路线还需要 Bun，官方入门要求 Bun 1.2.21 或更高版本，用 `bun --version` 检查。OpenZeppelin 的实测教程用的是 Bun 1.4.0，版本新一点更稳。Bun 在这里干两件事：给工作流装依赖（`bun install`），以及在装依赖时自动跑 `bunx cre-setup`，把编译 TypeScript 到 WASM 需要的工具链准备好。

| 准备项 | 用来干什么 | 没有会怎样 |
|---|---|---|
| Chainlink 平台账号 | 登录 CLI、管理组织 | CLI 命令跑不起来 |
| cre CLI v1.40.0 | 初始化项目、本地模拟、部署 | 写不了、跑不了工作流 |
| Bun 1.2.21+ | 装依赖、准备 WASM 编译工具 | `bun install` 那步就卡住 |

## 三、登录：先确认你是谁，再干活

装好 CLI，先登录，再确认身份：

```
cre login
cre whoami
```

`cre login` 会按提示完成认证，`cre whoami` 显示你的账号信息。登录成功时，大概是这个样子：

```
Account details retrieved:
    Email:           email@domain.com
    Organization ID: org_AbCdEfGhIjKlMnOp
```

如果没登录就跑别的命令，会收到一句很直白的报错：

```
Error: failed to attach credentials: failed to load credentials: you are not logged in, try running cre login
```

看到这句别慌，它就是在提醒你先登录。`cre whoami` 还有一个附带的好处：它会显示你的部署权限状态，部署那一步会用到，先看一眼心里有数。

## 四、第一个项目：`cre init` 的四个问题

登录之后，跑 `cre init`，CLI 会像向导一样问你四个问题：

```
cre init
```

**第一个问题：项目名。** 比如 `onchain-calculator`，这会成为你电脑上的项目文件夹名。

**第二个问题：语言。** 选 TypeScript 还是 Go。这系列一直用 TypeScript，选它。

**第三个问题：模板。** 选一个工作流模板。第一次练手，选 `Helloworld`——最小的 Hello World 例子，从零开始学每一步配置。

**第四个问题：第一个工作流的名字。** 比如 `my-calculator-workflow`，这是项目里第一个工作流的文件夹名。

问完还会让你选部署 registry：私有 registry（private）排在前面，选它练手不用钱包、不用 Gas；链上 registry（`onchain:ethereum-mainnet`）适合正式的生产部署。如果你的组织里还没有可用的 registry，这一步会直接跳过。

不想一步步回答，也可以用一行命令直接指定：

```
cre init --template=automation-migration-go --project-name my-automation-migration --workflow-name my-workflow
```

上面这行是官方迁移指南里的例子，意思是直接用 Automation 迁移模板建项目。交互式向导适合第一次，命令行参数适合写脚本、搭 CI。

## 五、工程长什么样：一个项目，七八个文件

`cre init` 跑完，会生成一个标准工程。拿官方入门教程的 `onchain-calculator` 项目举例，结构是这样的：

```
onchain-calculator/
├── my-calculator-workflow/
│   ├── config.production.json
│   ├── config.staging.json
│   ├── main.ts
│   ├── package.json
│   ├── README.md
│   ├── tsconfig.json
│   └── workflow.yaml
├── .env
├── .gitignore
├── project.yaml
└── secrets.yaml
```

一个项目可以装多个工作流，每个工作流自己一个子目录，各有各的 `package.json` 和 `tsconfig.json`，互相独立，拷走一个就能单独用。

| 文件 | 管什么 |
|---|---|
| `project.yaml` | 项目全局配置，所有工作流共用，比如不同环境的 RPC 地址 |
| `secrets.yaml` | 密钥的“声明”：哪些值是机密、从哪来，本身不存密钥 |
| `.env` | 真正放密钥和环境变量的地方，比如 Sepolia 账号的私钥 |
| `.gitignore` | 拦住 `.env` 这类敏感文件，不让它们进版本控制 |
| `main.ts` | 工作流代码本体，编译成 WASM 的入口 |
| `package.json` | 这个工作流自己的依赖 |
| `tsconfig.json` | 这个工作流的 TypeScript 编译配置 |
| `workflow.yaml` | 这个工作流的元数据：名字、文件在哪、目标环境 |
| `config.staging.json` / `config.production.json` | 测试环境 / 生产环境的参数 |

这里有两个文件新手最容易搞错：

**`.env` 里放的是真私钥，绝不能提交到 git。** 官方模板自带的 `.gitignore` 已经把它拦住了，别手欠把它删掉。`CRE_ETH_PRIVATE_KEY` 这一行，模拟的时候也要填——哪怕你的工作流还不写链，模拟器初始化环境也需要一个私钥占位。

**`secrets.yaml` 里不放密钥本身。** 它只声明“有哪些值是机密”，真正的值本地走 `.env` 提供，生产上走 Vault DON。密钥不可导出是 CRE 的设计，46 篇讲迁移时提过一次，这里再强调一遍：别想着把密钥写进代码里。

## 六、`workflow.yaml`：一个文件管两个环境

`workflow.yaml` 是最值得单独讲的一个文件。它告诉 CLI：这个工作流有哪些目标环境、每个环境用什么配置。`cre init` 默认生成两个目标：

```
# ==========================================================================
staging-settings:

  user-workflow:
    workflow-name: "my-calculator-workflow-staging"
  workflow-artifacts:
    workflow-path: "./main.ts"
    config-path: "./config.staging.json"
    secrets-path: ""
# ==========================================================================
production-settings:

  user-workflow:
    workflow-name: "my-calculator-workflow-production"
  workflow-artifacts:
    workflow-path: "./main.ts"
    config-path: "./config.production.json"
    secrets-path: ""
```

三点要看懂：

- **目标（target）就是一套环境配置。** `staging-settings` 是测试环境，`production-settings` 是生产环境，名字可以自己改，比如 `dev`、`test`、`prod`。跑命令时用 `--target` 指定用哪一套。
- **同一个工作流，不同环境有不同的名字。** 后缀 `-staging` 和 `-production` 让同一份代码部署到两个环境时身份不重叠，部署后在界面上也分得清。
- **每个目标指向自己的配置文件。** `config-path` 指着 `config.staging.json` 或 `config.production.json`，代码里通过 `config` 对象读到的参数，就来自当前目标对应的那个文件。

`config.staging.json` 一开始只有一行：

```
{
  "schedule": "*/30 * * * * *"
}
```

这是 6 段的 Cron 表达式，每 30 秒触发一次——也是 Cron 触发器最短的间隔。46 篇的链上计算器就是在这个基础上加了 API 地址、合约地址这些参数。

## 七、最小的工作流：Hello World 只有二十行

`cre init` 选 Helloworld 模板生成的 `main.ts`，是最适合第一次读的工作流代码：

```
import { CronCapability, handler, Runner, type Runtime } from "@chainlink/cre-sdk"

type Config = {
  schedule: string
}

const onCronTrigger = (runtime: Runtime<Config>): string => {
  runtime.log("Hello world! Workflow triggered.")
  return "Hello world!"
}

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()

  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
```

这二十行里有四个角色，认清了它们，CRE 的工作流代码就入门了：

- **`Config`**：配置的类型定义，告诉 TypeScript，`config` 对象里有什么字段、分别是什么类型。想加校验，可以用 Zod 这类支持 Standard Schema 的库，编译时和运行时都帮你把关。
- **`onCronTrigger`**：触发时真正干活的回调函数，收到 `runtime` 对象，返回一个字符串结果。你的业务逻辑都写在这里。
- **`initWorkflow`**：注册“处理器”的地方。`handler(触发器, 回调)` 把“什么时候跑”和“跑起来干什么”连在一起。一个工作流可以有多个处理器，这里先用一个。
- **`main`**：入口函数，创建一个 `Runner`，把 `initWorkflow` 交给它运行。

注意 `runtime.log()` 这一行：日志只能用它，`console.log` 在 WASM 环境里不输出。46 篇讲过一次，这里再提一次，因为这是新手调试时最容易抓狂的地方——代码跑了，没日志，还以为没跑。

## 八、模板怎么选：先看你要学什么

不想从 Hello World 一行行写起，可以直接从模板开始。跑 `cre templates list` 能看到全部模板，或者去 GitHub 的 `smartcontractkit/cre-templates` 仓库翻。模板分两类：

| 模板 | 是什么 | 适合谁 |
|---|---|---|
| Helloworld（内置） | 最小的工作流，只有一个 Cron 触发和一句日志 | 第一次练手，从零学配置 |
| kv-store（Building Block） | 读 AWS S3 里的值，加一，再写回去 | 想学“带密钥的链下写操作 + 共识” |
| read-data-feeds（Building Block） | 定时读 Chainlink Data Feeds 的 `decimals()` 和 `latestAnswer()` | 想学“读链上数据 + 合约 ABI” |
| custom-data-feed（Starter） | 定时从 API 取数、写回链上的完整数据流 | 刚走完入门教程，想看更接近真实的例子 |
| bring-your-own-data（Starter） | 把净值（NAV）、储备证明（PoR）这类机构数据发上链 | 做机构数据上链的参考架构 |
| multi-chain-token-manager（Starter） | 一个工作流管多条链上的 Token 操作 | 要做多链 Token 管理 |
| automation-migration（迁移模板） | 用桥接合约把旧 Automation 逻辑搬到 CRE | 正在从 Automation 迁移的老用户 |

选模板的思路很简单：**先看你要学什么，再选模板，而不是先选个看起来厉害的。** 想学某一个能力，挑 Building Block，代码少、只讲一个概念；想直接拿一个能改的生产骨架，挑 Starter Template。Hello World 模板是内置在 CLI 里的，不用联网也能用；其它模板是运行时从 GitHub 动态拉取的。

## 九、本地模拟：不用审批就能跑通

这是 CRE 开发工具里最友好的设计：**模拟不需要审批，部署才需要。** 装好 CLI 就能直接在自己电脑上把工作流跑起来：

```
cre workflow simulate my-calculator-workflow --target staging-settings
```

这条命令会把 TypeScript 代码编译成 WASM，在你自己的机器上跑，但**调的是真实的 API、读的是真实的公链**。本地跑通了，部署到 DON 上大概率也能跑通。跑完之后，输出大概是这个样子：

```
Workflow compiled
2025-11-03T19:04:21Z [SIMULATION] Simulator Initialized
2025-11-03T19:04:21Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
2025-11-03T19:04:21Z [USER LOG] Hello world! Workflow triggered.
Workflow Simulation Result:
 "Hello world!"
2025-11-03T19:04:21Z [SIMULATION] Execution finished signal received
```

输出里有三种信息，要分清：

- **`[SIMULATION]`**：模拟器自己的系统消息，告诉你它初始化了、触发器跑了、执行结束了。
- **`[USER LOG]`**：你自己的代码打出来的日志，就是 `runtime.log()` 的内容。调试的时候盯着这一行看。
- **`Workflow Simulation Result`**：工作流回调的返回值，TypeScript 里就是你那个回调函数 `return` 的东西。

不同触发器，模拟的办法不一样：

| 触发器 | 模拟时怎么让它跑起来 |
|---|---|
| Cron（定时） | 模拟器检测到触发器就直接跑，不用等时间到 |
| HTTP（收到请求才跑） | 加 `--listen`，模拟器在本地 2000 端口起一个服务器，收到 POST 请求就重跑一次；也可以用 `--http-payload` 直接传一段 JSON |
| 链上事件（Log） | 传 `--evm-tx-hash` 和 `--evm-event-index`，给模拟器一笔真实交易当触发样本，不用等链上真的出事件 |

HTTP 触发的 `--listen` 模式很适合反复调试：模拟器一直开着，你改一次代码、发一次请求，它就重跑一次，不用每次都重启模拟器。传给触发器的 JSON 要包在 `input` 字段里，`--http-payload` 这个 flag 传的时候不用包。

模拟和部署的区别，46 篇列过一张表，这里再贴一次，因为这是整套工具里最容易踩坑的地方：

|  | 本地模拟 | 部署到 DON |
|---|---|---|
| 要不要审批 | 不需要，装好就能跑 | 需要，先跑 `cre account access` 申请部署权限 |
| 在哪跑 | 你自己的机器 | Chainlink 的 DON 网络 |
| 调真实 API 吗 | 调，真实的 | 调，真实的 |
| 写链真的上链吗 | 默认不广播，加 `--broadcast` 才会真的发交易 | 真的写链 |

## 十、部署和管理：跑通之后才轮到这一步

本地模拟跑通了，才轮到部署。部署命令和模拟命令长得很像，只是换了一个动词：

```
cre workflow deploy my-workflow --target staging-settings
```

这条命令会一口气做三件事：把工作流编译成 WASM、把编译产物和配置文件上传到 CRE 存储服务、再注册到你选的 registry 里。部署之前，先确认两件事：

```
cre whoami
cre registry list
```

前者看部署权限是不是批下来了，后者看组织里有没有可用的私有 registry（`Type: off-chain` 的那一行）。权限没批下来之前，`deploy` 是跑不通的——这是设计，不是故障，排计划的时候要给审批留出时间，官方没有承诺审批要多久。

部署之后，工作流的日常管理也都走 CLI：

| 命令 | 干什么 |
|---|---|
| `cre workflow list` | 看组织里部署了哪些工作流 |
| `cre workflow get` | 看某一个工作流的详情 |
| `cre workflow activate` / `cre workflow pause` | 启动 / 暂停一个工作流 |
| `cre workflow build` | 只编译成 WASM，不上传、不部署，适合放进 CI 流程 |
| `cre workflow hash` | 部署前看一眼内容的哈希值，确认编出来的东西就是你想部署的 |
| `cre execution list` | 在终端里看最近的执行记录，按工作流、状态、时间筛 |

部署之后想看某一次执行到底发生了什么，去网页界面：app.chain.link/cre 里选工作流 → Execution → Logs。本地模拟的日志打在终端里，部署之后的工作流日志在界面里看，两个地方别搞混。

还有一个官方推荐的帮手：**CRE agent skill**。Chainlink 官方给 Cursor、Claude Code、Codex 这些 AI 编程工具做了专门的 skill，可以让 AI 帮你生成和调试工作流。刚入门的时候用它搭骨架、查 API 用法，比自己翻文档快；但生成的代码还是要自己跑模拟验证，别直接部署。

## 十一、经常踩的坑

**还在找网页版 Playground。**

Functions 的 Playground 已经随产品退役了，CRE 里没有对应的网页工具。在网页上粘贴代码、点运行这条路走不通了，改成 `cre init` + `cre workflow simulate`，本地模拟就是 CRE 的“Playground”。

**Bun 版本太旧。**

官方入门要求 Bun 1.2.21 或更高版本。版本太旧，装依赖那步就会报错。跑 `bun --version` 检查，旧了就先升级 Bun，再 `bun install`。

**私钥进了 git。**

`.env` 里放的是真私钥，模拟也要填。官方模板自带的 `.gitignore` 已经把它拦住了，别手欠删掉那一行，也别把私钥粘进 `main.ts` 或 `config.json` 里。

**模拟不写链，就不填私钥。**

模拟器初始化环境就需要一个私钥，哪怕工作流只读数据、只调 API 也一样。`.env` 里的 `CRE_ETH_PRIVATE_KEY` 先填一个占位值，写链的模拟再换成有 Sepolia ETH 的真账号。

**模拟写链没加 `--broadcast`，以为写链失败了。**

模拟默认不广播交易。本地跑完去链上查不到结果，先检查是不是忘了加这个 flag。

**拿平时写 TypeScript 的习惯写工作流。**

`async/await` 在能力调用上行不通，要用“先发起、再 `.result()`”的两步模式；`console.log` 在 WASM 里不输出，要用 `runtime.log()`。这两个是官方文档和 SDK 说明里反复强调的，照着 Node.js 的习惯写，编译能过、跑起来没反应，查起来很费时间。

**以为装好 CLI 就能部署。**

模拟不用审批，部署要。`cre account access` 是专门申请部署权限的命令，批下来之前，`deploy` 跑不通。私有 registry 还要组织里有对应角色。部署这一步要提前规划，别等到要上线当天才发现权限没批。

**staging 和 production 的配置搞混。**

`config.staging.json` 和 `config.production.json` 是两份文件，`--target` 指向哪一套，代码读到的就是哪一套。部署到生产之前，先核对 `workflow.yaml` 里 production 那一段指的配置文件对不对，别把测试环境的 API 地址和合约地址带到生产上去。

---

## 总结

- Functions 的 Playground 已经随产品退役了，CRE 没有网页版的试运行入口；写代码和试运行都在本地完成，网页界面只负责管账号、管组织、看部署后的执行记录。
- 开发工具一共四件套：`cre` 命令行、模板库、本地模拟器、app.chain.link/cre 平台界面，另外官方还给 AI 编程工具做了 CRE agent skill。
- 上手三步：到 app.chain.link 建账号并开 2FA，用安装脚本装 CRE CLI（最新 v1.40.0），再装 Bun 1.2.21 或更高版本；然后 `cre login`、`cre whoami` 确认身份。
- `cre init` 向导问四个问题：项目名、语言、模板、第一个工作流的名字，再选部署 registry；第一次练手选 Helloworld 模板。
- 工程结构要认清：`project.yaml` 管全局，`workflow.yaml` 管每个目标环境，`main.ts` 是代码本体，`.env` 放真私钥、绝不能进 git，`secrets.yaml` 只声明密钥、不存密钥。
- 最小工作流只有二十行：`Config` 定义配置、`onCronTrigger` 写逻辑、`initWorkflow` 用 `handler(触发器, 回调)` 注册、`main` 里用 `Runner` 跑起来。
- 模板按需选：学单个能力用 Building Block（kv-store、read-data-feeds），拿生产骨架用 Starter Template（custom-data-feed、bring-your-own-data、multi-chain-token-manager），从 Automation 迁移用 automation-migration 模板。
- 本地模拟不需要审批，调真实 API、读真实公链；输出分三种：`[SIMULATION]` 是系统消息、`[USER LOG]` 是你自己的日志、`Workflow Simulation Result` 是回调返回值；模拟写链默认不广播，要加 `--broadcast`。
- 部署之前先确认权限：`cre whoami` 看权限、`cre registry list` 看 registry，批下来之前 `deploy` 跑不通；部署后用 `cre workflow activate/pause` 管理，用 `cre execution list` 或平台界面的 Execution → Logs 看执行记录。
- 容易踩的坑：找 Playground、 Bun 版本太旧、私钥进 git、模拟不填私钥、忘记 `--broadcast`、用 `async/await` 和 `console.log` 写工作流、没批权限就部署、staging 和 production 配置搞混。

---

## 下一篇是第 48 篇：

[[blog/y7blog-web3-49]]

工具装好了、第一个工作流也在本地跑起来了，下一篇该算一笔账了：CRE 怎么计费？下一篇会讲工作流跑起来到底要花多少钱、费用是怎么算的、测试环境和生产环境的计费有什么不一样，以及怎么写工作流才能少花冤枉钱——先把成本这件事搞清楚，再动手部署生产环境才踏实。

---

*参考资料：Chainlink CRE 总览（开发工具：CLI、模板、模拟器、平台界面、GraphQL API、agent skill；CLI v1.40.0，2026-11-26 核对，https://docs.chain.link/cre）；Chainlink CRE 入门第一部分：项目搭建与模拟（cre init、工程结构、workflow.yaml、Hello World 代码、模拟输出，2026-11-26 核对，https://docs.chain.link/cre/getting-started/part-1-project-setup-ts）；Chainlink CRE CLI macOS/Linux 安装（安装脚本、v1.40.0、SHA-256 校验，2026-11-26 核对，https://docs.chain.link/cre/getting-started/cli-installation/macos-linux）；Chainlink CRE 模板（Building Blocks 与 Starter Templates、cre templates list，2026-11-26 核对，https://docs.chain.link/cre/templates）；Chainlink CRE CLI 参考（cre init、workflow build/simulate/deploy/activate/pause/list/get/hash、execution list、account access，2026-11-26 核对，https://docs.chain.link/cre/reference/cli）；Chainlink CRE 演示工作流（Custom Data Feed 模板、两条执行路径，2026-11-26 核对，https://docs.chain.link/cre/templates/running-demo-workflow-ts）；Chainlink CRE 模拟 HTTP 触发器（--listen 本地 2000 端口、--http-payload，2026-11-26 核对，https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/testing-in-simulation）；Chainlink Functions 模拟（Playground 说明，产品已退役，2026-11-26 核对，https://docs.chain.link/chainlink-functions/resources/simulation）；Matrixed.Link《Chainlink 产品全解 2026》（Functions 与 Automation 已退役、CRE 是接替者，2026-11-26 核对，https://matrixed.link/blog/chainlink-products-explained）；Chainlink 文档 llms.txt（Functions 与 Automation 页面已下线、不再维护，2026-11-26 核对，https://docs.chain.link/llms.txt）。*
