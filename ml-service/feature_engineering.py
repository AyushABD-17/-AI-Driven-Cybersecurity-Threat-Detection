"""
Feature Engineering Module
Transforms raw network log events into the 41-feature vector
expected by the trained ML models.
"""

import numpy as np
import pandas as pd

# ── Static mappings (must match training data) ───────────────────────────────

PROTOCOL_MAP = {"TCP": 0, "UDP": 1, "ICMP": 2}

FLAG_MAP = {
    "SF": 0, "S0": 1, "S1": 2, "REJ": 3, "RSTOS0": 4,
    "RSTO": 5, "SH": 6, "S2": 7, "S3": 8, "OTH": 9, "RSTR": 10,
}

# Training set statistics for normalization (approximated from KDD Cup 99)
NORMALIZATION_STATS = {
    "duration":       {"mean": 47.979, "std": 707.746, "min": 0, "max": 58329},
    "bytes_sent":     {"mean": 45004,  "std": 1100000, "min": 0, "max": 1.38e9},
    "bytes_received": {"mean": 11781,  "std": 190000,  "min": 0, "max": 1.31e8},
    "count":          {"mean": 182.0,  "std": 188.0,   "min": 0, "max": 511},
    "srv_count":      {"mean": 182.0,  "std": 188.0,   "min": 0, "max": 511},
    "num_failed_logins": {"mean": 0.002, "std": 0.065, "min": 0, "max": 5},
}

ATTACK_LABEL_MAP = {
    "normal": 0,
    "DoS":    1,
    "Probe":  2,
    "R2L":    3,
    "U2R":    4,
}

ATTACK_LABEL_REVERSE = {v: k for k, v in ATTACK_LABEL_MAP.items()}


def _clip_log_transform(value: float, min_val: float = 0) -> float:
    """Log1p transform with clipping for outlier reduction."""
    return float(np.log1p(max(value, min_val)))


def _normalize(value: float, feature: str) -> float:
    """Z-score normalization using training set statistics."""
    stats = NORMALIZATION_STATS.get(feature, {})
    mean = stats.get("mean", 0)
    std = stats.get("std", 1)
    if std == 0:
        return 0.0
    return float((value - mean) / std)


def _encode_protocol(protocol: str) -> list[float]:
    """One-hot encode protocol type → [is_tcp, is_udp, is_icmp]."""
    code = PROTOCOL_MAP.get(str(protocol).upper(), 0)
    return [float(code == 0), float(code == 1), float(code == 2)]


def _encode_flag(flag: str) -> float:
    """Ordinal encode TCP flag combination."""
    return float(FLAG_MAP.get(str(flag).upper(), 9))  # default OTH=9


def transform_single(log: dict) -> list[float]:
    """
    Transform a single raw log event dict into a 41-dimensional feature vector.

    Feature index reference:
    [0]     protocol_tcp
    [1]     protocol_udp
    [2]     protocol_icmp
    [3]     flag_encoded
    [4]     duration_norm
    [5]     bytes_sent_log
    [6]     bytes_received_log
    [7]     bytes_ratio              (sent / (received + 1))
    [8]     bytes_per_sec_sent
    [9]     bytes_per_sec_received
    [10]    src_port_norm
    [11]    dst_port_norm
    [12]    is_well_known_port       (dst_port < 1024)
    [13]    is_ephemeral_port        (src_port > 49151)
    [14]    count_norm
    [15]    srv_count_norm
    [16]    count_to_srv_ratio
    [17]    num_failed_logins_norm
    [18]    is_host_login
    [19]    is_guest_login
    [20-40] reserved / synthetic padding features (zeros for forward compat)
    """
    duration = float(log.get("duration", 0))
    bytes_sent = float(log.get("bytes_sent", 0))
    bytes_received = float(log.get("bytes_received", 0))
    src_port = float(log.get("src_port", 0))
    dst_port = float(log.get("dst_port", 0))
    count = float(log.get("count", 0))
    srv_count = float(log.get("srv_count", 0))
    num_failed_logins = float(log.get("num_failed_logins", 0))

    protocol_enc = _encode_protocol(log.get("protocol", "TCP"))
    flag_enc = _encode_flag(log.get("flag", "SF"))

    duration_norm = _normalize(duration, "duration")
    bytes_sent_log = _clip_log_transform(bytes_sent)
    bytes_received_log = _clip_log_transform(bytes_received)
    bytes_ratio = bytes_sent / (bytes_received + 1)
    bps_sent = bytes_sent / (duration + 1)
    bps_received = bytes_received / (duration + 1)

    src_port_norm = src_port / 65535.0
    dst_port_norm = dst_port / 65535.0
    is_well_known = float(dst_port < 1024)
    is_ephemeral = float(src_port > 49151)

    count_norm = _normalize(count, "count")
    srv_count_norm = _normalize(srv_count, "srv_count")
    count_srv_ratio = count / (srv_count + 1)

    failed_login_norm = _normalize(num_failed_logins, "num_failed_logins")
    is_host_login = float(bool(log.get("is_host_login", False)))
    is_guest_login = float(bool(log.get("is_guest_login", False)))

    features = [
        *protocol_enc,          # [0-2]
        flag_enc,               # [3]
        duration_norm,          # [4]
        bytes_sent_log,         # [5]
        bytes_received_log,     # [6]
        bytes_ratio,            # [7]
        bps_sent,               # [8]
        bps_received,           # [9]
        src_port_norm,          # [10]
        dst_port_norm,          # [11]
        is_well_known,          # [12]
        is_ephemeral,           # [13]
        count_norm,             # [14]
        srv_count_norm,         # [15]
        count_srv_ratio,        # [16]
        failed_login_norm,      # [17]
        is_host_login,          # [18]
        is_guest_login,         # [19]
    ]

    # Pad to 41 features with zeros (for future feature additions)
    while len(features) < 41:
        features.append(0.0)

    return features[:41]


def transform_batch(logs: list[dict]) -> pd.DataFrame:
    """Transform a list of log dicts into a DataFrame with 41 columns."""
    rows = [transform_single(log) for log in logs]
    cols = [f"f{i:02d}" for i in range(41)]
    return pd.DataFrame(rows, columns=cols)


def get_feature_names() -> list[str]:
    """Return human-readable feature names for model inspection."""
    return [
        "protocol_tcp", "protocol_udp", "protocol_icmp",
        "flag_encoded", "duration_norm",
        "bytes_sent_log", "bytes_received_log", "bytes_ratio",
        "bps_sent", "bps_received",
        "src_port_norm", "dst_port_norm", "is_well_known_port", "is_ephemeral_port",
        "count_norm", "srv_count_norm", "count_srv_ratio",
        "num_failed_logins_norm", "is_host_login", "is_guest_login",
        *[f"reserved_{i}" for i in range(21)],
    ]
