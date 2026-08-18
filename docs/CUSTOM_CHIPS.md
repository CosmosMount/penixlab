# 自定义芯片与 WASM

自定义芯片用 C 描述器件逻辑，由后端编译为 WebAssembly，再作为画布元件加载。它适合补充 MCU 仿真中没有的传感器、协议从设备、存储器和简单协处理器。

## 文件和运行模型

一个芯片通常包含：

```text
my-chip.c          C 源码
my-chip.chip.json  引脚、属性和显示元数据
```

C 源码使用当前 SDK 头文件 `backend/sdk/velxio-chip.h`，导出 `void chip_setup(void)`。运行时调用该入口后，芯片通过回调响应引脚边沿、GPIO、I²C、SPI、UART 或定时器事件；不要在芯片中创建阻塞式永久循环。

每个画布实例拥有独立的 WASM 实例和线性内存。引脚、属性和协议在 `chip_setup()` 中注册，画布连接通过统一 PinManager 接入。

## 最小示例

```c
#include "velxio-chip.h"

static vx_pin out;

static void on_input_change(void *user_data, vx_pin pin, int value) {
  (void)user_data;
  (void)pin;
  vx_pin_write(out, value ? VX_LOW : VX_HIGH);
}

void chip_setup(void) {
  vx_pin input = vx_pin_register("IN", VX_INPUT);
  out = vx_pin_register("OUT", VX_OUTPUT_LOW);
  vx_pin_watch(input, VX_EDGE_BOTH, on_input_change, 0);
}
```

回调 `on_input_change` 应只做小范围状态更新并尽快返回。实际可用的 GPIO、总线和属性 API 以 SDK 头文件为准。

## 元数据

`chip.json` 至少应声明名称和引脚；`attributes` 可暴露可编辑参数，`display` 可声明帧缓冲尺寸：

```json
{
  "schema": "velxio-chip/v1",
  "name": "Inverter",
  "pins": ["IN", "OUT", "VCC", "GND"],
  "attributes": [
    { "name": "threshold", "type": "int", "default": 1, "min": 0, "max": 10 }
  ]
}
```

该 schema 和头文件名称是当前运行时的兼容接口；新增代码应把它们视为稳定 ABI，不要自行改变结构布局或导出函数名称。

## 编译和加载流程

1. 在自定义芯片编辑器中填写 `sourceC` 和 `chipJson`。
2. 前端调用 `POST /api/compile-chip/`，请求体为 `{ "source": "...", "chip_json": "..." }`。
3. 后端使用 clang/WASI SDK 和 SDK 头文件编译 C 源码，返回 `wasm_base64`、日志、错误和 `byte_size`。
4. 编译成功后将结果写入元件属性 `wasmBase64`，`ChipRuntime` 在仿真启动时实例化它。
5. 运行时验证 `chip_setup`、引脚和协议注册；失败时应显示编译或运行时错误，而不是静默放置一个无效芯片。

前端入口：`frontend/src/simulation/customChips/`；后端编译服务：`backend/app/services/chip_compile.py`；接口实现：`backend/app/api/routes/compile_chip.py`。

## 环境与验证

自定义芯片编译需要后端可找到 WASI SDK 和 `backend/sdk/velxio-chip.h`。先访问 `/api/compile-chip/status`，再检查编译日志。修改 SDK、ABI 或运行时后，应同时验证：

- C 源码能否编译并导出 `chip_setup`；
- 单实例引脚读写和回调行为；
- 两个实例之间没有共享状态；
- I²C/SPI/UART 等总线能与对应组件或板卡连通；
- 无效 JSON、缺失引脚和 WASM 加载失败会被明确报告。

板卡级运行时的扩展见 [板卡扩展与 C++ 编译](BOARD_EXTENSIONS.md)。
