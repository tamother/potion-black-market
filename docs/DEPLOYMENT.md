# 运行与部署

## 标准静态托管

```sh
npm ci
npm run build
```

将 **dist 文件夹内的内容** 发布到任意 HTTPS 静态主机的根目录即可。无后端、数据库、账号或环境变量要求。不要直接用 file:// 双击 index.html，应通过 HTTP(S) 访问。

可选托管方式：Cloudflare Pages、Netlify、Vercel 静态目录或普通 Nginx。构建命令 `npm run build`，输出目录 `dist`。域名根路径默认 `/`；如果部署到例如 GitHub Pages 的 `/potion-black-market/` 子路径，请设置 Vite `base`，并将 `public/world/` 素材、字体及下载链接等根绝对路径统一改为相应子路径 后重新构建。

`npm run preview` 仅用于本地检查，不是面向公网的生产服务器。

## 当前 Sites 配置

`.openai/hosting.json` 记录托管项目及静态输出目录。部署过程使用推送后的相同源代码提交及其生产产物，不包含任何访问令牌。是否发布成功及当前访问地址，以交付报告和实际部署工具返回值为准。

发布后的游戏没有注册或登录要求，进度仍保存在访客自己的当前浏览器中。托管站点与游戏账户是两回事：游戏本身没有账户功能。
