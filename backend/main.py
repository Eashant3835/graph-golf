import json
import random
import string

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()
rooms = {}  # code -> room


def new_code():
    while True:
        code = "".join(random.choices(string.ascii_uppercase, k=4))
        if code not in rooms:
            return code


async def send(ws, msg):
    try:
        await ws.send_text(json.dumps(msg))
    except Exception:
        pass  # the other side already left


async def send_all(room, msg):
    for p in room["players"]:
        await send(p["ws"], msg)


@app.websocket("/ws")
async def endpoint(ws: WebSocket):
    await ws.accept()
    room = None
    me = None
    try:
        while True:
            msg = json.loads(await ws.receive_text())
            kind = msg.get("type")

            if kind == "create":
                code = new_code()
                me = {"ws": ws, "idx": 0, "finished": False, "shots": 0, "time": 0}
                room = {
                    "code": code,
                    "players": [me],
                    "turn": 0,
                    "seed": random.randint(1, 10**9),
                    "started": False,
                }
                rooms[code] = room
                await send(ws, {"type": "created", "code": code})

            elif kind == "join":
                r = rooms.get(str(msg.get("code", "")).upper())
                if not r or len(r["players"]) >= 2:
                    await send(ws, {"type": "error", "message": "Room not found or full"})
                    continue
                room = r
                me = {"ws": ws, "idx": 1, "finished": False, "shots": 0, "time": 0}
                room["players"].append(me)
                room["started"] = True
                for p in room["players"]:
                    await send(p["ws"], {
                        "type": "start",
                        "seed": room["seed"],
                        "you": p["idx"],
                        "turn": 0,
                    })

            elif kind in ("shot", "timeout") and room and room["started"]:
                if me["idx"] != room["turn"]:
                    continue  # not your turn, ignore
                me["shots"] = msg.get("shots", me["shots"])
                me["time"] = msg.get("timeMs", me["time"])
                me["finished"] = bool(msg.get("finished"))

                await send_all(room, {
                    "type": "shot",
                    "player": me["idx"],
                    "timeout": kind == "timeout",
                    "equation": msg.get("equation"),
                    "dir": msg.get("dir"),
                    "stopDx": msg.get("stopDx"),
                    "shots": me["shots"],
                    "finished": me["finished"],
                })

                if all(p["finished"] for p in room["players"]):
                    await send_all(room, {
                        "type": "over",
                        "results": [{"shots": p["shots"], "timeMs": p["time"]} for p in room["players"]],
                    })
                    continue

                other = 1 - me["idx"]
                # if the other player is already done, you keep shooting
                room["turn"] = me["idx"] if room["players"][other]["finished"] else other
                await send_all(room, {"type": "turn", "player": room["turn"]})

    except WebSocketDisconnect:
        pass
    finally:
        if room:
            await send_all(room, {"type": "left"})
            rooms.pop(room["code"], None)
