import pytest

from app.mcp.wokwi import format_wokwi_diagram, parse_wokwi_diagram


def test_parse_wokwi_requires_a_supported_board():
    with pytest.raises(ValueError, match="does not contain a supported board"):
        parse_wokwi_diagram({"parts": [{"type": "wokwi-led", "id": "led1"}]})


def test_format_wokwi_requires_an_explicit_supported_board():
    with pytest.raises(ValueError, match="circuit.board_fqbn is required"):
        format_wokwi_diagram({"components": [], "connections": []})

    with pytest.raises(ValueError, match="Unsupported board FQBN"):
        format_wokwi_diagram({"board_fqbn": "unknown:vendor:board"})


def test_format_wokwi_keeps_the_selected_board_identity():
    result = format_wokwi_diagram({"board_fqbn": "rp2040:rp2040:rpipico"})
    assert result["parts"][0]["type"] == "wokwi-pi-pico"
