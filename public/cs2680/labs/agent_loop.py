#!/usr/bin/env python3
"""Offline teaching agent: a scripted policy, validated tool, and explicit budgets.

This does not call a language model. Token counts are deterministic character-based
estimates, used only to demonstrate accounting. Python 3.9+; standard library only.
"""

import argparse
import json
from dataclasses import dataclass


KNOWLEDGE = {
    "kv_cache": "KV cache reuses attention keys and values from previous tokens.",
    "ttft": "TTFT is the time from request arrival to its first output token.",
    "throughput": "Throughput is completed work divided by elapsed time.",
    "continuous_batching": "Continuous batching admits a new request when a slot is free.",
    "prefill": "Prefill processes the input prompt before autoregressive decoding.",
    "decode": "Decode generates output tokens one step at a time.",
    "evaluation": "Evaluation compares outputs against a fixed task set and success rule.",
    "budget": "A budget limits steps, tool attempts, or estimated token usage.",
}


@dataclass(frozen=True)
class Task:
    task_id: str
    question: str
    key: str
    repair_needed: bool = False

    @property
    def expected(self):
        return KNOWLEDGE[self.key]


TASKS = (
    Task("cache", "What does KV cache reuse?", "kv_cache"),
    Task("latency", "Define TTFT.", "ttft"),
    Task("rate", "Define throughput.", "throughput"),
    Task("batching", "When does continuous batching admit requests?", "continuous_batching"),
    Task("prompt", "What happens during prefill?", "prefill"),
    Task("generation", "What happens during decode?", "decode"),
    Task("quality", "How should we evaluate outputs?", "evaluation", True),
    Task("limits", "What does an agent budget limit?", "budget", True),
)

TOOL_SCHEMA = {
    "name": "lookup",
    "parameters": {
        "type": "object",
        "properties": {"key": {"type": "string", "enum": list(KNOWLEDGE)}},
        "required": ["key"],
        "additionalProperties": False,
    },
}


class ToolValidationError(ValueError):
    """Expected, recoverable validation failure; unexpected errors are not hidden."""


def lookup(arguments):
    """The only permitted tool: lookup in a fixed, read-only dictionary."""
    if not isinstance(arguments, dict) or set(arguments) != {"key"}:
        raise ToolValidationError("lookup requires exactly one field: key")
    key = arguments["key"]
    if not isinstance(key, str) or key not in KNOWLEDGE:
        raise ToolValidationError("key must be a supported string from the schema")
    return KNOWLEDGE[key]


def invoke_tool(name, arguments):
    if name != "lookup":
        raise ToolValidationError("tool is not allowed: " + str(name))
    return lookup(arguments)


def estimate_tokens(text):
    """A toy estimate, NOT any model's tokenizer: ceil(character count / 4)."""
    return (len(text) + 3) // 4


def scripted_model(task, strategy, observations):
    """A deterministic fixture policy. The correct lookup key is supplied by Task.

    direct recalls four of the eight fixtures; tool reads the answer. Two fixtures
    intentionally emit a bad schema once to exercise the controller's repair path.
    This setup is not a language-understanding or model-quality benchmark.
    """
    if strategy == "direct":
        answer = task.expected if task.key in list(KNOWLEDGE)[:4] else "I do not know."
        return {"type": "final", "answer": answer}
    if observations and observations[-1]["ok"]:
        return {"type": "final", "answer": observations[-1]["content"]}
    if task.repair_needed and not observations:
        return {"type": "tool_call", "name": "lookup", "arguments": {"key": 123}}
    return {"type": "tool_call", "name": "lookup", "arguments": {"key": task.key}}


def run_agent(task, strategy="tool", max_steps=6, max_tokens=1024, max_tool_calls=3):
    for name, value in (("max_steps", max_steps), ("max_tokens", max_tokens),
                        ("max_tool_calls", max_tool_calls)):
        if type(value) is not int or value < 0:
            raise ValueError(name + " must be a non-negative integer")
    if strategy not in ("direct", "tool"):
        raise ValueError("strategy must be direct or tool")

    observations, trace = [], []
    used_tokens, tool_attempts, model_steps = 0, 0, 0
    answer, stop_reason = None, "step_budget"
    for step in range(1, max_steps + 1):
        proposal = scripted_model(task, strategy, observations)
        # A fake request would contain the question and full observation history.
        # Since the model is scripted, we can reserve the entire synthetic cost
        # before accepting a turn. Real APIs need separate input/output limits.
        request = json.dumps({"question": task.question, "observations": observations},
                             sort_keys=True)
        cost = estimate_tokens(request) + estimate_tokens(json.dumps(proposal, sort_keys=True))
        if used_tokens + cost > max_tokens:
            stop_reason = "token_budget"
            trace.append({"step": step, "event": "budget_stop", "reason": stop_reason,
                          "proposed_tokens": cost, "remaining_tokens": max_tokens - used_tokens})
            break
        used_tokens += cost
        model_steps += 1
        trace.append({"step": step, "event": "model", "reply": proposal,
                      "simulated_tokens": cost, "total_simulated_tokens": used_tokens})
        if proposal["type"] == "final":
            answer, stop_reason = proposal["answer"], "final_answer"
            break
        if tool_attempts >= max_tool_calls:
            stop_reason = "tool_budget"
            trace.append({"step": step, "event": "budget_stop", "reason": stop_reason})
            break
        tool_attempts += 1  # Invalid calls count too, preventing free retry loops.
        try:
            content = invoke_tool(proposal["name"], proposal["arguments"])
            observation = {"ok": True, "content": content}
        except ToolValidationError as error:
            observation = {"ok": False, "content": str(error)}
        observations.append(observation)
        trace.append({"step": step, "event": "tool_result", **observation})
    return {"task_id": task.task_id, "strategy": strategy, "answer": answer,
            "success": answer == task.expected, "stop_reason": stop_reason,
            "model_steps": model_steps, "tool_attempts": tool_attempts,
            "simulated_tokens": used_tokens, "trace": trace}


def nonnegative_int(value):
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be non-negative")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task", choices=[task.task_id for task in TASKS], default="quality")
    parser.add_argument("--strategy", choices=["direct", "tool"], default="tool")
    parser.add_argument("--max-steps", type=nonnegative_int, default=6)
    parser.add_argument("--max-tokens", type=nonnegative_int, default=1024)
    parser.add_argument("--max-tool-calls", type=nonnegative_int, default=3)
    parser.add_argument("--json", action="store_true", help="print machine-readable result")
    args = parser.parse_args()
    task = next(task for task in TASKS if task.task_id == args.task)
    result = run_agent(task, args.strategy, args.max_steps, args.max_tokens, args.max_tool_calls)
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return
    print("OFFLINE SIMULATION | scripted model | synthetic token counts | no API")
    print("Task:", task.question)
    for event in result["trace"]:
        print(json.dumps(event, ensure_ascii=False))
    print("Answer:", result["answer"])
    print("Success: {success} | Stop: {stop_reason} | Model steps: {model_steps} | "
          "Tool attempts: {tool_attempts} | Simulated tokens: {simulated_tokens}".format(**result))


if __name__ == "__main__":
    main()
