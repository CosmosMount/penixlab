# 系统架构

PenixLab 由浏览器端编辑器、板卡/组件注册层、仿真运行时和可选后端服务组成。各层通过明确的 Profile、引脚元数据和固件产物连接，避免把板卡判断散落在 UI 中。

## 分层

```text
浏览器
  React + TypeScript + Vite
    编辑器 / Zustand 状态 / 画布
      BoardRegistry + ComponentRegistry + PinManager
        AVR8 / RP2040 / 浏览器运行时
        QEMU/WebSocket 后端运行时
        ngspice-WASM / 自定义芯片 WASM

后端 FastAPI
  编译服务（Arduino、ESP-IDF 等）
  板卡运行时 Profile
  QEMU/Worker 桥接、串口和健康检查
```

## 关键目录

| 目录 | 职责 |
| --- | --- |
| `frontend/src/boards/` | `BoardProfile`、板卡注册表、引脚和渲染器 |
| `frontend/src/components/` | 元件目录、PinInfo、画布元件和元数据 |
| `frontend/src/simulation/` | MCU、数字/模拟网络和自定义芯片运行时 |
| `frontend/src/store/` | 编辑器、仿真、编译和项目状态 |
| `backend/app/api/` | 编译、运行、WebSocket 等 HTTP 接口 |
| `backend/app/services/` | 工具链、QEMU 和后端板卡运行时 |

## 两条主要数据流

### 固件执行

1. 编辑器收集板卡工程中的 `.ino`、`.cpp`、`.c` 和头文件。
2. 前端根据板卡 Profile 选择编译目标，把源文件提交给后端或本地运行时。
3. 编译服务返回固件、日志和错误；运行时使用 Profile 规定的机器、架构和产物格式启动。
4. 串口、GPIO、总线事件通过 PinManager 和 WebSocket 回传画布。

### 电路仿真

1. 组件通过 PinInfo 描述数字、模拟和协议引脚。
2. 连线交给 PinManager 统一解析，数字状态进入 MCU/组件运行时。
3. 包含模拟模型的网络交给 ngspice-WASM；数字和模拟结果再汇入统一的画布状态。

## 扩展边界

- 新板卡先增加前端 `BoardProfile`，再按需要增加独立的 renderer、编译适配器和运行时 Profile。
- 后端运行时注册在 `backend/app/services/board_runtime_profiles.py`，不应通过未知板卡静默回退到另一块板。
- 协议、供电和引脚别名必须由 Profile 声明；组件不应自行猜测板卡引脚。
- 只增加 UI 展示而没有编译或运行时能力时，应将支持等级明确标为拓扑或编译，而不是标记为完整仿真。

更具体的接入步骤见 [板卡扩展与 C++ 编译](BOARD_EXTENSIONS.md)，运行时选择见 [仿真运行时](SIMULATION.md)。
