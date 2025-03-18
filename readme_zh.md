# Bilibili视频解析工具

## 项目概述
基于Flask框架开发的B站视频解析工具，提供二维码登录、视频元数据解析、多清晰度下载等功能。整合了Bilibili网页端API，实现完整的用户登录态维护机制和视频处理流程。

## 核心功能模块

### 1. 认证登录模块
- 二维码生成接口 `/generate_qrcode`
- 登录状态轮询机制
- Cookie持久化存储（CSV文件）
- 多设备登录状态维护

### 2. 视频解析模块
- 支持BV/EP/SS号识别
- 视频元数据提取（标题/描述/类型）
- 分P视频信息获取
- 多画质流地址解析

### 3. 下载引擎模块
- 音视频分离下载
- 自动画质匹配
- 下载进度追踪
- 文件合并处理

## 接口文档

### 主要接口说明

#### 1. 二维码登录接口
`GET /generate_qrcode`
```json
响应示例：
{
  "is_logged_in": false,
  "qrcode_key": "3c1fd1e6",
  "qrcode_url": "/get_qrcode_image?qrcode_key=3c1fd1e6"
}
```

#### 2. 视频解析接口
`GET /parse_video?input=BV1xx411x7xx`
```json
响应示例：
{
  "title": "测试视频",
  "desc": "视频描述内容",
  "type": "video",
  "bvid": "BV1xx411x7xx",
  "qualities": [
    {"id": 80, "name": "高清 1080P"},
    {"id": 64, "name": "高清 720P"}
  ]
}
```

#### 3. 视频下载接口
`GET /download?bvid=BV1xx411x7xx&cid=12345&quality=80`
```json
响应示例：
{
  "message": "下载成功",
  "video_file": "download/BV1xx411x7xx.mp4",
  "audio_file": "download/BV1xx411x7xx.mp3"
}
```

## 技术特性
1. **登录态保持**：采用Cookie持久化存储，支持服务重启后自动恢复登录
2. **智能解析**：自动识别视频ID格式（BV/EP/SS）
3. **多线程处理**：二维码状态轮询与下载任务异步执行
4. **安全机制**：敏感信息加密存储，请求头完整模拟浏览器环境

## 环境要求
```
Python 3.8+
Flask==2.0.1
qrcode[pil]==7.3.1
requests==2.26.0
```

## 快速启动
```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
flask run --host=0.0.0.0 --port=5000
```

## 项目结构
```
├── py.py             # 主服务程序
├── templates/        # 前端模板
│   └── index.html   # 用户操作界面
├── download/         # 下载文件存储
├── login_data.csv    # 登录状态记录
└── requirements.txt  # 依赖清单
```

## 高级配置
- 修改`HEADERS`常量模拟不同浏览器环境
- 调整`poll_qrcode_status`轮询间隔时间
- 配置CSV存储路径实现多用户支持

## 注意事项
1. 需保持网络通畅以正常访问B站API
2. 下载高画质视频需要大会员账号
3. 建议部署在境外服务器避免地域限制