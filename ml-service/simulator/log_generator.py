"""
AI-Driven Cybersecurity Threat Detection Dashboard
Log Simulator — generates realistic network log events and publishes to Redis.

Usage:
    python log_generator.py [--rate 10] [--attack-rate 0.15]

Environment:
    REDIS_URL — Redis connection string (default: redis://localhost:6379)
"""

import argparse
import json
import os
import random
import time
from datetime import datetime, timezone

import redis
from dotenv import load_dotenv

load_dotenv()

# ── Traffic profiles ──────────────────────────────────────────────────────────

NORMAL_PROFILE = {
    "protocols": ["TCP", "UDP", "ICMP"],
    "protocol_weights": [0.7, 0.2, 0.1],
    "flags": ["SF", "S0", "S1", "REJ", "RSTOS0"],
    "flag_weights": [0.8, 0.05, 0.05, 0.05, 0.05],
    "duration": (0, 120),
    "bytes_sent": (64, 50000),
    "bytes_received": (64, 80000),
    "num_failed_logins": (0, 0),
    "count": (1, 50),
    "srv_count": (1, 30),
}

ATTACK_PROFILES = {
    "DoS": {
        "protocols": ["TCP", "UDP", "ICMP"],
        "protocol_weights": [0.5, 0.3, 0.2],
        "flags": ["S0", "REJ", "RSTO"],
        "flag_weights": [0.6, 0.2, 0.2],
        "duration": (0, 2),
        "bytes_sent": (40, 1500),
        "bytes_received": (0, 100),
        "num_failed_logins": (0, 0),
        "count": (200, 511),
        "srv_count": (200, 511),
        "src_port": (1024, 65535),
        "dst_port_choices": [80, 443, 8080, 53],
    },
    "Probe": {
        "protocols": ["TCP", "UDP"],
        "protocol_weights": [0.6, 0.4],
        "flags": ["S0", "REJ", "SF"],
        "flag_weights": [0.4, 0.4, 0.2],
        "duration": (0, 5),
        "bytes_sent": (0, 500),
        "bytes_received": (0, 200),
        "num_failed_logins": (0, 0),
        "count": (100, 511),
        "srv_count": (1, 20),
        "src_port": (1024, 65535),
        "dst_port_choices": list(range(1, 1025)),
    },
    "R2L": {
        "protocols": ["TCP"],
        "protocol_weights": [1.0],
        "flags": ["SF", "S1"],
        "flag_weights": [0.7, 0.3],
        "duration": (5, 300),
        "bytes_sent": (200, 10000),
        "bytes_received": (200, 5000),
        "num_failed_logins": (3, 20),
        "count": (1, 10),
        "srv_count": (1, 5),
        "src_port": (1024, 65535),
        "dst_port_choices": [22, 23, 21, 3389, 5900],
    },
    "U2R": {
        "protocols": ["TCP"],
        "protocol_weights": [1.0],
        "flags": ["SF", "S1"],
        "flag_weights": [0.8, 0.2],
        "duration": (10, 600),
        "bytes_sent": (500, 50000),
        "bytes_received": (200, 20000),
        "num_failed_logins": (5, 30),
        "count": (1, 5),
        "srv_count": (1, 3),
        "src_port": (1024, 65535),
        "dst_port_choices": [22, 80, 443, 8080],
    },
}

# Realistic IP pools
NORMAL_SRC_IPS = [f"192.168.{r}.{h}" for r in range(1, 5) for h in range(10, 50)]
NORMAL_DST_IPS = [f"10.0.{r}.{h}" for r in range(0, 3) for h in range(1, 20)]
ATTACK_SRC_IPS = [
    f"{a}.{b}.{c}.{d}"
    for a, b, c, d in [
        (45, 33, 12, 7), (185, 220, 101, 45), (91, 108, 4, 123),
        (77, 88, 8, 8), (194, 165, 146, 12), (23, 91, 8, 99),
        (103, 21, 244, 55), (198, 41, 214, 67),
    ]
]


