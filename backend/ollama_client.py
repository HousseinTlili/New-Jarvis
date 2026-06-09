import json
import logging
import asyncio
from ollama import AsyncClient
from config import OLLAMA_HOST, MODEL_NAME, OLLAMA_OPTIONS
from system_prompt import get_system_prompt
from memory import (
    save_message,
    get_messages,
    get_conversation_summary,
    update_conversation_summary,
    archive_messages
)
from tools.registry import TOOLS_SCHEMA, dispatch_tool

logger = logging.getLogger(__name__)

async def summarize_older_messages(conversation_id: int, messages_to_summarize: list) -> str:
    """Sends a block of chat messages to Ollama to generate a compact summary."""
    try:
        formatted_chunk = []
        for msg in messages_to_summarize:
            role_label = "User" if msg["role"] == "user" else "Assistant" if msg["role"] == "assistant" else f"Tool ({msg.get('tool_name', 'tool')})"
            formatted_chunk.append(f"{role_label}: {msg['content']}")
            
        history_text = "\n".join(formatted_chunk)
        
        client = AsyncClient(host=OLLAMA_HOST)
        prompt = (
            f"Summarize the following conversation fragment. Highlight the core user goals, preferences, "
            f"problems solved, and key technical decisions made. Keep it under 150 words. Be direct.\n\n"
            f"Chat fragment:\n{history_text}\n\n"
            f"Summary:"
        )
        
        resp = await client.generate(model=MODEL_NAME, prompt=prompt)
        return resp.get('response', '').strip()
    except Exception as e:
        logger.error(f"Error generating chat summary fragment: {e}")
        return ""

