import json
import logging
import asyncio
from typing import List, Dict, Any, Optional

from database import get_setting
from system_prompt import get_system_prompt
from memory import (
    save_message,
    get_messages,
    get_conversation_summary,
    update_conversation_summary,
    archive_messages
)
from tools.registry import TOOLS_SCHEMA, dispatch_tool

# Attempt lazy imports for optional libraries
try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None

try:
    from anthropic import AsyncAnthropic
except ImportError:
    AsyncAnthropic = None

try:
    from ollama import AsyncClient as AsyncOllamaClient
except ImportError:
    AsyncOllamaClient = None

logger = logging.getLogger(__name__)

# Active tasks tracking for telemetry/billing logging
async def log_telemetry_safe(conversation_id: int, model_name: str, prompt_tokens: int, completion_tokens: int, duration_ns: Optional[int] = None):
    try:
        from recall.telemetry import log_query_metrics
        log_query_metrics(
            conversation_id=conversation_id,
            model_name=model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_duration_ns=duration_ns,
            load_duration_ns=0,
            prompt_eval_duration_ns=0,
            eval_duration_ns=duration_ns
        )
    except Exception as e:
        logger.error(f"Failed to log query telemetry: {e}")

async def summarize_older_messages(conversation_id: int, messages_to_summarize: list) -> str:
    """Sends a block of chat messages to the active model provider to generate a summary."""
    try:
        formatted_chunk = []
        for msg in messages_to_summarize:
            role_label = "User" if msg["role"] == "user" else "Assistant" if msg["role"] == "assistant" else f"Tool ({msg.get('tool_name', 'tool')})"
            formatted_chunk.append(f"{role_label}: {msg['content']}")
            
        history_text = "\n".join(formatted_chunk)
        prompt = (
            f"Summarize the following conversation fragment. Highlight the core user goals, preferences, "
            f"problems solved, and key technical decisions made. Keep it under 150 words. Be direct.\n\n"
            f"Chat fragment:\n{history_text}\n\n"
            f"Summary:"
        )
        return await generate_text(prompt)
    except Exception as e:
        logger.error(f"Error generating chat summary fragment: {e}")
        return ""

def get_active_client_config() -> Dict[str, Any]:
    """Retrieves settings for the active provider and returns a standard config dictionary."""
    provider = get_setting("provider", "local")
    
    config = {
        "provider": provider,
        "model": "",
        "api_key": "",
        "base_url": "",
    }
    
    if provider == "local":
        config["model"] = get_setting("local_model", "qwen3.5:9b")
        config["base_url"] = get_setting("local_host", "http://localhost:11434")
    elif provider == "openai":
        config["model"] = get_setting("openai_model", "gpt-4o-mini")
        config["api_key"] = get_setting("openai_key", "")
        config["base_url"] = get_setting("openai_base_url", "https://api.openai.com/v1")
    elif provider == "anthropic":
        config["model"] = get_setting("anthropic_model", "claude-3-5-sonnet-latest")
        config["api_key"] = get_setting("anthropic_key", "")
    elif provider == "gemini":
        config["model"] = get_setting("gemini_model", "gemini-1.5-flash")
        config["api_key"] = get_setting("gemini_key", "")
        config["base_url"] = "https://generativelanguage.googleapis.com/v1beta/openai/"
    elif provider == "nvidia":
        config["model"] = get_setting("nvidia_model", "minimaxai/minimax-m3")
        config["api_key"] = get_setting("nvidia_key", "")
        config["base_url"] = get_setting("nvidia_base_url", "https://integrate.api.nvidia.com/v1")
        
    return config

