# 心港

一个可直接运行的情感陪伴网站项目，包含：

- 前台：首页涟漪互动、情绪签到、支持卡和情绪晴雨表
- 陪伴对话页：保存会话、识别状态、推荐资源
- 后台管理页：管理员登录、查看会话、维护资源、配置站点和 AI
- 本地后端：Node.js 原生 `http` 服务，无需额外依赖

## 启动方式

使用 Node.js 22 或更新版本。项目没有第三方依赖，可在项目根目录直接启动。

```bash
npm start
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

开发时可运行 `npm run dev`，修改服务端代码后会自动重启。使用 `npm test` 检查密码校验、情绪分析、陪伴回复、首页入口和离线缓存规则。

## 默认后台账号

- 账号：`admin`
- 密码：`admin123456`

管理员登录入口：

```text
http://localhost:3000/admin-login
```

首次登录后建议在后台的“设置”页修改账号或密码。

## 技术结构

```text
public/   前台页面、后台页面、样式和浏览器脚本
src/      鉴权、数据存储、陪伴回复逻辑
tests/    自动测试
server.js Node 服务入口
```

运行后的私有数据默认保存在：

- Windows：`%LOCALAPPDATA%\HeartHarbor`
- macOS / Linux：`~/.heart-harbor`
- 签到和会话保存在数据目录下的 `logs/`
- 如需自定义位置，可设置环境变量 `COMPANION_DATA_DIR`
- Git 忽略项目内的 `data/`，供旧数据迁移或本地运行使用。AI Key、会话、签到和后台配置均属于运行数据。

## 说明

- 不配置 AI 也能使用，系统会走本地规则回复。
- 如需接入 Kimi 或其他 OpenAI 兼容接口，可在后台设置中填写 `Base URL`、模型和 `API Key`。
- 情绪签到、陪伴会话、管理员配置和 AI Key 默认都保存在你电脑自己的私有目录，不在项目文件夹里。
- 如果你把整个项目文件夹打包发给别人，默认不会把这些运行数据一起带走；除非你另外导出了 `%LOCALAPPDATA%\HeartHarbor`。
- 更详细的使用说明见 [USER_GUIDE.md](USER_GUIDE.md)。
