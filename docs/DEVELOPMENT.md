# 开发、测试与排障

## 环境

- Node.js 20+、npm；
- Python 3.11+；
- Arduino 编译：`arduino-cli`；
- ESP32：ESP-IDF 和对应 QEMU/Worker 资源；
- 自定义芯片：clang/WASI SDK；
- Raspberry Pi 或其他 Linux 运行时：QEMU、内核和镜像资源。

后四项按功能可选。缺少它们时，编辑器、基础拓扑和不依赖该工具链的测试仍可使用，但相应能力应显示为不可用。

## 安装和启动

```bash
npm install
npm install --prefix frontend
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m pip install pytest
```

启动两个服务：

```bash
npm run dev -- --host 127.0.0.1 --port 5173
npm run backend:dev
```

浏览器访问 `http://127.0.0.1:5173`，后端检查 `http://127.0.0.1:8766/health`。不要使用 `file://` 直接打开 `frontend/index.html`。

## 验证命令

```bash
# 后端单元测试
python -m pytest backend/tests -q

# 前端测试和生产构建
npm test
npm run build

# 修改文档或配置时
git diff --check
```

涉及特定板卡时，额外检查对应的工具链、QEMU 镜像和后端健康状态；不要把本机缺少工具链误判为 Profile 或 UI 代码错误。

## 修改约定

- 板卡能力进入 `BoardProfile` 和后端运行时注册表；不要在多个组件中复制板卡判断。
- 连接规则进入 PinManager，组件只声明 PinInfo 和自身行为。
- 新增运行时必须有明确的启动、停止、复位、日志和错误语义。
- 支持等级要与真实能力一致：只有拓扑、编译、数字或混合信号能力时，不要标为完整支持。
- 辅助分析、计划和调试记录统一放在 `.agents/`；该目录不应提交到仓库。

更多模块关系见 [系统架构](ARCHITECTURE.md)，板卡接入见 [板卡扩展与 C++ 编译](BOARD_EXTENSIONS.md)。
