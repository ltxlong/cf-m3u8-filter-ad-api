# cf-m3u8-filter-ad-api
m3u8过滤插播广告api，fork本项目后直接部署到cloudflare pages

# 调用：
video的链接由原来的视频链接，替换为pages.dev?url=视频链接

### 说明：
php版本和cf worker版本的代码在API.md

cloudflare worker 和 cloudflare pages 的版本可以配置环境变量 VIOLENT_FILTER_MODE_FLAG，值为 true 或 false；
若为true，则固定为暴力拆解过滤模式；不配置 或者 为false，则为自动判断过滤模式（推荐用默认的自动判断过滤模式）