async def stream_chat(conversation_id: int, user_content: str, websocket):
    # 1. Save user message to database
    save_message(conversation_id, "user", user_content)
    
    # 2. Check for conversation compression
    unarchived = get_messages(conversation_id, include_archived=False)
    
    if len(unarchived) > 16:
        logger.info(f"Active messages length is {len(unarchived)}. Initiating rolling compression...")
        to_compress = unarchived[:10]
        new_summary = await summarize_older_messages(conversation_id, to_compress)
        
        if new_summary:
            existing_summary = get_conversation_summary(conversation_id)
            if existing_summary:
                try:
                    client = AsyncClient(host=OLLAMA_HOST)
                    merge_prompt = (
                        f"Merge these two chronological summaries of a conversation into a single cohesive "
                        f"history recap under 200 words. Keep facts and settings intact.\n\n"
                        f"Old Summary:\n{existing_summary}\n\n"
                        f"New Summary:\n{new_summary}\n\n"
                        f"Merged Summary:"
                    )
                    merge_resp = await client.generate(model=MODEL_NAME, prompt=merge_prompt)
                    merged = merge_resp.get('response', '').strip()
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
            
        # Reload active history
        unarchived = get_messages(conversation_id, include_archived=False)

    formatted_history = []
    # format active messages for model context
    for msg in unarchived:
        formatted_history.append({
            "role": msg["role"],
            "content": msg["content"]
        })
        
    # 3. Build full messages array with system prompt & history summary context
    system_prompt = get_system_prompt()
    summary = get_conversation_summary(conversation_id)
    if summary:
        system_prompt += f"\n\nContext of older parts of this conversation:\n{summary}"
        
    messages = [{"role": "system", "content": system_prompt}] + formatted_history
    
    client = AsyncClient(host=OLLAMA_HOST)
    
    max_tool_iterations = 5
    iteration = 0
    total_content_accumulated = ""
    
    try:
        while iteration < max_tool_iterations:
            iteration += 1
            logger.info(f"Ollama chat iteration {iteration}/{max_tool_iterations}")
            
            tool_calls = []
            content_accumulated = ""
            
            try:
                response_stream = await client.chat(
                    model=MODEL_NAME,
                    messages=messages,
                    tools=TOOLS_SCHEMA,
                    options=OLLAMA_OPTIONS,
                    stream=True
                )
                
                telemetry_data = {}
                async for chunk in response_stream:
                    msg_chunk = chunk.get('message', {})
                    content = msg_chunk.get('content', '')
                    if content:
                        content_accumulated += content
                        total_content_accumulated += content
                        # Stream token to websocket
                        await websocket.send_json({"type": "token", "content": content})
                    
                    # Check for tool calls
                    if msg_chunk.get('tool_calls'):
                        tool_calls.extend(msg_chunk['tool_calls'])
                        
                    # Collect telemetry keys
                    for key in ["total_duration", "load_duration", "prompt_eval_duration", "eval_duration", "prompt_eval_count", "eval_count"]:
                        if key in chunk:
                            telemetry_data[key] = chunk[key]
                            
                # Log metrics if we got token counts
                prompt_tokens = telemetry_data.get("prompt_eval_count", 0)
                completion_tokens = telemetry_data.get("eval_count", 0)
                if prompt_tokens > 0 or completion_tokens > 0:
                    try:
                        from recall.telemetry import log_query_metrics
                        log_query_metrics(
                            conversation_id=conversation_id,
                            model_name=MODEL_NAME,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            total_duration_ns=telemetry_data.get("total_duration"),
                            load_duration_ns=telemetry_data.get("load_duration"),
                            prompt_eval_duration_ns=telemetry_data.get("prompt_eval_duration"),
                            eval_duration_ns=telemetry_data.get("eval_duration")
                        )
                    except Exception as tel_err:
                        logger.error(f"Error logging query telemetry: {tel_err}")
                        
            except Exception as e:
                logger.error(f"Error during Ollama call: {e}")
                err_msg = f"\nError communicating with Ollama: {str(e)}. Please check if Ollama is running and the model {MODEL_NAME} is installed."
                await websocket.send_json({"type": "token", "content": err_msg})
                # Save error message as assistant response
                save_message(conversation_id, "assistant", err_msg)
                await websocket.send_json({"type": "done", "conversation_id": conversation_id})
                return
                
            # If there are tool calls, execute them
            if tool_calls:
                logger.info(f"Model requested {len(tool_calls)} tool calls.")
                
                # Append assistant message with its tool calls to the messages history
                # The tool calls structure must be list of dicts with 'function' key
                messages.append({
                    "role": "assistant",
                    "content": content_accumulated,
                    "tool_calls": tool_calls
                })
                
                for tool_call in tool_calls:
                    # In modern ollama client, tool_call can be an object with attribute access or a dict
                    if hasattr(tool_call, 'function'):
                        name = tool_call.function.name
                        args = tool_call.function.arguments
                    else:
                        # Dict fallback
                        func = tool_call.get('function', {})
                        name = func.get('name')
                        args = func.get('arguments', {})
                    
                    # Parse arguments if it is a string
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except Exception:
                            pass
                    
                    # Notify UI of tool start
                    await websocket.send_json({
                        "type": "tool_start",
                        "name": name,
                        "args": args
                    })
                    
                    try:
                        logger.info(f"Executing tool {name} with args {args}")
                        result = dispatch_tool(name, args)
                        logger.info(f"Tool {name} result: {str(result)[:100]}...")
                    except Exception as e:
                        logger.error(f"Error executing tool {name}: {e}")
                        result = f"Error executing tool: {str(e)}"
                        
                    # Notify UI of tool result
                    await websocket.send_json({
                        "type": "tool_result",
                        "name": name,
                        "result": str(result)
                    })
                    
                    # Append tool result to messages list
                    messages.append({
                        "role": "tool",
                        "content": str(result),
                        "name": name
                    })
            else:
                # No tool calls, we are done!
                save_message(conversation_id, "assistant", content_accumulated)
                await websocket.send_json({"type": "done", "conversation_id": conversation_id})
                break
    except asyncio.CancelledError:
        logger.info(f"stream_chat task cancelled for conversation {conversation_id}")
        if total_content_accumulated:
            save_message(conversation_id, "assistant", total_content_accumulated + " [Stopped by user]")
        try:
            await websocket.send_json({"type": "done", "conversation_id": conversation_id, "status": "cancelled"})
        except Exception:
            pass
