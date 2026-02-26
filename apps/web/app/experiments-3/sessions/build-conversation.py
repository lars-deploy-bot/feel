"""
Build real-conversation.json from raw SDK session JSONL files.

Reads the main session and subagent transcripts, merges them in timeline order,
and produces UIMessage-compatible JSON with FULL (non-truncated) content.

The key transformation: JSONL stores raw Anthropic API messages, but our UI
expects SDK-wrapped messages:

  JSONL raw assistant:  { type: "message", role: "assistant", model: "...", content: [...] }
  SDK format (UIMessage.content):  { type: "assistant", message: {<raw above>}, parent_tool_use_id: ... }

  JSONL raw user:       { role: "user", content: [{ type: "tool_result", ... }] }
  SDK format (UIMessage.content):  { type: "user", message: {<raw above>}, parent_tool_use_id: ... }

Usage:
    python3 build-conversation.py

Input:
    sessions/<session-id>.jsonl              (main session)
    sessions/<session-id>/subagents/*.jsonl   (subagent transcripts)

Output:
    ../real-conversation.json
"""

import json
import os
import glob as globmod

SESSION_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(os.path.dirname(SESSION_DIR), "real-conversation.json")

# Main session
MAIN_SESSION = os.path.join(SESSION_DIR, "482a75e1-4909-42c4-b74d-b8d405420912.jsonl")

# Find all subagent transcripts
SUBAGENT_DIR = os.path.join(SESSION_DIR, "482a75e1-4909-42c4-b74d-b8d405420912", "subagents")


def read_jsonl(path):
    """Read JSONL file, skip non-message lines (queue-operation, progress)."""
    lines = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if obj.get("type") in ("queue-operation", "progress"):
                    continue
                lines.append(obj)
            except json.JSONDecodeError:
                continue
    return lines


def extract_agent_id_from_path(path):
    """Extract agent ID from subagent filename (agent-aea0d69.jsonl -> aea0d69)."""
    basename = os.path.basename(path)
    if basename.startswith("agent-") and basename.endswith(".jsonl"):
        return basename[6:-6]
    return None


def find_task_tool_use_id(main_messages, agent_id):
    """Find the Task tool_use_id that spawned a given subagent."""
    task_tool_uses = []
    for obj in main_messages:
        msg = obj.get("message", {})
        if isinstance(msg, dict):
            content = msg.get("content", [])
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "tool_use" and item.get("name") == "Task":
                        task_tool_uses.append({
                            "id": item["id"],
                            "timestamp": obj.get("timestamp", ""),
                        })

    if len(task_tool_uses) == 1:
        return task_tool_uses[0]["id"]

    # Multiple Tasks: match by agentId in tool_result content
    for obj in main_messages:
        msg = obj.get("message", {})
        if isinstance(msg, dict):
            content = msg.get("content", [])
            if isinstance(content, list):
                for item in content:
                    if (isinstance(item, dict) and item.get("type") == "tool_result"):
                        rc = item.get("content", "")
                        text = ""
                        if isinstance(rc, list):
                            text = " ".join(r.get("text", "") for r in rc if isinstance(r, dict))
                        elif isinstance(rc, str):
                            text = rc
                        if agent_id and agent_id in text:
                            return item.get("tool_use_id")

    return task_tool_uses[0]["id"] if task_tool_uses else None


def build_ui_message(obj, index, parent_tool_use_id=None):
    """Convert a JSONL wrapper object to a UIMessage dict.

    JSONL wrapper format:
        { type: "user"|"assistant", message: <raw API message>, uuid, timestamp, ... }

    UIMessage format expected by the frontend:
        {
            id: string,
            type: "user" | "sdk_message",
            content: <SDK-wrapped message> | string,
            timestamp: string
        }

    SDK-wrapped message format (what isSDKAssistantMessage/isSDKUserMessage check):
        Assistant: { type: "assistant", message: <raw API msg>, parent_tool_use_id }
        User:      { type: "user", message: <raw API msg>, parent_tool_use_id }
    """
    msg_type = obj.get("type", "")
    uuid = obj.get("uuid", "gen-%d" % index)
    timestamp = obj.get("timestamp", "2026-01-01T00:00:00Z")
    raw_msg = obj.get("message", {})

    if not isinstance(raw_msg, dict):
        return None

    if msg_type == "assistant":
        # Wrap raw API message in SDK assistant format
        # isSDKAssistantMessage checks: msg.type === "assistant" && "message" in msg
        sdk_content = {
            "type": "assistant",
            "message": raw_msg,
            "parent_tool_use_id": parent_tool_use_id,
        }
        return {
            "id": "real-%s" % uuid,
            "type": "sdk_message",
            "content": sdk_content,
            "timestamp": timestamp,
        }

    if msg_type == "user":
        content_items = raw_msg.get("content", [])

        # Detect tool_result messages (SDK user messages with tool results)
        has_tool_result = (
            isinstance(content_items, list)
            and any(isinstance(it, dict) and it.get("type") == "tool_result" for it in content_items)
        )

        if has_tool_result:
            # Wrap raw API message in SDK user format
            # isSDKUserMessage checks: msg.type === "user" && "message" in msg
            sdk_content = {
                "type": "user",
                "message": raw_msg,
                "parent_tool_use_id": parent_tool_use_id,
            }
            return {
                "id": "real-%s" % uuid,
                "type": "sdk_message",
                "content": sdk_content,
                "timestamp": timestamp,
            }
        else:
            # Real user input (text message from the human)
            text = ""
            if isinstance(content_items, str):
                text = content_items
            elif isinstance(content_items, list):
                texts = [
                    it.get("text", "")
                    for it in content_items
                    if isinstance(it, dict) and it.get("type") == "text"
                ]
                text = "\n".join(texts)
            return {
                "id": "real-%s" % uuid,
                "type": "user",
                "content": text,
                "timestamp": timestamp,
            }

    return None


