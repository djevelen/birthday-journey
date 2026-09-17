# Birthday Journey

一个以 3D 地球为核心的生日旅行网页。点击“启程”后，页面会沿京都、瑞士、冰岛、圣托里尼与巴塔哥尼亚展开；滚动时地球、路线、照片和祝福文字同步切换。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 个性化

所有主要内容都集中在 `src/config.js`：

- `recipientName`：收礼人姓名
- `senderName`：署名
- `finalWish`：最终祝福
- `audioSrc`：有公开使用权的音乐地址；留空时页面显示“音乐待加入”
- `stops`：地点、坐标、照片、文案、颜色与摄影来源

如果加入音乐，请将已获授权的文件放在 `public/assets/`，并把 `audioSrc` 设置为对应的公开路径。仓库不包含《One Last Kiss》音源。

## 发布

源码保存在 `main` 分支，`npm run build` 生成的静态文件发布到 `gh-pages` 分支。Vite 的基础路径已配置为 `/birthday-journey/`。

素材来源见 [ASSET_SOURCES.md](./ASSET_SOURCES.md)。