def random_ip(pool: list) -> str:
    return random.choice(pool)


def random_port(low=1024, high=65535) -> int:
    return random.randint(low, high)


def generate_event(attack_type: str | None = None) -> dict:
    """Generate a single network log event."""
    is_attack = attack_type is not None

    if is_attack:
        profile = ATTACK_PROFILES[attack_type]
        src_ip = random_ip(ATTACK_SRC_IPS)
        dst_ip = random_ip(NORMAL_DST_IPS)
        src_port = random_port(*profile.get("src_port", (1024, 65535)))
        dst_port = random.choice(profile.get("dst_port_choices", [80, 443]))
        is_guest_login = attack_type in ("R2L", "U2R") and random.random() < 0.3
        is_host_login = attack_type == "U2R" and random.random() < 0.2
    else:
        profile = NORMAL_PROFILE
        src_ip = random_ip(NORMAL_SRC_IPS)
        dst_ip = random_ip(NORMAL_DST_IPS)
        src_port = random_port()
        dst_port = random.choice([80, 443, 8080, 22, 53, 3306, 5432])
        is_guest_login = False
        is_host_login = random.random() < 0.05

    protocol = random.choices(profile["protocols"], weights=profile["protocol_weights"])[0]
    flag = random.choices(profile["flags"], weights=profile["flag_weights"])[0]
    duration = random.uniform(*profile["duration"])
    bytes_sent = random.randint(*profile["bytes_sent"])
    bytes_received = random.randint(*profile["bytes_received"])

    return {
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "src_port": src_port,
        "dst_port": dst_port,
        "protocol": protocol,
        "flag": flag,
        "duration": round(duration, 3),
        "bytes_sent": bytes_sent,
        "bytes_received": bytes_received,
        "num_failed_logins": random.randint(*profile["num_failed_logins"]),
        "is_host_login": is_host_login,
        "is_guest_login": is_guest_login,
        "count": random.randint(*profile["count"]),
        "srv_count": random.randint(*profile["srv_count"]),
        # Ground truth label (used by ML service for supervised training, not for inference)
        "label": attack_type if is_attack else "normal",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Network Log Simulator")
    parser.add_argument("--rate", type=float, default=float(os.getenv("LOG_RATE", "10")),
                        help="Events per second (default: 10)")
    parser.add_argument("--attack-rate", type=float, default=float(os.getenv("ATTACK_RATE", "0.15")),
                        help="Fraction of events that are attacks (default: 0.15)")
    args = parser.parse_args()

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    client = redis.from_url(redis_url, decode_responses=True)
    client.ping()  # Fail fast if Redis is not reachable

    interval = 1.0 / args.rate
    attack_types = list(ATTACK_PROFILES.keys())

    print(f"[Simulator] Started — {args.rate} events/sec, {args.attack_rate*100:.0f}% attack rate")
    print(f"[Simulator] Publishing to Redis: {redis_url} → logs:raw")

    total_sent = 0
    total_attacks = 0
    last_report = time.time()

    try:
        while True:
            is_attack = random.random() < args.attack_rate
            attack_type = random.choice(attack_types) if is_attack else None
            event = generate_event(attack_type)

            client.publish("logs:raw", json.dumps(event))
            total_sent += 1
            if is_attack:
                total_attacks += 1

            # Print stats every 10 seconds
            if time.time() - last_report >= 10:
                print(
                    f"[Simulator] Sent: {total_sent} | Attacks: {total_attacks} "
                    f"({total_attacks/total_sent*100:.1f}%) | Rate: {args.rate}/s"
                )
                last_report = time.time()

            time.sleep(interval)

    except KeyboardInterrupt:
        print(f"\n[Simulator] Stopped. Total sent: {total_sent}, attacks: {total_attacks}")
    except redis.exceptions.ConnectionError as e:
        print(f"[Simulator] Redis connection error: {e}")
        raise


if __name__ == "__main__":
    main()
