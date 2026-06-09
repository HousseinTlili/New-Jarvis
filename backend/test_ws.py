import asyncio
import websockets
import json
import requests

async def test_chat():
    api_url = "http://127.0.0.1:8765"
    ws_url = "ws://127.0.0.1:8765/ws/chat"
    
    print("1. Creating conversation via REST...")
    try:
        resp = requests.post(f"{api_url}/conversations", json={"title": "Test Chat"})
        resp.raise_for_status()
        conv = resp.json()
        conv_id = conv["id"]
        print(f"Conversation created with ID: {conv_id}")
    except Exception as e:
        print(f"Error creating conversation: {e}")
        return
        
    print("\n2. Connecting to WebSocket...")
    try:
        async with websockets.connect(ws_url) as websocket:
            print("Connected! Sending message...")
            payload = {
                "type": "chat",
                "conversation_id": conv_id,
                "content": "Hello! What is your name and what time is it?"
            }
            await websocket.send(json.dumps(payload))
            
            print("Waiting for response...")
            while True:
                response = await websocket.recv()
                msg = json.loads(response)
                
                msg_type = msg.get("type")
                if msg_type == "token":
                    print(msg.get("content"), end="", flush=True)
                elif msg_type == "tool_start":
                    print(f"\n[Tool Start: {msg.get('name')} with args {msg.get('args')}]")
                elif msg_type == "tool_result":
                    print(f"\n[Tool Result: {msg.get('name')} returned: {msg.get('result')}]")
                elif msg_type == "done":
                    print("\n[Done! Chat complete]")
                    break
                elif msg_type == "error":
                    print(f"\n[Error: {msg.get('message')}]")
                    break
    except Exception as e:
        print(f"\nWebSocket connection failed: {e}")

if __name__ == "__main__":
    print("Starting WebSocket Client Test...")
    asyncio.run(test_chat())