async def generate_text(prompt: str) -> str:
    """Executes a quick non-streaming request against the active AI provider."""
    config = get_active_client_config()
    provider = config["provider"]
    
    if provider == "local":
        if not AsyncOllamaClient:
            raise RuntimeError("ollama package not installed")
        client = AsyncOllamaClient(host=config["base_url"])
        resp = await client.generate(model=config["model"], prompt=prompt)
        return resp.get("response", "").strip()
        
    elif provider in ["openai", "gemini", "nvidia"]:
        if not AsyncOpenAI:
            raise RuntimeError("openai package not installed. Run settings configuration setup first.")
        client = AsyncOpenAI(api_key=config["api_key"], base_url=config["base_url"])
        resp = await client.chat.completions.create(
            model=config["model"],
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.7
        )
        return resp.choices[0].message.content.strip()
        
    elif provider == "anthropic":
        if not AsyncAnthropic:
            raise RuntimeError("anthropic package not installed. Run settings configuration setup first.")
        client = AsyncAnthropic(api_key=config["api_key"])
        resp = await client.messages.create(
            model=config["model"],
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        return resp.content[0].text.strip()
        
    return ""

def reconstruct_openai_history(unarchived_msgs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Reconstructs a valid OpenAI tool calling message history from flat database records."""
    formatted_messages = []
    
    for i, msg in enumerate(unarchived_msgs):
        role = msg["role"]
        content = msg["content"]
        msg_id = msg.get("id") or i
        
        if role == "user":
            formatted_messages.append({"role": "user", "content": content})
        elif role == "assistant":
            # Find if there are subsequent tool messages following this assistant message
            tool_calls = []
            j = i + 1
            while j < len(unarchived_msgs) and unarchived_msgs[j]["role"] == "tool":
                tool_msg = unarchived_msgs[j]
                tool_name = tool_msg.get("name") or "tool"
                tool_call_id = f"call_{tool_msg.get('id') or j}"
                tool_calls.append({
                    "id": tool_call_id,
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "arguments": "{}"  # Dummy args for reconstruction
                    }
                })
                j += 1
            
            assistant_item = {"role": "assistant", "content": content}
            if tool_calls:
                assistant_item["tool_calls"] = tool_calls
            formatted_messages.append(assistant_item)
            
        elif role == "tool":
            # Backtrack to preceding assistant message to find matching generated ID
            tool_call_id = f"call_{msg_id}"
            formatted_messages.append({
                "role": "tool",
                "tool_call_id": tool_call_id,
                "name": msg.get("name") or "tool",
                "content": content
            })
            
    return formatted_messages

def reconstruct_anthropic_history(unarchived_msgs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Converts a flat database message list to Anthropic's alternating messages array."""
    formatted = []
    
    for i, msg in enumerate(unarchived_msgs):
        role = msg["role"]
        content = msg["content"]
        msg_id = msg.get("id") or i
        
        if role == "user":
            # Anthropic messages must alternate. If last message was user, merge content.
            if formatted and formatted[-1]["role"] == "user":
                formatted[-1]["content"] += f"\n\n{content}"
            else:
                formatted.append({"role": "user", "content": content})
                
        elif role == "assistant":
            tool_calls = []
            j = i + 1
            while j < len(unarchived_msgs) and unarchived_msgs[j]["role"] == "tool":
                tool_msg = unarchived_msgs[j]
                tool_name = tool_msg.get("name") or "tool"
                tool_call_id = f"call_{tool_msg.get('id') or j}"
                tool_calls.append({
                    "type": "tool_use",
                    "id": tool_call_id,
                    "name": tool_name,
                    "input": {} # Dummy args
                })
                j += 1
                
            content_blocks = []
            if content:
                content_blocks.append({"type": "text", "text": content})
            if tool_calls:
                content_blocks.extend(tool_calls)
                
            formatted.append({
                "role": "assistant",
                "content": content_blocks if content_blocks else ""
            })
            
        elif role == "tool":
            tool_call_id = f"call_{msg_id}"
            tool_block = {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_call_id,
                        "content": content
                    }
                ]
            }
            if formatted and formatted[-1]["role"] == "user":
                # If preceding was user, Anthropic requires tool result to be appended to it or keep it as user role block
                last_content = formatted[-1]["content"]
                if isinstance(last_content, str):
                    formatted[-1]["content"] = [{"type": "text", "text": last_content}]
                formatted[-1]["content"].append(tool_block["content"][0])
            else:
                formatted.append(tool_block)
                
    return formatted

