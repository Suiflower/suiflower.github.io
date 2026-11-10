# Sora's Garden · v2

已作为主站使用的第二版个人手记，使用米白与墨黑纯色背景、绿色点缀。

- 首页、文章列表、关于页面和文章正文直接展示，正文区域采用透明背景。
- 桌面端文章目录放在右侧，窄屏端优先展示正文。
- 日期按月日与年份分行显示，文章保留排版示例标注。
- 英文标题使用 Poppins，英文正文使用 Lora，中文搭配思源宋体。字体由网站自身提供。
- 圆角导航栏固定在视口上方，主题选择保存在浏览器中。

## 编辑与预览

- `content/posts/*.md` 为文章源文件，构建生成主站列表和正文。原 `/v2/` 页面会跳转到主站对应页面，旧 `/archive/` 入口跳转到 `/posts/`。
- `content/about.md` 为关于页面的内容。
- `site.json` 管理站名、作者和简介。
- `public/v2/index.html`、`posts/index.html`、`about/index.html` 是对应页面的外壳。正文由 `scripts/build.mjs` 中的 `savePage` 相关代码生成。
- `public/v2/assets/style.css` 管理字体、颜色、阅读宽度与响应式布局。
- `assets/fonts/` 包含 Poppins、Lora 及其开放字体许可证。

在仓库根目录运行 `npm.cmd run build` 和 `npm.cmd run dev`，打开 http://127.0.0.1:4173/。

## 邮箱账号

主题按钮右侧有圆形账号入口。邮箱验证码同时用于登录和新用户注册；账号会话由 Supabase Auth 管理。登录后可更换头像和退出登录。

- 项目公开连接配置：`assets/auth-config.js`。
- 客户端逻辑源码：仓库根目录的 `scripts/browser/auth.mjs`。
- 浏览器 SDK 随 `npm run build` 打包，无需访客访问第三方脚本 CDN。
- 头像存入私有 `sora-avatars` 存储桶，仅账号本人可以读取或更新自己的 `用户ID/avatar.jpg`。
- 只在用户资料里保存图片路径，图片本身不放入登录令牌。

部署前配置：
1. 在 Supabase Authentication 的 SMTP Settings 中配置发信服务。默认发信服务仅适合受限测试，不能代替访客注册需要的正式发信配置。
2. 在 Emails 中编辑 Magic link or OTP 邮件模板，正文包含 `{{ .Token }}` 验证码。新账号的 Confirm sign up 模板也应包含验证码。
3. 在 SQL Editor 执行 `supabase/migrations/20261029000000_sora_avatars.sql`，创建私有存储桶及仅本人可读写的策略。
4. 使用真实邮箱完成发送验证码、验证、刷新保持登录、上传头像、退出登录的完整检查。

`auth-config.js` 只能放 Supabase 的 **publishable key**，禁止放 secret、service_role 或数据库密码。构建会拒绝这些不适合发布到浏览器的密钥。

验证：`node --test tests/auth-settings.test.mjs`。
