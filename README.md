# PenixLab

PenixLab 是一个面向嵌入式开发与电子实验的本地电路仿真工作台。它将浏览器中的可视化电路编辑器、真实 MCU 固件仿真、SPICE 模拟和后端编译/运行服务组合在一起。

项目当前支持 Arduino AVR、RP2040、ESP32、STM32 和 Raspberry Pi 系列板卡，以及数字器件、传感器、显示器和基础模拟器件。板卡描述、引脚、电源、协议、编译目标和运行时后端统一由 Profile 注册表管理，便于扩展新的 BSP。

## 特性

- 可拖拽、连线的浏览器电路编辑器
- AVR8、RP2040、ESP32、STM32 和 Raspberry Pi 运行时
- 数字仿真与 ngspice-WASM 混合信号仿真
- Arduino C++、MicroPython 和 ESP-IDF 工程编译
- ADC、PWM、UART、I²C、SPI 以及多板卡互连
- 组件、板卡和运行时的注册式扩展接口
- `.vlx` 项目文件导入导出

## 项目结构

```text
penixlab/
├── frontend/                 # React + TypeScript + Vite 编辑器和仿真画布
│   └── src/boards/            # BoardProfile、BoardRegistry 和板卡渲染器
├── backend/                  # FastAPI、编译服务和 QEMU 桥接
│   ├── app/services/          # 工具链、运行时和板卡 Profile
│   └── tests/                 # 后端单元测试
├── docs/                     # 仿真、工具链和扩展技术文档
├── scripts/                  # 元数据和资源生成脚本
└── test/test_circuit/        # 电路求解器和混合仿真测试
```

## 环境要求

- Node.js 20 或更高版本
- Python 3.11 或更高版本
- 可选：`arduino-cli`，用于本地 Arduino 编译
- 可选：ESP-IDF 和 QEMU 运行库，用于对应板卡后端

## 安装

```bash
# 根目录工具
npm install

# 前端依赖
npm install --prefix frontend

# 后端依赖
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m pip install pytest
```

## 本地启动

从项目根目录启动前端：

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

另开终端启动后端：

```bash
npm run backend:dev
```

默认地址：

- 前端：<http://127.0.0.1:5173>
- 后端健康检查：<http://127.0.0.1:8766/health>

不要直接双击 `frontend/index.html` 以 `file://` 方式打开；该入口包含 Vite 的 TypeScript 模块和 SPA 资源，必须通过上述开发服务器或生产静态服务器访问。

也可以直接在 `frontend/` 目录执行 `npm run dev`、`npm test` 和 `npm run build`。

## 测试与构建

```bash
# 后端
python -m pytest backend/tests -q

# 前端全量测试
npm test

# 前端生产构建
npm run build
```

部分运行时能力依赖本机工具链或二进制资源。缺少 ESP-IDF、`arduino-cli` 或 QEMU 运行库时，应用和基础测试仍可启动，但对应板卡能力会被禁用或报告为不可用。

## 板卡扩展

前端板卡通过 `frontend/src/boards/` 中的 `BoardProfile` 注册。新增板卡建议按下面的边界实现：

1. 在独立的 Profile 文件中声明显示名称、编译目标和能力集合；
2. 明确引脚别名、数字映射、电源、地、ADC 和 UART/I²C/SPI 角色；
3. 为仿真运行时提供独立 adapter，不要把板卡判断散落到画布和工具栏；
4. 为固件产物定义格式、启动/停止/复位语义和硬件烧录能力；
5. 增加对应的 renderer、缩略图、示例工程和 Profile/编译测试。

后端 QEMU 板卡运行时 Profile 位于 `backend/app/services/board_runtime_profiles.py`。未知板卡不会静默回退到其他板卡。

### C++ 编辑与编译

可以直接在编辑器中编写 C++。Monaco 编辑器会把 `.ino`、`.cpp`、`.cc`、`.c`、`.h` 和 `.hpp` 文件按 C/C++ 语法高亮；文件放在对应板卡的文件组中，点击工具栏的“Compile”即可将整组源文件提交给后端。

- Arduino 模式由 `arduino-cli` 编译，至少需要一个 `.ino` 入口文件，头文件和 `.cpp` 文件会随工程一起提交；
- ESP32 的 Arduino/ESP-IDF 模式由后端对应工具链编译，ESP-IDF 工程可使用 `app_main()`、组件头文件和 C/C++ 源文件；
- 自定义芯片在“Custom Chip”编辑器中编写 C 源码，由后端编译成 WebAssembly 后加载到仿真运行时；
- 浏览器只负责编辑和提交源代码，不包含完整的本地 C++ 工具链。若本机没有 `arduino-cli`、ESP-IDF、WASI SDK 或相关 QEMU 资源，编译按钮会在编译控制台报告缺失能力。

推荐的板卡扩展顺序是：先新增 `BoardProfile` 和引脚/能力测试，再接入 renderer 与示例，最后在后端增加对应编译器或运行时 adapter。这样 UI、固件编译和仿真执行可以分别演进，也不会因为新增板卡影响已有板卡。

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [组件系统](docs/components.md)
- [电路仿真文档](docs/wiki/circuit-emulation.md)
- [ESP32 仿真](docs/ESP32_EMULATION.md)
- [RP2040 仿真](docs/RP2040_EMULATION.md)
- [自定义芯片](docs/CUSTOM_CHIPS.md)
- [第三方依赖](docs/THIRD_PARTY.md)

## 许可证

本项目使用仓库根目录 [LICENSE](LICENSE) 中声明的许可证。第三方依赖遵循各自的许可证，详见 [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md)。