async def stream_chat(conversation_id: int, user_content: str, websocket):
    # 1. Save user message to database
    save_message(conversation_id, "user", user_content)
    
    # 2. Check for conversation compression (rolling history)
    unarchived = get_messages(conversation_id, include_archived=False)
    if len(unarchived) > 16:
        logger.info(f"Active messages length is {len(unarchived)}. Initiating rolling compression...")
        to_compress = unarchived[:10]
        new_summary = await summarize_older_messages(conversation_id, to_compress)
        
        if new_summary:
            existing_summary = get_conversation_summary(conversation_id)
            if existing_summary:
                try:
                    merged = await generate_text(
                        f"Merge these two chronological summaries of a conversation into a single cohesive "
                        f"history recap under 200 words. Keep facts and settings intact.\n\n"
                        f"Old Summary:\n{existing_summary}\n\n"
                        f"New Summary:\n{new_summary}\n\n"
                        f"Merged Summary:"
                    )
                    if merged:
                        update_conversation_summary(conversation_id, merged)
                except Exception as merge_err:
                    logger.error(f"Failed to merge summaries: {merge_err}")
                    update_conversation_summary(conversation_id, f"{existing_summary}\n\n{new_summary}")
            else:
                update_conversation_summary(conversation_id, new_summary)
                
            # Mark messages as archived in database
            ids_to_archive = [m["id"] for m in to_compress if "id" in m and m["id"] is not None]
            archive_messages(ids_to_archive)
            logger.info(f"Archived {len(ids_to_archive)} old messages after compression.")
            
        unarchived = get_messages(conversation_id, include_archived=False)

    # 3. Load active client config
    config = get_active_client_config()
    provider = config["provider"]
    model_name = config["model"]
    
    system_prompt = get_system_prompt()
    summary = get_conversation_summary(conversation_id)
    if summary:
        system_prompt += f"\n\nContext of older parts of this conversation:\n{summary}"

    max_tool_iterations = 5
    iteration = 0
    total_content_accumulated = ""
    total_reasoning_accumulated = ""
    
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Loop for tool call execution
        while iteration < max_tool_iterations:
            iteration += 1
            logger.info(f"AI Client Chat iteration {iteration}/{max_tool_iterations} [Provider: {provider}, Model: {model_name}]")
            
            # Refresh messages list from SQLite + newly executed tools in this loop session
            # For simplicity, we keep a running list of structured messages in the session
            if iteration == 1:
                if provider == "local":
                    formatted_history = [{"role": msg["role"], "content": msg["content"]} for msg in unarchived]
                    messages = [{"role": "system", "content": system_prompt}] + formatted_history
                elif provider in ["openai", "gemini", "nvidia"]:
                    formatted_history = reconstruct_openai_history(unarchived)
                    if provider == "nvidia":
                        # Convert system instructions to user message block to prevent API rejects on system role (e.g. minimax)
                        messages = []
                        first_user_idx = -1
                        for idx, m in enumerate(formatted_history):
                            if m["role"] == "user":
                                first_user_idx = idx
                                break
                        if first_user_idx != -1:
                            messages = [dict(m) for m in formatted_history]
                            messages[first_user_idx]["content"] = f"[System Instructions:\n{system_prompt}]\n\n{messages[first_user_idx]['content']}"
                        else:
                            messages = [{"role": "user", "content": f"[System Instructions:\n{system_prompt}]"}]
                    else:
                        messages = [{"role": "system", "content": system_prompt}] + formatted_history
                elif provider == "anthropic":
                    messages = reconstruct_anthropic_history(unarchived)
            
            logger.info(f"Sending messages payload: {json.dumps(messages, indent=2)}")
            
            tool_calls = []
            content_accumulated = ""
            reasoning_accumulated = ""
            
            # --- LOCAL OLLAMA ROUTE ---
            if provider == "local":
                if not AsyncOllamaClient:
                    raise RuntimeError("ollama library not installed.")
                client = AsyncOllamaClient(host=config["base_url"])
                
                try:
                    response_stream = await client.chat(
                        model=model_name,
                        messages=messages,
                        tools=TOOLS_SCHEMA,
                        stream=True
                    )
                    
                    async for chunk in response_stream:
                        msg_chunk = chunk.get('message', {})
                        content = msg_chunk.get('content', '')
                        if content:
                            content_accumulated += content
                            total_content_accumulated += content
                            await websocket.send_json({"type": "token", "content": content})
                        
                        if msg_chunk.get('tool_calls'):
                            tool_calls.extend(msg_chunk['tool_calls'])
                except Exception as e:
                    raise RuntimeError(f"Ollama call failed: {e}")
            
            # --- OPENAI / GEMINI / NVIDIA ROUTE ---
            elif provider in ["openai", "gemini", "nvidia"]:
                if not AsyncOpenAI:
                    raise RuntimeError("openai package is not installed.")
                client = AsyncOpenAI(api_key=config["api_key"], base_url=config["base_url"])
                
                # Check for Nvidia specific body params (glm-5.1 thinking)
                extra_body = None
                if provider == "nvidia" and "glm" in model_name.lower():
                    extra_body = {
                        "chat_template_kwargs": {
                            "enable_thinking": True,
                            "clear_thinking": False
                        }
                    }
                
                success = False
                # Attempt 1: stream=True, with tools
                try:
                    logger.info(f"Attempt 1: stream=True with tools for {model_name}...")
                    response_stream = await client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        tools=TOOLS_SCHEMA if TOOLS_SCHEMA else None,
                        stream=True,
                        max_tokens=4096,
                        extra_body=extra_body
                    )
                    
                    async for chunk in response_stream:
                        if not getattr(chunk, "choices", None) or len(chunk.choices) == 0:
                            continue
                        
                        delta = chunk.choices[0].delta
                        
                        # Nvidia NIM / reasoning model thinking stream
                        reasoning = getattr(delta, "reasoning_content", None)
                        if reasoning:
                            reasoning_accumulated += reasoning
                            total_reasoning_accumulated += reasoning
                            await websocket.send_json({"type": "reasoning", "content": reasoning})
                            
                        content = getattr(delta, "content", None)
                        if content:
                            content_accumulated += content
                            total_content_accumulated += content
                            await websocket.send_json({"type": "token", "content": content})
                            
                        # Capture tool calls
                        if getattr(delta, "tool_calls", None):
                            for tc_delta in delta.tool_calls:
                                # Tool calls can stream in chunks. Accumulate/merge them:
                                if len(tool_calls) <= tc_delta.index:
                                    # Create a placeholder
                                    tool_calls.append({
                                        "id": tc_delta.id or "",
                                        "type": "function",
                                        "function": {
                                            "name": tc_delta.function.name or "",
                                            "arguments": tc_delta.function.arguments or ""
                                        }
                                    })
                                else:
                                    # Update existing
                                    tc = tool_calls[tc_delta.index]
                                    if tc_delta.id:
                                        tc["id"] = tc_delta.id
                                    if tc_delta.function.name:
                                        tc["function"]["name"] += tc_delta.function.name
                                    if tc_delta.function.arguments:
                                        tc["function"]["arguments"] += tc_delta.function.arguments
                    success = True
                except Exception as err1:
                    logger.warning(f"Attempt 1 (stream with tools) failed: {err1}")
                    
                if not success:
                    # Attempt 2: stream=True, NO tools
                    content_accumulated = ""
                    reasoning_accumulated = ""
                    tool_calls = []
                    try:
                        logger.info(f"Attempt 2: stream=True without tools for {model_name}...")
                        response_stream = await client.chat.completions.create(
                            model=model_name,
                            messages=messages,
                            stream=True,
                            max_tokens=4096,
                            extra_body=extra_body
                        )
                        async for chunk in response_stream:
                            if not getattr(chunk, "choices", None) or len(chunk.choices) == 0:
                                continue
                            delta = chunk.choices[0].delta
                            content = getattr(delta, "content", None)
                            if content:
                                content_accumulated += content
                                total_content_accumulated += content
                                await websocket.send_json({"type": "token", "content": content})
                        success = True
                    except Exception as err2:
                        logger.warning(f"Attempt 2 (stream without tools) failed: {err2}")
                        
                if not success:
                    # Attempt 3: stream=False, NO tools (non-stream fallback)
                    content_accumulated = ""
                    reasoning_accumulated = ""
                    tool_calls = []
                    try:
                        logger.info(f"Attempt 3: stream=False without tools for {model_name}...")
                        resp = await client.chat.completions.create(
                            model=model_name,
                            messages=messages,
                            stream=False,
                            max_tokens=4096,
                            extra_body=extra_body
                        )
                        if resp.choices and len(resp.choices) > 0:
                            content = resp.choices[0].message.content or ""
                            if content:
                                content_accumulated = content
                                total_content_accumulated = content
                                await websocket.send_json({"type": "token", "content": content})
                            success = True
                        else:
                            raise ValueError(f"Server returned empty choices list. Full response object: {resp}")
                    except Exception as err3:
                        logger.error(f"Attempt 3 (non-stream fallback) failed: {err3}")
                        raise RuntimeError(f"All OpenAI-compatible request attempts failed. Last error: {err3}")
            
            # --- ANTHROPIC CLAUDE ROUTE ---
            elif provider == "anthropic":
                if not AsyncAnthropic:
                    raise RuntimeError("anthropic package is not installed.")
                client = AsyncAnthropic(api_key=config["api_key"])
                
                # Convert tools schema to Anthropic format
                anthropic_tools = []
                for tool in TOOLS_SCHEMA:
                    func = tool["function"]
                    anthropic_tools.append({
                        "name": func["name"],
                        "description": func["description"],
                        "input_schema": func["parameters"]
                    })
                    
                try:
                    # System prompt is sent separately in Anthropic Messages API
                    response_stream = await client.messages.create(
                        model=model_name,
                        system=system_prompt,
                        messages=messages,
                        tools=anthropic_tools if anthropic_tools else None,
                        max_tokens=4096,
                        stream=True
                    )
                    
                    tool_call_dict = {}
                    
                    async for event in response_stream:
                        if event.type == "content_block_start":
                            if event.content_block.type == "tool_use":
                                # Tool call initialized
                                tool_call_dict = {
                                    "id": event.content_block.id,
                                    "name": event.content_block.name,
                                    "arguments_str": ""
                                }
                        elif event.type == "content_block_delta":
                            if event.delta.type == "text_delta":
                                content = event.delta.text
                                content_accumulated += content
                                total_content_accumulated += content
                                await websocket.send_json({"type": "token", "content": content})
                            elif event.delta.type == "input_json_delta":
                                # Accumulate JSON arguments string
                                tool_call_dict["arguments_str"] += event.delta.partial_json
                        elif event.type == "content_block_stop":
                            if tool_call_dict:
                                # Parse arguments
                                try:
                                    args = json.loads(tool_call_dict["arguments_str"])
                                except Exception:
                                    args = tool_call_dict["arguments_str"]
                                    
                                tool_calls.append({
                                    "id": tool_call_dict["id"],
                                    "type": "function",
                                    "function": {
                                        "name": tool_call_dict["name"],
                                        "arguments": args
                                    }
                                })
                                tool_call_dict = {}
                except Exception as e:
                    raise RuntimeError(f"Anthropic request failed: {e}")
            
            # --- PROCESS TOOL CALLS ---
            if tool_calls:
                logger.info(f"Model requested {len(tool_calls)} tool calls.")
                
                # Append assistant message with its tool calls to session messages
                if provider == "local":
                    messages.append({
                        "role": "assistant",
                        "content": content_accumulated,
                        "tool_calls": tool_calls
                    })
                elif provider in ["openai", "gemini", "nvidia"]:
                    # Ensure arguments is a valid string for the next completion call
                    clean_tool_calls = []
                    for tc in tool_calls:
                        clean_tool_calls.append({
                            "id": tc["id"] or f"call_{iteration}_{tc['function']['name']}",
                            "type": "function",
                            "function": {
                                "name": tc["function"]["name"],
                                "arguments": tc["function"]["arguments"] if isinstance(tc["function"]["arguments"], str) else json.dumps(tc["function"]["arguments"])
                            }
                        })
                    messages.append({
                        "role": "assistant",
                        "content": content_accumulated,
                        "tool_calls": clean_tool_calls
                    })
                elif provider == "anthropic":
                    anthropic_content = []
                    if content_accumulated:
                        anthropic_content.append({"type": "text", "text": content_accumulated})
                    for tc in tool_calls:
                        # Anthropic expects tool use input to be a dict
                        input_args = tc["function"]["arguments"]
                        if isinstance(input_args, str):
                            try:
                                input_args = json.loads(input_args)
                            except Exception:
                                input_args = {}
                        anthropic_content.append({
                            "type": "tool_use",
                            "id": tc["id"],
                            "name": tc["function"]["name"],
                            "input": input_args
                        })
                    messages.append({
                        "role": "assistant",
                        "content": anthropic_content
                    })
                
                # Execute tools sequentially
                for tool_call in tool_calls:
                    if hasattr(tool_call, 'function'):
                        name = tool_call.function.name
                        args = tool_call.function.arguments
                    else:
                        func = tool_call.get('function', {})
                        name = func.get('name')
                        args = func.get('arguments', {})
                    
                    tc_id = tool_call.get("id") or f"call_{iteration}_{name}"
                    
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except Exception:
                            pass
                    
                    # Notify UI of tool execution start
                    await websocket.send_json({
                        "type": "tool_start",
                        "name": name,
                        "args": args if isinstance(args, dict) else {"raw": args}
                    })
                    
                    try:
                        logger.info(f"Executing tool {name} with args {args}")
                        result = dispatch_tool(name, args)
                        logger.info(f"Tool {name} result: {str(result)[:100]}...")
                    except Exception as e:
                        logger.error(f"Error executing tool {name}: {e}")
                        result = f"Error executing tool: {str(e)}"
                        
                    # Notify UI of tool execution result
                    await websocket.send_json({
                        "type": "tool_result",
                        "name": name,
                        "result": str(result)
                    })
                    
                    # Append tool result to messages list
                    if provider == "local":
                        messages.append({
                            "role": "tool",
                            "content": str(result),
                            "name": name
                        })
                    elif provider in ["openai", "gemini", "nvidia"]:
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "name": name,
                            "content": str(result)
                        })
                    elif provider == "anthropic":
                        # Anthropic expects tool results as content blocks in a user role message
                        tool_block = {
                            "role": "user",
                            "content": [
                                {
                                    "type": "tool_result",
                                    "tool_use_id": tc_id,
                                    "content": str(result)
                                }
                            ]
                        }
                        if messages and messages[-1]["role"] == "user":
                            # Merge content if last message was user
                            if isinstance(messages[-1]["content"], str):
                                messages[-1]["content"] = [{"type": "text", "text": messages[-1]["content"]}]
                            messages[-1]["content"].append(tool_block["content"][0])
                        else:
                            messages.append(tool_block)
            else:
                # No tool calls requested, streaming completed!
                save_message(conversation_id, "assistant", content_accumulated, total_reasoning_accumulated or None)
                await websocket.send_json({"type": "done", "conversation_id": conversation_id})
                
                # Log telemetry metrics
                duration_ns = int((asyncio.get_event_loop().time() - start_time) * 1e9)
                # Estimate token counts if not provided by APIs (rough approximation: 1 token = 4 chars)
                prompt_est = sum(len(str(m)) for m in messages) // 4
                completion_est = len(total_content_accumulated) // 4
                await log_telemetry_safe(
                    conversation_id=conversation_id,
                    model_name=model_name,
                    prompt_tokens=prompt_est,
                    completion_tokens=completion_est,
                    duration_ns=duration_ns
                )
                break
                
    except asyncio.CancelledError:
        logger.info(f"Stream chat task cancelled for conversation {conversation_id}")
        if total_content_accumulated:
            save_message(conversation_id, "assistant", total_content_accumulated + " [Stopped by user]", total_reasoning_accumulated or None)
        try:
            await websocket.send_json({"type": "done", "conversation_id": conversation_id, "status": "cancelled"})
        except Exception:
            pass
    except Exception as e:
        logger.error(f"Error streaming chat from AIClient: {e}", exc_info=True)
        err_msg = f"\nError communicating with AI Provider ({provider}): {str(e)}."
        await websocket.send_json({"type": "token", "content": err_msg})
        save_message(conversation_id, "assistant", err_msg)
        await websocket.send_json({"type": "done", "conversation_id": conversation_id})
