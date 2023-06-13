# AI 知识库

![屏幕截图](https://release-bj.yaoapps.com/docs/v0.10.3/screenshots/knowledge.png)

⚠️ ⚠️ ⚠️ 本项目为一个 YAO 应用的演示示例，主要介绍 YAO 如何对接向量数据库、客户端、自定义网页、 Neo DSL 中如何使用私有数据及如何将应用打包为独立制品等。

⚠️ ⚠️ ⚠️ 在开始前需要了解 YAO 的基本使用方式。 建议熟悉 YAO 之后尝试。 官方文档: https://yaoapps.com/doc

⚠️ ⚠️ ⚠️ 如需在生产环境中使用，可联系商务。联系方式: https://yaoapps.com/contact

## 仓库说明

| 仓库                                            | 说明                                        |
| ----------------------------------------------- | ------------------------------------------- |
| https://github.com/YaoApp/yao-knowledge         | 知识库 API 接口, 管理后台                   |
| https://github.com/YaoApp/yao-knowledge-web     | 知识库网站源码 (Build 之后放在 public 目录) |
| https://github.com/YaoApp/yao-knowledge-desktop | 文档上传客户端（当前支持 PDF 文件格式）     |
| https://github.com/YaoApp/yao-knowledge-pdf     | YAO PDF 文档阅读器插件 (支持 Linux / MacOS) |

## 项目依赖

| 依赖                                             | 版本                                  | 说明                |
| ------------------------------------------------ | ------------------------------------- | ------------------- |
| [YAO](https://yaoapps.com/)                      | v0.10.3+ **(#45f83c0)**               | Yao 应用引擎        |
| [Weaviate](https://github.com/weaviate/weaviate) | v0.19.6+                              | Weaviate 向量数据库 |
| [OpenAI](https://platform.openai.com/)           | gpt-3.5-turbo, text-embedding-ada-002 | OpenAI 接口         |

## 安装配置

### 安装准备

#### 安装 YAO

参考文档: [安装调试](https://yaoapps.com/doc/%E4%BB%8B%E7%BB%8D/%E5%AE%89%E8%A3%85%E8%B0%83%E8%AF%95)

⚠️ 确认 YAO 的版本为 v0.10.3+ , Git Commit: `#45f83c0`, Built: `2023-05-28T13:29:38+0000`

运行 yao version 查看

```bash
yao version --all
```

```bash
Version:	  0.10.3
Go version:	  go1.19.2
Git commit:	  45f83c08fe59
Built:	      2023-05-28T13:29:38+0000
OS/Arch:	  linux/amd64
```

#### 安装 Weaviate

Docker Compose: `compose.yml`

```yaml
version: "3.4"
services:
  weaviate:
    command:
      - --host
      - 0.0.0.0
      - --port
      - "5080"
      - --scheme
      - http
    image: semitechnologies/weaviate:latest
    ports:
      - 5080:5080
    restart: unless-stopped
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: "true"
      PERSISTENCE_DATA_PATH: "/var/lib/weaviate"
      DEFAULT_VECTORIZER_MODULE: "text2vec-openai"
      ENABLE_MODULES: "text2vec-openai,generative-openai,qna-openai"
      CLUSTER_HOSTNAME: "node1"
      all_proxy: socks5://172.17.0.1:7890
      http_proxy: http://172.17.0.1:7890
      https_proxy: http://172.17.0.1:7890
```

⚠️⚠️⚠️ **http_proxy、https_proxy、all_proxy 需修改为代理服务器，确保在容器内可访问 OpenAI 接口。**

启动服务

```bash
docker compose up -d
```

### 安装应用

#### 第一步: 下载源码

```bash
git clone https://github.com/YaoApp/yao-knowledge.git
```

#### 第二步: 配置环境变量

⚠️⚠️⚠️ **将 /data/app 替换为你自己的目录**

⚠️⚠️⚠️ **将 WEAVIATE HOST、 WEAVIATE PORT 替换为你的 Weaviate**

⚠️⚠️⚠️ **如没有 /data/app/db 目录，需手动创建**

⚠️⚠️⚠️ **将 PDF 阅读扩展插件复制到 YAO 扩展目录**

`/data/app/.env` 文件

```bash
YAO_DB_DRIVER="sqlite3"
YAO_DB_PRIMARY="/data/app/db/yao.db"
YAO_ENV="production"
YAO_HOST="0.0.0.0"
YAO_LANG="zh-cn"
YAO_LOG="/data/app/logs/application.log"
YAO_LOG_MODE="TEXT"
YAO_PORT="5099"
YAO_SESSION_FILE="/data/app/db/.session"
YAO_SESSION_STORE="file"
YAO_STUDIO_PORT="5077"

# YAO_EXTENSION_ROOT 设置 YAO 扩展目录; 插件目录为 $YAO_EXTENSION_ROOT/plugins。
# 将对应架构的 .so 文件复制到 /data/yao-exts/plugins/pdf.so
# PDF 文件阅读插件 https://github.com/YaoApp/yao-knowledge-pdf
YAO_EXTENSION_ROOT="/data/yao-exts"

WEAVIATE_HOST="http://<WEAVIATE HOST>:<WEAVIATE PORT>"
OPENAI_KEY=sk-xxxx
YAO_JWT_SECRET=LiQDE1kOnvv6Qv3if2KhEJ7Ihzz1XZ

```

#### 第三步: 启动服务

初始化数据

```bash
yao migrate --reset && yao run scripts.doc.SchemaReset

```

启动服务

```bash
yao start
```

### 独立制品

#### 打包为独立制品

⚠️⚠️⚠️ **将 /data/app 替换为你自己的目录**

⚠️⚠️⚠️ **PACK_FLAG="-l 123456" 可替换为你自己的密码**

```bash
docker run -it --rm \
      -v /data/app:/app \
      -e APP_NAME="knowledge" \
      -e PACK_FLAG="-l 123456" \
      -e PACK_ENV="/app/pack.build.yao" \
      yaoapp/yao-build:0.10.3-amd64 make
```

打包好的制品在 `dist` 目录下

```bash
dist
├── knowledge-0.10.3-linux-amd64
└── knowledge-0.10.3-linux-arm64
```

#### 启动服务

⚠️⚠️⚠️ 首次运行需初始化数据

```bash
mkdir /data/empty
cd /data/empty

# 首次运行初始化数据
knowledge-0.10.3-linux-amd64 -k 123456 migrate --reset && knowledge-0.10.3-linux-amd64 -k 123456 run scripts.doc.SchemaReset

# 启动服务
knowledge-0.10.3-linux-amd64 -k 123456 start
```

### 文件上传客户端

仓库: https://github.com/YaoApp/yao-knowledge-desktop

配置文件: [config.js](https://github.com/YaoApp/yao-knowledge-desktop/blob/main/config.js)

```bash
module.exports = { url: "http://127.0.0.1", port: 5099 };
```

| 参数 | 说明            |
| ---- | --------------- |
| url  | 知识库 API 地址 |
| port | 端口号          |

制品打包参考 [release workflow](https://github.com/YaoApp/yao-knowledge-desktop/blob/main/.github/workflows/release.yml)

### 知识库网站

仓库: https://github.com/YaoApp/yao-knowledge-web

可将打包后的文件，放到 `public` 目录

```bash
npm run build
```

```bash
cp -r dist/* /data/app/public/
```
