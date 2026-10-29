# Sora's Garden · v2

独立的第二版导航原型，主页面内容暂留空。

- 线上入口：https://suiflower.github.io/v2/
- Home / Posts / About 各有独立页面，导航选中状态随页面变化。
- 圆角导航栏固定在视口上方，滚动后显示稍明显的阴影。
- 浅色、深色都使用纯色，主题会在浏览器中保存。
- 复用原博客的头像和思源宋体；原博客首页保持独立。

编辑位置：
- `index.html`、`posts/index.html`、`about/index.html`：对应页面的导航与空白主体。
- `assets/style.css`：布局、尺寸、颜色。
- `assets/theme.js`、`assets/site.js`：主题初始化与交互。

在仓库根目录运行 `npm.cmd run build` 和 `npm.cmd run dev`，打开 http://127.0.0.1:4173/v2/。

主体保留了两屏空白高度，方便验证导航栏滚动固定；加入实际内容时可调整 `.page-content` 的 `min-height`。
