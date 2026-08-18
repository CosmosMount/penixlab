import asyncio
import pytest

from app.services.board_runtime_profiles import (
    PiRuntimeProfile,
    board_runtime_registry,
    get_board_runtime_profile,
)
from app.services.qemu_manager import PI_CONFIGS
from app.services.qemu_manager import QemuManager


def test_runtime_profiles_are_registered_for_supported_backends() -> None:
    assert get_board_runtime_profile("esp32", "esp32-qemu").machine == "esp32"
    assert get_board_runtime_profile("esp32-c3", "esp32-worker").architecture == "riscv32"
    assert get_board_runtime_profile("stm32-blackpill", "stm32-worker").machine == "netduinoplus2"
    assert get_board_runtime_profile("stm32-olimex-h405", "stm32-worker").machine == "olimex-stm32-h405"


def test_unknown_board_does_not_fall_back_to_another_runtime() -> None:
    assert get_board_runtime_profile("unknown-board", "esp32-qemu") is None
    assert get_board_runtime_profile("unknown-board", "esp32-worker") is None
    assert get_board_runtime_profile("unknown-board", "stm32-worker") is None


def test_registry_has_no_duplicate_or_invalid_profiles() -> None:
    board_runtime_registry.validate()
    assert board_runtime_registry.board_ids("esp32-qemu")
    assert board_runtime_registry.board_ids("stm32-worker")


def test_pi_runtime_profiles_have_required_boot_fields() -> None:
    required = {"qemu", "cpu", "smp", "memory", "image_set", "kernel", "initramfs", "rootfs", "bus"}
    assert PI_CONFIGS
    assert all(required.issubset(config) for config in PI_CONFIGS.values())


def test_pi_profile_rejects_missing_or_blank_fields() -> None:
    with pytest.raises(ValueError, match="missing keys"):
        PiRuntimeProfile.from_mapping("broken", {"qemu": "qemu-system-arm"})

    raw = {key: "ok" for key in PiRuntimeProfile.REQUIRED_KEYS}
    raw["cpu"] = "  "
    with pytest.raises(ValueError, match="must be a non-empty string"):
        PiRuntimeProfile.from_mapping("broken", raw)


def test_unknown_pi_board_reports_error_instead_of_starting_pi3() -> None:
    events: list[tuple[str, dict]] = []

    async def callback(event_type: str, data: dict) -> None:
        events.append((event_type, data))

    async def scenario() -> None:
        QemuManager().start_instance("test-client", "unknown-board", callback)
        await asyncio.sleep(0)

    asyncio.run(scenario())
    assert events and events[0][0] == "error"
    assert "No Raspberry Pi runtime profile" in events[0][1]["message"]
