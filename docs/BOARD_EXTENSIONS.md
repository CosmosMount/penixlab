# 板卡扩展与 C++ 编译

板卡由前端 `BoardProfile` 描述，由后端运行时 Profile 和编译适配器提供实际执行能力。这样可以先支持拓扑编辑，再逐步增加编译、数字仿真或混合信号能力。

## BoardProfile 的最小契约

定义位置：`frontend/src/boards/types.ts`；注册和校验位置：`frontend/src/boards/BoardRegistry.ts`。

Profile 至少应明确：

- `id`、显示名称、`fqbn` 和运行时 backend；
- 逻辑电压、地/电源引脚及辅助电源；
- 支持语言和支持等级：`topology`、`compile`、`digital`、`mixed-signal` 或 `full`；
- ADC、PWM、UART、I²C、SPI 等能力；
- 引脚别名、协议角色和 `resolvePin()` 映射。

示意代码：

```ts
registerBoardProfile({
  id: 'my-board',
  displayName: 'My Board',
  fqbn: 'vendor:arch:my-board',
  runtime: { backend: 'custom', artifact: 'firmware.bin' },
  power: { logicVoltage: 3.3, groundPins: ['GND'], supplyPins: ['3V3'] },
  capabilities: {
    support: 'compile',
    languages: ['arduino'],
    adcChannels: 4,
    pwm: true,
    protocols: ['uart', 'i2c'],
    electricalSimulation: false,
  },
  adcPins: ['A0'],
  protocolRoles: [],
  resolvePin: (name) => name,
});
```

实际字段以 `types.ts` 为准；注册表会检查重复别名、ADC 范围和空字段。新增 Profile 后应补充注册表测试和至少一个可运行示例。

## 推荐接入顺序

1. **声明 Profile**：完成引脚、电源、协议和支持等级，不在画布组件中写板卡特判。
2. **接入外观**：增加 renderer、引脚坐标、缩略图和 `pinInfo`，保证连线使用同一套 pin 名称。
3. **接入编译**：在后端增加工具链或 adapter，定义源文件、目标参数和固件产物格式。
4. **接入运行时**：增加启动、停止、复位、串口和 GPIO/协议事件的生命周期；QEMU/Worker Profile 放在 `backend/app/services/board_runtime_profiles.py`。
5. **分级验证**：先测 Profile 和引脚解析，再测编译产物，最后测真实运行时和跨板卡连线。

未知板卡必须报错或标记为不可用，不能静默复用另一块板的机器配置。

## 是否可以使用 C++ 编辑

可以。Monaco 编辑器支持 `.ino`、`.cpp`、`.cc`、`.c`、`.h` 和 `.hpp` 文件；编译时整组源文件会按当前板卡和语言提交。

- Arduino 工程通常需要一个 `.ino` 入口文件，`.cpp` 和头文件随工程一起编译；
- ESP-IDF 工程使用其标准目录和 `app_main()`，C 与 C++ 文件由 ESP-IDF 工具链处理；
- 浏览器负责编辑、保存和提交源码，不内置完整的本地 C++ 编译器；
- 本地编译需要安装对应工具链，例如 `arduino-cli` 或 ESP-IDF。自定义芯片的 C 源码则使用 WASI SDK 编译成 WASM，流程见 [自定义芯片与 WASM](CUSTOM_CHIPS.md)。

因此，新增板卡并不等于新增一个编辑器。关键是为该板卡提供明确的编译目标、工具链检查、产物格式和运行时适配器。