def add_tool_names_to_results(messages):
    """Post-process: annotate tool_result blocks with tool_name and tool_input.

    The SDK stream does this client-side by matching tool_use_id -> tool_name.
    We replicate it here for the static JSON.
    """
    tool_use_map = {}
    tool_input_map = {}

    # First pass: collect tool_use ids -> names from assistant messages
    for msg in messages:
        content = msg.get("content", {})
        if not isinstance(content, dict):
            continue
        # SDK assistant: content.message.content contains tool_use blocks
        inner = content.get("message", {})
        if isinstance(inner, dict):
            items = inner.get("content", [])
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and item.get("type") == "tool_use" and item.get("id"):
                        tool_use_map[item["id"]] = item.get("name", "")
                        tool_input_map[item["id"]] = item.get("input", {})

    # Second pass: annotate tool_result blocks in user messages
    for msg in messages:
        content = msg.get("content", {})
        if not isinstance(content, dict):
            continue
        inner = content.get("message", {})
        if isinstance(inner, dict):
            items = inner.get("content", [])
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and item.get("type") == "tool_result":
                        tuid = item.get("tool_use_id", "")
                        if tuid in tool_use_map:
                            item["tool_name"] = tool_use_map[tuid]
                        if tuid in tool_input_map:
                            item["tool_input"] = tool_input_map[tuid]

    annotated = sum(1 for m in messages for c in [m.get("content", {})]
                    if isinstance(c, dict)
                    for inner in [c.get("message", {})]
                    if isinstance(inner, dict)
                    for it in (inner.get("content", []) if isinstance(inner.get("content"), list) else [])
                    if isinstance(it, dict) and it.get("type") == "tool_result" and it.get("tool_name"))
    print("  Annotated %d tool_results with tool_name" % annotated)


def validate_messages(messages):
    """Verify SDK type guards will work on the output."""
    errors = []
    for i, msg in enumerate(messages):
        if msg["type"] != "sdk_message":
            continue
        content = msg.get("content", {})
        if not isinstance(content, dict):
            continue

        ct = content.get("type")
        has_message = "message" in content

        if ct == "assistant" and not has_message:
            errors.append("[%d] assistant without 'message' key" % i)
        if ct == "user" and not has_message:
            errors.append("[%d] user without 'message' key" % i)
        if ct not in ("assistant", "user", "system", "result"):
            errors.append("[%d] unexpected content.type: %s" % (i, ct))

    if errors:
        print("  VALIDATION ERRORS:")
        for e in errors:
            print("    " + e)
    else:
        print("  Validation passed: all SDK type guards will match")


def main():
    print("Reading main session: %s" % MAIN_SESSION)
    main_messages = read_jsonl(MAIN_SESSION)
    print("  %d messages (excluding progress/queue-operation)" % len(main_messages))

    # Find subagent transcripts
    subagent_files = sorted(globmod.glob(os.path.join(SUBAGENT_DIR, "agent-*.jsonl")))
    subagents = {}
    for path in subagent_files:
        agent_id = extract_agent_id_from_path(path)
        if agent_id:
            messages = read_jsonl(path)
            task_tool_use_id = find_task_tool_use_id(main_messages, agent_id)
            subagents[agent_id] = {
                "messages": messages,
                "parent_tool_use_id": task_tool_use_id,
                "path": path,
            }
            print("  Subagent %s: %d messages, parent=%s" % (agent_id, len(messages), task_tool_use_id))

    # Build timeline: interleave main + subagent messages by timestamp
    all_entries = []
    for obj in main_messages:
        all_entries.append(("main", obj, obj.get("timestamp", ""), None))
    for agent_id, info in subagents.items():
        for obj in info["messages"]:
            all_entries.append(("sub", obj, obj.get("timestamp", ""), info["parent_tool_use_id"]))

    all_entries.sort(key=lambda x: x[2])

    # Convert to UIMessages
    ui_messages = []
    for i, (source, obj, ts, parent_tool_use_id) in enumerate(all_entries):
        ui_msg = build_ui_message(obj, i, parent_tool_use_id)
        if ui_msg:
            ui_messages.append(ui_msg)

    # Annotate tool results with tool names
    add_tool_names_to_results(ui_messages)

    # Validate
    validate_messages(ui_messages)

    print("\nTotal UIMessages: %d" % len(ui_messages))

    # Write output
    with open(OUTPUT_FILE, "w") as f:
        json.dump(ui_messages, f, indent=2, ensure_ascii=False)
    print("Written to: %s" % OUTPUT_FILE)

    # Stats
    types = {}
    for msg in ui_messages:
        types[msg["type"]] = types.get(msg["type"], 0) + 1
    print("Message types: %s" % types)

    # Content type breakdown
    sdk_types = {}
    for msg in ui_messages:
        c = msg.get("content", {})
        if isinstance(c, dict):
            sdk_types[c.get("type", "?")] = sdk_types.get(c.get("type", "?"), 0) + 1
    print("SDK content types: %s" % sdk_types)

    # Check for full content
    max_text = 0
    for msg in ui_messages:
        c = msg.get("content", {})
        if isinstance(c, dict):
            inner = c.get("message", {})
            if isinstance(inner, dict):
                for item in (inner.get("content", []) or []):
                    if isinstance(item, dict) and item.get("type") == "text":
                        max_text = max(max_text, len(item.get("text", "")))
    print("Max text content: %d chars" % max_text)


if __name__ == "__main__":
    main()
