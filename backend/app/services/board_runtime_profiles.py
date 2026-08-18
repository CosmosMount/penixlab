"""Backend board runtime profiles.

The frontend describes a board's pins and capabilities, while this module
describes the backend implementation that can actually execute it. Keeping
runtime selection in one registry prevents each emulator manager from
inventing a different fallback for an unknown board.
"""

from __future__ import annotations

from dataclasses import dataclass
from collections.abc import Iterator, Mapping
from typing import ClassVar, Literal

RuntimeBackend = Literal["esp32-qemu", "esp32-worker", "stm32-worker"]


@dataclass(frozen=True, slots=True)
class BoardRuntimeProfile:
    board_id: str
    backend: RuntimeBackend
    machine: str
    architecture: str


@dataclass(frozen=True, slots=True)
class PiRuntimeProfile(Mapping[str, str | None]):
    """Validated QEMU-Linux profile shared by the Pi bridge and overlays.

    The mapping methods intentionally preserve the old ``cfg['cpu']`` and
    ``cfg.get('bus')`` call surface while making the runtime contract typed and
    immutable. This lets the QEMU command builder migrate incrementally
    without leaving a second unvalidated profile format behind.
    """

    board_id: str
    qemu: str
    cpu: str
    smp: str
    memory: str
    image_set: str
    kernel: str
    initramfs: str
    rootfs: str
    bus: str
    egress_guestfwd: str | None = None
    extra_drive: str | None = None

    REQUIRED_KEYS: ClassVar[frozenset[str]] = frozenset(
        {"qemu", "cpu", "smp", "memory", "image_set", "kernel", "initramfs", "rootfs", "bus"}
    )

    @classmethod
    def from_mapping(cls, board_id: str, raw: Mapping[str, object]) -> "PiRuntimeProfile":
        missing = cls.REQUIRED_KEYS - raw.keys()
        if missing:
            raise ValueError(
                f"pi board profile {board_id!r} missing keys: {sorted(missing)}"
            )
        values = {key: raw[key] for key in cls.REQUIRED_KEYS}
        optional = {
            key: raw[key]
            for key in ("egress_guestfwd", "extra_drive")
            if key in raw
        }
        for key, value in {**values, **optional}.items():
            if not isinstance(value, str) or not value.strip():
                raise ValueError(
                    f"pi board profile {board_id!r} field {key!r} must be a non-empty string"
                )
        return cls(board_id=board_id, **values, **optional)  # type: ignore[arg-type]

    def __getitem__(self, key: str) -> str | None:
        if key == "board_id":
            return self.board_id
        try:
            return getattr(self, key)
        except AttributeError as exc:
            raise KeyError(key) from exc

    def __iter__(self) -> Iterator[str]:
        return iter(
            (
                "qemu", "cpu", "smp", "memory", "image_set", "kernel",
                "initramfs", "rootfs", "bus", "egress_guestfwd", "extra_drive",
            )
        )

    def __len__(self) -> int:
        return 11


class BoardRuntimeRegistry:
    def __init__(self) -> None:
        self._profiles: dict[tuple[RuntimeBackend, str], BoardRuntimeProfile] = {}

    def register(self, profile: BoardRuntimeProfile) -> None:
        key = (profile.backend, profile.board_id)
        if key in self._profiles:
            raise ValueError(
                f"duplicate runtime profile: {profile.backend}:{profile.board_id}"
            )
        self._profiles[key] = profile

    def register_aliases(
        self,
        backend: RuntimeBackend,
        machine: str,
        architecture: str,
        board_ids: tuple[str, ...],
    ) -> None:
        for board_id in board_ids:
            self.register(BoardRuntimeProfile(board_id, backend, machine, architecture))

    def get(self, board_id: str, backend: RuntimeBackend) -> BoardRuntimeProfile | None:
        return self._profiles.get((backend, board_id))

    def board_ids(self, backend: RuntimeBackend) -> tuple[str, ...]:
        return tuple(
            board_id
            for current_backend, board_id in self._profiles
            if current_backend == backend
        )

    def validate(self) -> None:
        for profile in self._profiles.values():
            if not profile.board_id.strip():
                raise ValueError("runtime profile board_id cannot be empty")
            if not profile.machine.strip():
                raise ValueError(f"runtime profile {profile.board_id!r} has no machine")
            if not profile.architecture.strip():
                raise ValueError(
                    f"runtime profile {profile.board_id!r} has no architecture"
                )


board_runtime_registry = BoardRuntimeRegistry()


def _register_defaults() -> None:
    board_runtime_registry.register_aliases(
        "esp32-qemu", "esp32", "xtensa", ("esp32",)
    )
    board_runtime_registry.register_aliases(
        "esp32-qemu", "esp32s3", "xtensa", ("esp32-s3",)
    )
    board_runtime_registry.register_aliases(
        "esp32-qemu", "esp32c3", "riscv32", ("esp32-c3",)
    )

    board_runtime_registry.register_aliases(
        "esp32-worker", "esp32-picsimlab", "xtensa", ("esp32",)
    )
    board_runtime_registry.register_aliases(
        "esp32-worker", "esp32s3-picsimlab", "xtensa", ("esp32-s3",)
    )
    board_runtime_registry.register_aliases(
        "esp32-worker",
        "esp32c3-picsimlab",
        "riscv32",
        ("esp32-c3", "xiao-esp32-c3", "aitewinrobot-esp32c3-supermini"),
    )

    board_runtime_registry.register_aliases(
        "stm32-worker",
        "stm32vldiscovery",
        "arm",
        ("stm32-bluepill", "stm32-bluepill-f103cb", "stm32-vldiscovery"),
    )
    board_runtime_registry.register_aliases(
        "stm32-worker",
        "netduinoplus2",
        "arm",
        (
            "stm32-blackpill",
            "stm32-blackpill-f401",
            "stm32-f4-discovery",
            "stm32-netduino-plus2",
            "stm32f4-discovery",
            "netduinoplus2",
        ),
    )
    board_runtime_registry.register_aliases(
        "stm32-worker",
        "olimex-stm32-h405",
        "arm",
        ("stm32-olimex-h405", "olimex-stm32-h405"),
    )
    board_runtime_registry.register_aliases(
        "stm32-worker", "netduino2", "arm", ("stm32-netduino2", "netduino2")
    )


_register_defaults()
board_runtime_registry.validate()


def get_board_runtime_profile(
    board_id: str, backend: RuntimeBackend
) -> BoardRuntimeProfile | None:
    return board_runtime_registry.get(board_id, backend)
