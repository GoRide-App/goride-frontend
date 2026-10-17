"""Local stand-in for goride-location's POST /rides/plan, used only for load tests.

The real endpoint asks the public OpenRouteService API for a road route. Stressing that
free third-party API would be inappropriate and would measure their capacity, not ours,
so heavy profiles point trip-matching's Location__BaseUrl at this stub instead
(service virtualisation). It answers instantly with a road-like estimate:
straight-line distance x 1.3 and an average city speed of 25 km/h.

Usage: python location_stub.py [--port 18081]
"""
import argparse
import json
import math
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROAD_FACTOR = 1.3
CITY_SPEED_KMH = 25.0


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class Handler(BaseHTTPRequestHandler):
    # Keep connections open so trip-matching reuses them, like it would with the real service.
    protocol_version = "HTTP/1.1"
    # Headers and body go out as separate writes; without this, Nagle + delayed ACK stall each reply.
    disable_nagle_algorithm = True

    def read_body(self):
        # .NET's PostAsJsonAsync streams JSON with Transfer-Encoding: chunked and no Content-Length.
        if "chunked" in self.headers.get("Transfer-Encoding", "").lower():
            data = b""
            while True:
                size = int(self.rfile.readline().split(b";")[0].strip(), 16)
                if size == 0:
                    while self.rfile.readline() not in (b"\r\n", b"\n", b""):
                        pass  # skip optional trailers
                    return data
                data += self.rfile.read(size)
                self.rfile.readline()  # CRLF after each chunk
        return self.rfile.read(int(self.headers.get("Content-Length", 0)))

    def do_POST(self):
        if self.path.rstrip("/") != "/rides/plan":
            self.send_error(404)
            return
        try:
            body = json.loads(self.read_body() or b"{}")
            km = haversine_km(float(body["pickupLat"]), float(body["pickupLng"]),
                              float(body["destinationLat"]), float(body["destinationLng"])) * ROAD_FACTOR
        except (KeyError, TypeError, ValueError):
            self.send_error(400)
            return
        payload = json.dumps({"distanceKm": round(km, 2),
                              "durationMinutes": round(km / CITY_SPEED_KMH * 60, 1)}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_):  # keep the console quiet under load
        pass


class StubServer(ThreadingHTTPServer):
    # socketserver's default listen backlog is 5. A 200-user burst overflows it, Windows refuses
    # the extra connections and the client retries ~0.5 s later, which showed up as fake latency.
    request_queue_size = 128
    daemon_threads = True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=18081)
    args = parser.parse_args()
    server = StubServer(("127.0.0.1", args.port), Handler)
    print(f"location stub on http://127.0.0.1:{args.port}/rides/plan")
    server.serve_forever()
