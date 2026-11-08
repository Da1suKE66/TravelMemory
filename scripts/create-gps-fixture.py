"""Generate a local-only, synthetic EXIF fixture from a verified public sample.

The image is the bundled public Unsplash Kyoto sample; date and GPS tags below
are artificial test values. This script never reads a personal photo library.
The generated JPEG is ignored by Git and must not be uploaded to the repository.
"""

import hashlib
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dist/assets/kyoto.jpg"
TARGET = ROOT / "tests/fixtures/gps-photo.jpg"
PUBLIC_SOURCE = "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=82"
SOURCE_SHA256 = "a919940c1397fbdbf550bce3fad83629b2c2b9edcdd3c7b79203cc2ca5576ecd"


def u16(value):
    return struct.pack("<H", value)


def u32(value):
    return struct.pack("<I", value)


def entry(tag, kind, count, value):
    data = u32(value) if isinstance(value, int) else value.ljust(4, b"\0")
    return u16(tag) + u16(kind) + u32(count) + data


def rational(numerator, denominator=1):
    return u32(numerator) + u32(denominator)


def main():
    photo = SOURCE.read_bytes()
    if hashlib.sha256(photo).hexdigest() != SOURCE_SHA256:
        raise SystemExit("Public source sample changed; verify sample-images.json before regenerating.")
    # Synthetic test capture: 2026-05-03 08:15:00; 35 N, 135.78 E.
    captured_at = b"2026:05:03 08:15:00\0"
    values_start = 110
    ifd0 = u16(2) + entry(0x8769, 4, 1, 38) + entry(0x8825, 4, 1, 56) + u32(0)
    exif = u16(1) + entry(0x9003, 2, len(captured_at), values_start) + u32(0)
    gps = (
        u16(4)
        + entry(1, 2, 2, b"N\0")
        + entry(2, 5, 3, values_start + len(captured_at))
        + entry(3, 2, 2, b"E\0")
        + entry(4, 5, 3, values_start + len(captured_at) + 24)
        + u32(0)
    )
    values = (
        captured_at
        + rational(35) + rational(0) + rational(0)
        + rational(135) + rational(46) + rational(48)
    )
    tiff = b"II" + u16(42) + u32(8) + ifd0 + exif + gps
    assert len(tiff) == values_start
    payload = b"Exif\0\0" + tiff + values
    fixture = photo[:2] + b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload + photo[2:]
    if TARGET.exists() and TARGET.read_bytes() != fixture:
        raise SystemExit("A different fixture already exists; move it aside before generating.")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_bytes(fixture)
    print(f"Generated local synthetic fixture: {TARGET}")
    print(f"SHA-256: {hashlib.sha256(fixture).hexdigest()}")


if __name__ == "__main__":
    main()
