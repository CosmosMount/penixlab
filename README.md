# PenixLab

PenixLab 是一个面向嵌入式开发与电子实验的本地电路仿真工作台。它把浏览器电路编辑器、MCU 固件运行时、SPICE 模拟和后端编译服务组合在一起。

当前工程覆盖 AVR、RP2040、ESP32、STM32 和 Raspberry Pi 运行时，并通过板卡 Profile、组件注册表和 PinManager 统一描述硬件连接。

## 快速开始

环境要求：Node.js 20+、Python 3.11+。Arduino、ESP-IDF、QEMU 和 WASI SDK 仅在使用对应能力时需要。

```bash
npm install
npm install --prefix frontend
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m pip install pytest
```

启动前端和后端：

```bash
npm run dev -- --host 127.0.0.1 --port 5173
npm run backend:dev
```

访问 <http://127.0.0.1:5173>，后端健康检查为 <http://127.0.0.1:8766/health>。

不要直接双击 `frontend/index.html`。它依赖 Vite 的模块解析和 SPA 路由，必须通过开发服务器或生产静态服务器访问。

## 常用命令

```bash
python -m pytest backend/tests -q
npm test
npm run build
```

## 代码结构

```text
frontend/src/boards/       板卡 Profile、注册表和渲染器
frontend/src/simulation/   MCU、SPICE、自定义芯片运行时
frontend/src/components/   元件目录、引脚元数据和画布组件
backend/app/api/           HTTP/WebSocket 接口
backend/app/services/      编译器、QEMU 和后端运行时
docs/                      稳定的技术文档入口
```

## 文档入口

- [系统架构](docs/ARCHITECTURE.md)
- [板卡扩展与 C++ 编译](docs/BOARD_EXTENSIONS.md)
- [仿真运行时](docs/SIMULATION.md)
- [自定义芯片与 WASM](docs/CUSTOM_CHIPS.md)
- [开发、测试与排障](docs/DEVELOPMENT.md)
- [第三方依赖与许可证](docs/THIRD_PARTY.md)

## 许可证

项目许可证见根目录 [LICENSE](LICENSE)，第三方依赖归属见 [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md)。
