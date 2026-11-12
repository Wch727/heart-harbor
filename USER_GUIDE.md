# 心港用户指南

## 1. 项目简介

心港是一个情感陪伴网站，适合做以下事情：

- 让用户在首页做情绪签到
- 在陪伴页进行短句式对话和情绪整理
- 在后台查看会话、记录风险、维护支持资源
- 根据需要切换为本地规则回复或在线 AI 回复

它不是医疗系统，也不替代心理治疗、诊断或紧急救助。

## 2. 启动项目

在项目根目录运行：

```bash
npm start
```

成功后会看到：

```text
Emotional companion site is running on http://localhost:3000
```

然后在浏览器访问：

```text
http://localhost:3000
```

## 3. 前台使用

### 3.1 首页

首页提供四类能力：

- 站点介绍与危机提醒
- 情绪签到表单
- 资源卡片展示
- 跳转到陪伴对话页

### 3.2 情绪签到

用户可以填写：

- 昵称
- 当前情绪
- 精力值
- 压力值
- 一句补充说明

签到后，数据会保存在：

- `%LOCALAPPDATA%\HeartHarbor\logs\checkins.json`

### 3.3 陪伴对话页

地址：

```text
http://localhost:3000/chat
```

能力包括：

- 保存当前访客会话
- 根据输入识别情绪状态
- 返回简短、可执行的陪伴回复
- 匹配支持资源卡片
- 对危机内容切换到安全优先提醒

会话数据保存在：

- `%LOCALAPPDATA%\HeartHarbor\logs\conversations.json`

## 4. 后台使用

管理员登录地址：

```text
http://localhost:3000/admin-login
```

登录成功后会自动进入：

```text
http://localhost:3000/admin
```

默认账号：

- 用户名：`admin`
- 密码：`admin123456`

说明：

- 公共页面不再展示后台入口
- 未登录时直接访问 `/admin` 会被重定向到管理员登录页
- 普通访客不能直接进入后台内容页

### 4.1 概览

可以查看：

- 会话总数
- 待跟进会话数量
- 情绪签到数量
- 已启用资源数量
- 最近会话和最近签到
- 情绪分布和状态分布

### 4.2 会话管理

可以对每条会话进行：

- 查看最近几条消息
- 修改状态：`open` / `stable` / `needs-followup`
- 记录管理员备注

适合做人工复盘、内容审核或风险跟进。

### 4.3 资源管理

可以新增、编辑、删除资源卡片，字段包括：

- 标题
- 分类
- 描述
- 步骤
- 是否启用

资源数据保存在：

- 运行数据目录下的 `resources.json`。

### 4.4 设置页

可以配置：

- 站点名称和首页文案
- 聊天欢迎语和占位提示
- 危机横幅和求助提醒
- AI Base URL / 模型 / API Key / 提示词
- 管理员账号
- 新密码

站点配置保存在：

- 运行数据目录下的 `site.json`。

## 5. AI 接入方式

默认情况下，站点使用本地规则回复。

如果要切换到在线 AI，请在后台设置里填写：

- `AI Base URL`
- `AI 模型`
- `AI API Key`
- 勾选“启用在线 AI 回复”

当前服务端按 OpenAI 兼容的 `chat/completions` 方式请求接口，因此常见兼容平台都可以接。

如果接口失败，系统会自动回退到本地规则回复。

## 6. 数据说明

运行后会在电脑本地私有目录生成 JSON 文件，默认位置是：

- Windows：`%LOCALAPPDATA%\HeartHarbor`
- macOS / Linux：`~/.heart-harbor`
- 如果手动设置了 `COMPANION_DATA_DIR`，则会改用该目录

主要文件包括：

- `%LOCALAPPDATA%\HeartHarbor\site.json`：站点配置、AI 配置、管理员账号
- `%LOCALAPPDATA%\HeartHarbor\resources.json`：支持资源卡片
- `%LOCALAPPDATA%\HeartHarbor\logs\checkins.json`：首页签到日志
- `%LOCALAPPDATA%\HeartHarbor\logs\conversations.json`：陪伴会话日志

如果你只想单独备份或清理日志，直接处理 `%LOCALAPPDATA%\HeartHarbor\logs` 即可；如果要完整备份站点内容，再备份整个 `%LOCALAPPDATA%\HeartHarbor`。

补充说明：

- 浏览器本地还会保留少量站点状态，例如当前会话 ID 和陪伴模式，用于下次打开时继续使用
- 这些浏览器状态不等于完整日志；完整签到和会话记录仍然保存在 `%LOCALAPPDATA%\HeartHarbor\logs`

## 7. 安全提醒

这个项目已经做了几层基础保护：

- 管理员密码哈希保存，不是明文
- 管理后台使用 Cookie 会话
- 会话和签到数据保存在本地，不依赖第三方数据库
- 前台可匿名使用，不要求手机号或邮箱
- 普通访客看不到后台内容，前台也不会公开展示他人的对话
- 检测到危机词时，优先输出真人求助提醒

但它仍然只是一个轻量站点，不建议直接作为高风险医疗场景系统上线。

## 8. 后续可扩展方向

如果你之后还想继续升级，这个项目比较适合往这些方向扩展：

- 接入真正的数据库，例如 SQLite / PostgreSQL
- 增加多管理员权限
- 增加用户注册和个人成长档案
- 增加图表导出和数据筛选
- 接入短信、邮件或企业微信告警
- 增加内容审核和关键词策略配置
