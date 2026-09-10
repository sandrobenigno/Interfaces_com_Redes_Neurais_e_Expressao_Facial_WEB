"""
bridge_osc.py
Bridge WebSocket -> UDP/OSC para PureData, Processing, SuperCollider, etc.

Recebe mensagens JSON da aplicacao Web (Broadcast/WebSocket) e despacha
pacotes binarios UDP formatados segundo o padrao Open Sound Control (OSC).

Mensagens suportadas:
  - Evento:
      /piscou          [float earL, float earR]
  - Periodicos:
      /head/angles     [float pitch, float roll, float yaw]
      /eye/open        [float left, float right]
      /mouth/mar       [float mar]

      /brow/raise      [float browL, float browR]

Uso:
  python bridge_osc.py --port 12345
  python bridge_osc.py --ip 127.0.0.1 --port 12345 --ws-port 8081
"""

import argparse
import asyncio
import json
import sys

try:
    import websockets
    from pythonosc.udp_client import SimpleUDPClient
except ImportError:
    print("Dependencias ausentes. Instale executando:")
    print("pip install websockets python-osc")
    sys.exit(1)

def parse_args():
    parser = argparse.ArgumentParser(description="Ponte WebSocket -> OSC UDP para PureData/Processing")
    parser.add_argument("--ip", default="127.0.0.1", help="Endereco IP de destino OSC (Padrao: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=12345, help="Porta UDP de destino OSC (Ex: 12345 para PureData)")
    parser.add_argument("--ws-host", default="127.0.0.1", help="Host do servidor WebSocket local")
    parser.add_argument("--ws-port", type=int, default=8081, help="Porta do servidor WebSocket local (Padrao: 8081)")
    return parser.parse_args()

async def main():
    args = parse_args()
    osc_client = SimpleUDPClient(args.ip, args.port)

    print("=" * 60)
    print("   BRIDGE WEBSOCKET -> UDP / OSC EXPANDIDA")
    print("=" * 60)
    print(f" Servidor WebSocket: ws://{args.ws_host}:{args.ws_port}")
    print(f" Destino OSC (UDP) : {args.ip}:{args.port}")
    print(" Aguardando conexao da aplicacao Web (GitHub Pages / Local)...")
    print(" Pressione Ctrl+C para encerrar.")
    print("=" * 60)

    connected_clients = set()

    async def handle_client(websocket):
        client_addr = websocket.remote_address
        connected_clients.add(websocket)
        print(f"[+] Cliente Web conectado: {client_addr}")
        try:
            async for raw_msg in websocket:
                try:
                    payload = json.loads(raw_msg)
                    address = payload.get("address", "")
                    data = payload.get("data", {})

                    if address == "/piscou":
                        ear_l = float(data.get("earL", 0.0))
                        ear_r = float(data.get("earR", 0.0))
                        osc_client.send_message("/piscou", [ear_l, ear_r])
                        print(f" [EVENTO] /piscou -> ({ear_l:.2f}, {ear_r:.2f})")

                    elif address == "/head/angles":
                        pitch = float(data.get("pitch", 0.0))
                        roll = float(data.get("roll", 0.0))
                        yaw = float(data.get("yaw", 0.0))
                        osc_client.send_message("/head/angles", [pitch, roll, yaw])

                    elif address == "/eye/open":
                        left = float(data.get("left", 0.0))
                        right = float(data.get("right", 0.0))
                        osc_client.send_message("/eye/open", [left, right])

                    elif address == "/mouth/mar":
                        mar = float(data.get("mar", 0.0))
                        osc_client.send_message("/mouth/mar", [mar])



                    elif address == "/brow/raise":
                        left = float(data.get("left", 0.0))
                        right = float(data.get("right", 0.0))
                        osc_client.send_message("/brow/raise", [left, right])

                    else:
                        val = float(data.get("value", 1.0))
                        osc_client.send_message(address, [val])

                except json.JSONDecodeError:
                    pass
                except Exception as e:
                    print(f"[!] Erro ao repassar pacote OSC: {e}")

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            connected_clients.remove(websocket)
            print(f"[-] Cliente Web desconectado: {client_addr}")

    async with websockets.serve(handle_client, args.ws_host, args.ws_port):
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBridge finalizada pelo usuario.")

