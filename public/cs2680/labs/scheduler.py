#!/usr/bin/env python3
"""Deterministic decode scheduling model; no GPU, prefill, or wall-clock timing."""

import argparse
import json
from dataclasses import dataclass


@dataclass(frozen=True)
class Request:
    request_id: str
    arrival_tick: int
    output_tokens: int


DEFAULT_REQUESTS = tuple(Request(f"r{index + 1}", 0, length)
                         for index, length in enumerate((1, 8, 1, 8, 1, 8)))


def simulate(requests=DEFAULT_REQUESTS, capacity=2, mode="continuous"):
    """FCFS; one token per active request per tick; zero scheduling overhead.

    A tick covers [t, t+1). Arrivals and new admissions occur at t. Finishes occur
    at t+1. Static batching waits for the entire admitted batch to finish before
    admitting another batch; a short request still completes at its own finish.
    """
    if type(capacity) is not int or capacity <= 0:
        raise ValueError("capacity must be a positive integer")
    if mode not in ("static", "continuous"):
        raise ValueError("mode must be static or continuous")
    requests = list(requests)
    ids = [request.request_id for request in requests]
    if len(ids) != len(set(ids)):
        raise ValueError("request IDs must be unique")
    for request in requests:
        if not isinstance(request.request_id, str) or not request.request_id:
            raise ValueError("request ID must be a non-empty string")
        if type(request.arrival_tick) is not int or request.arrival_tick < 0:
            raise ValueError("arrival_tick must be a non-negative integer")
        if type(request.output_tokens) is not int or request.output_tokens <= 0:
            raise ValueError("output_tokens must be a positive integer")
    if not requests:
        return {"mode": mode, "capacity": capacity, "request_count": 0,
                "elapsed_ticks": 0, "output_tokens": 0, "tokens_per_tick": 0.0,
                "requests_per_tick": 0.0, "mean_completion_latency_ticks": 0.0,
                "max_completion_latency_ticks": 0, "completions": [], "timeline": []}

    # Python's stable sort preserves input order for requests arriving together.
    future = sorted(requests, key=lambda request: request.arrival_tick)
    tick = future[0].arrival_tick
    first_arrival = tick
    pending, active, completed, timeline = [], [], [], []
    while future or pending or active:
        while future and future[0].arrival_tick <= tick:
            pending.append(future.pop(0))
        if mode == "continuous" or not active:
            while pending and len(active) < capacity:
                request = pending.pop(0)
                active.append({"request": request, "remaining": request.output_tokens,
                               "start_tick": tick})
        if not active:
            # Skip empty time without a huge timeline, but elapsed time retains it.
            tick = future[0].arrival_tick
            continue
        timeline.append({"tick": tick, "active": [item["request"].request_id for item in active]})
        for item in active:
            item["remaining"] -= 1
        tick += 1
        finished = [item for item in active if item["remaining"] == 0]
        for item in finished:
            request = item["request"]
            completed.append({"request_id": request.request_id,
                              "arrival_tick": request.arrival_tick,
                              "start_tick": item["start_tick"], "finish_tick": tick,
                              "latency_ticks": tick - request.arrival_tick})
        active = [item for item in active if item["remaining"] > 0]
    elapsed = tick - first_arrival
    tokens = sum(request.output_tokens for request in requests)
    latencies = [item["latency_ticks"] for item in completed]
    return {"mode": mode, "capacity": capacity, "request_count": len(requests),
            "elapsed_ticks": elapsed, "output_tokens": tokens,
            "tokens_per_tick": tokens / elapsed,
            "requests_per_tick": len(requests) / elapsed,
            "mean_completion_latency_ticks": sum(latencies) / len(latencies),
            "max_completion_latency_ticks": max(latencies),
            "completions": completed, "timeline": timeline}


def positive_int(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capacity", type=positive_int, default=2)
    parser.add_argument("--lengths", default="1,8,1,8,1,8", help="comma-separated positive token counts")
    parser.add_argument("--arrivals", help="comma-separated non-negative ticks; default all zero")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--trace", action="store_true", help="print the active requests at each tick")
    args = parser.parse_args()
    try:
        lengths = [int(value) for value in args.lengths.split(",")]
        arrivals = [int(value) for value in args.arrivals.split(",")] if args.arrivals else [0] * len(lengths)
        if len(arrivals) != len(lengths):
            raise ValueError("arrivals and lengths must have equal counts")
        requests = [Request(f"r{index + 1}", arrival, length)
                    for index, (arrival, length) in enumerate(zip(arrivals, lengths))]
        results = [simulate(requests, args.capacity, mode) for mode in ("static", "continuous")]
    except ValueError as error:
        parser.error(str(error))
    if args.json:
        print(json.dumps({"units": "abstract ticks; not seconds or GPU measurements", "results": results}, indent=2))
        return
    print("DETERMINISTIC SIMULATION | one token / active request / tick | no GPU")
    print("Elapsed ticks: first arrival to last finish. Latency: arrival to finish.")
    print("mode        elapsed  tokens/tick  reqs/tick  mean latency  max latency")
    for result in results:
        print(f"{result['mode']:<11} {result['elapsed_ticks']:>7}"
              f"  {result['tokens_per_tick']:>11.3f}  {result['requests_per_tick']:>9.3f}"
              f"  {result['mean_completion_latency_ticks']:>12.3f}"
              f"  {result['max_completion_latency_ticks']:>11}")
        if args.trace:
            print("  " + " | ".join(f"t{item['tick']}:{','.join(item['active'])}" for item in result["timeline"]))


if __name__ == "__main__":
    main()
