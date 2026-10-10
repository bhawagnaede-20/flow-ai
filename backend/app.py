"""FLOW AI - simulated smart traffic management prototype backend.

A small Flask API that serves deterministic, in-memory *simulated* data for a
synthetic road network around Hyderabad. Every value returned by this API is
simulated and labelled as such.

Endpoints
---------
GET    /api/health
GET    /api/dashboard
GET    /api/roads
GET    /api/incidents
POST   /api/incidents
PATCH  /api/incidents/<incident_id>
GET    /api/predictions
POST   /api/predict
POST   /api/routes                 (Dijkstra routing over the road network)
GET    /api/emergency/missions
POST   /api/emergency/missions
PATCH  /api/emergency/missions/<mission_id>
GET    /api/impact                (illustrative simulated environmental estimates)
POST   /api/simulation/step
POST   /api/simulation/reset

Run with:  python backend/app.py   (serves on port 5000)
"""

from __future__ import annotations

import copy
import heapq
import math
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Constants and labels
# ---------------------------------------------------------------------------

API_VERSION = "1.0"
SERVICE_NAME = "flow-ai-backend"
DEFAULT_PORT = 5000
STEP_MINUTES = 5
INITIAL_CLOCK_MINUTES = 8 * 60  # simulated day starts at 08:00:00

SIMULATION_NOTICE = (
    "All values returned by this API are simulated for demonstration "
    "purposes and must not be used for real-world navigation or emergency "
    "response."
)

# CORS: restrictive and environment-based.
# FLOW_AI_ALLOWED_ORIGINS is a comma-separated list of exact origins, e.g.
#   FLOW_AI_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
# When unset (local development) only the Vite dev server on port 5173 is
# allowed. A malformed value fails fast at startup instead of silently
# loosening or breaking CORS.
DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def parse_allowed_origins(raw):
    """Parse a comma-separated origin list into a de-duplicated tuple.

    Raises ValueError for entries that are not http(s) origins so that a
    misconfigured deployment crashes at startup rather than serving
    permissive or broken CORS.
    """
    if raw is None or not raw.strip():
        raw = DEFAULT_ALLOWED_ORIGINS
    origins = []
    for item in raw.split(","):
        item = item.strip().rstrip("/")
        if not item:
            continue
        if not item.startswith(("http://", "https://")):
            raise ValueError(
                f"Invalid CORS origin {item!r} in FLOW_AI_ALLOWED_ORIGINS: "
                "must start with http:// or https://"
            )
        if item not in origins:
            origins.append(item)
    return tuple(origins) or tuple(DEFAULT_ALLOWED_ORIGINS.split(","))


CORS_ORIGINS = parse_allowed_origins(os.environ.get("FLOW_AI_ALLOWED_ORIGINS"))

# Bounding box of the simulated operating area (Hyderabad, India).
LAT_RANGE = (17.25, 17.56)
LNG_RANGE = (78.30, 78.60)

INCIDENT_TYPES = (
    "accident",
    "breakdown",
    "construction",
    "flooding",
    "signal_failure",
    "police_activity",
)
INCIDENT_SEVERITIES = ("low", "medium", "high", "critical")
INCIDENT_STATUSES = ("active", "in_progress", "resolved", "dismissed")

MISSION_UNIT_TYPES = ("ambulance", "fire", "police")
MISSION_STATUSES = ("requested", "enroute", "completed", "cancelled")

# Allowed status transitions (anything else returns 409 invalid_transition).
# Resolved/dismissed incidents can be reopened as active.
INCIDENT_TRANSITIONS = {
    "active": ("active", "in_progress", "resolved", "dismissed"),
    "in_progress": ("active", "resolved", "dismissed"),
    "resolved": ("resolved", "active"),
    "dismissed": ("dismissed", "active"),
}
# Missions run requested -> enroute -> completed; completed/cancelled are terminal.
MISSION_TRANSITIONS = {
    "requested": ("requested", "enroute", "completed", "cancelled"),
    "enroute": ("enroute", "completed", "cancelled"),
    "completed": ("completed",),
    "cancelled": ("cancelled",),
}

# Congestion pressure (points/step) that unresolved incidents add to a road.
SEVERITY_PRESSURE = {"low": 2.0, "medium": 4.0, "high": 7.0, "critical": 10.0}
MAX_INCIDENT_PRESSURE = 12.0

VEHICLE_CAPACITY = {"highway": 220, "arterial": 150, "collector": 90}

HORIZON_RANGE = (5, 120)  # minutes for prediction horizons
MAX_STEPS_PER_CALL = 12

# --- Routing (Dijkstra over the existing junction graph) -------------------
# Junction links connect named junctions up to this straight-line distance.
# They are simulated corridor links (labelled "corridor_link" in responses),
# not additional modelled roads.
JUNCTION_LINK_MAX_KM = 9.0
JUNCTION_LINK_SPEED_KMH = 30.0  # fixed modelled speed for corridor links
# Dijkstra edge cost = travel_time * (1 + aversion * congestion/100) where
# higher-priority missions are more congestion-averse.
PRIORITY_CONGESTION_AVERSION = 0.20  # per priority level (priority 1 = 0.80)
# Simulated intersection-priority time saving: priority 1 = 12%, 5 = 0%.
PRIORITY_TIME_SAVING_PER_LEVEL = 0.03
ROUTING_DISCLAIMER = (
    "Simulated routing for this prototype only - no real ambulance dispatch "
    "and no real traffic-signal control is performed."
)

# --- Predictions -----------------------------------------------------------
PREDICTION_RECOMMENDATIONS = {
    "smooth": "No action needed - continue routine monitoring (simulated advisory).",
    "moderate": (
        "Plan ahead: minor delays likely; monitor downstream junctions "
        "(simulated advisory)."
    ),
    "congested": (
        "Expect delays: consider alternate corridors for non-emergency trips "
        "(simulated advisory)."
    ),
    "gridlock": (
        "Severe delays likely: avoid the corridor where possible; prioritize "
        "incident clearance (simulated advisory)."
    ),
}

# --- Environmental impact (illustrative simulated estimates) ---------------
FUEL_FREE_FLOW_L_PER_100KM = 7.0  # petrol passenger car baseline
FUEL_CONGESTION_PENALTY = 0.50    # up to +50% L/100km at congestion=100
IDLE_FUEL_L_PER_HOUR = 0.9        # fuel burned while delayed
CO2_KG_PER_LITRE = 2.31           # petrol combustion factor
IMPACT_ASSUMPTIONS = [
    "Illustrative simulated estimates only - not measured data and not "
    "measured savings.",
    "Free-flow baseline: each road at its free_flow_speed_kmh with zero "
    "congestion; corridor links at 30 km/h.",
    "Vehicle counts are simulated occupancy estimates derived from "
    "congestion, not sensor measurements.",
    "Fuel: 7.0 L/100km free-flow baseline plus a congestion penalty scaling "
    "to +50% L/100km at 100 congestion.",
    "Idling fuel: 0.9 L per simulated vehicle-hour spent delayed.",
    "Emissions: 2.31 kg CO2 per litre of petrol combusted.",
    "Mission-route estimates cover a single simulated vehicle over its "
    "computed route.",
]

# ---------------------------------------------------------------------------
# Seed data - synthetic but geographically coherent network around Hyderabad
# ---------------------------------------------------------------------------

SEED_ROADS = [
    {
        "id": "road-orr-west",
        "name": "Outer Ring Road (West Segment)",
        "category": "highway",
        "from": {"name": "Madhapur Gate", "lat": 17.4435, "lng": 78.3772},
        "to": {"name": "Kukatpally", "lat": 17.4849, "lng": 78.4138},
        "length_km": 8.6,
        "free_flow_speed_kmh": 80.0,
        "congestion": 55.0,
    },
    {
        "id": "road-orr-south",
        "name": "Outer Ring Road (South Segment)",
        "category": "highway",
        "from": {"name": "Attapur", "lat": 17.352, "lng": 78.428},
        "to": {"name": "Nagole", "lat": 17.4259, "lng": 78.5597},
        "length_km": 21.4,
        "free_flow_speed_kmh": 80.0,
        "congestion": 38.0,
    },
    {
        "id": "road-hitec-city",
        "name": "HITEC City Corridor",
        "category": "arterial",
        "from": {"name": "Cyber Towers", "lat": 17.4479, "lng": 78.3874},
        "to": {"name": "Gachibowli Circle", "lat": 17.449, "lng": 78.359},
        "length_km": 4.1,
        "free_flow_speed_kmh": 50.0,
        "congestion": 62.0,
    },
    {
        "id": "road-gachibowli-miyapur",
        "name": "Gachibowli-Miyapur Road",
        "category": "arterial",
        "from": {"name": "Gachibowli", "lat": 17.44, "lng": 78.3489},
        "to": {"name": "Miyapur", "lat": 17.5037, "lng": 78.3931},
        "length_km": 9.7,
        "free_flow_speed_kmh": 55.0,
        "congestion": 47.0,
    },
    {
        "id": "road-nehru-marg",
        "name": "Nehru Marg",
        "category": "arterial",
        "from": {"name": "Mehdipatnam", "lat": 17.4017, "lng": 78.4467},
        "to": {"name": "Begumpet", "lat": 17.4444, "lng": 78.463},
        "length_km": 5.6,
        "free_flow_speed_kmh": 45.0,
        "congestion": 68.0,
    },
    {
        "id": "road-banjara-hills",
        "name": "Banjara Hills Road No. 1",
        "category": "collector",
        "from": {"name": "Nagarjuna Circle", "lat": 17.4114, "lng": 78.4374},
        "to": {"name": "Jubilee Hills Check Post", "lat": 17.4313, "lng": 78.4074},
        "length_km": 3.9,
        "free_flow_speed_kmh": 40.0,
        "congestion": 44.0,
    },
    {
        "id": "road-necklace",
        "name": "Necklace Road",
        "category": "collector",
        "from": {"name": "NTR Marg", "lat": 17.4212, "lng": 78.4743},
        "to": {"name": "Panjagutta", "lat": 17.4303, "lng": 78.4506},
        "length_km": 3.3,
        "free_flow_speed_kmh": 40.0,
        "congestion": 50.0,
    },
    {
        "id": "road-sardar-patel",
        "name": "Sardar Patel Road (SD Road)",
        "category": "arterial",
        "from": {"name": "Secunderabad Junction", "lat": 17.4315, "lng": 78.5013},
        "to": {"name": "Begumpet", "lat": 17.4444, "lng": 78.463},
        "length_km": 4.6,
        "free_flow_speed_kmh": 45.0,
        "congestion": 58.0,
    },
    {
        "id": "road-charminar-mehdipatnam",
        "name": "Charminar-Mehdipatnam Road",
        "category": "collector",
        "from": {"name": "Charminar", "lat": 17.361, "lng": 78.4735},
        "to": {"name": "Mehdipatnam", "lat": 17.4017, "lng": 78.4467},
        "length_km": 5.3,
        "free_flow_speed_kmh": 35.0,
        "congestion": 66.0,
    },
    {
        "id": "road-uppal-nagole",
        "name": "Uppal-Nagole Road",
        "category": "collector",
        "from": {"name": "Uppal", "lat": 17.4126, "lng": 78.556},
        "to": {"name": "Nagole", "lat": 17.4259, "lng": 78.5597},
        "length_km": 2.7,
        "free_flow_speed_kmh": 40.0,
        "congestion": 40.0,
    },
    {
        "id": "road-kphb-kukatpally",
        "name": "KPHB-Kukatpally Road",
        "category": "collector",
        "from": {"name": "KPHB Phase 1", "lat": 17.5077, "lng": 78.4104},
        "to": {"name": "Kukatpally", "lat": 17.4849, "lng": 78.4138},
        "length_km": 2.9,
        "free_flow_speed_kmh": 40.0,
        "congestion": 52.0,
    },
    {
        "id": "road-srisailam-hwy",
        "name": "Srisailam Highway",
        "category": "highway",
        "from": {"name": "LB Nagar", "lat": 17.3608, "lng": 78.5525},
        "to": {"name": "Hayathnagar", "lat": 17.312, "lng": 78.556},
        "length_km": 6.8,
        "free_flow_speed_kmh": 70.0,
        "congestion": 30.0,
    },
]

SEED_INCIDENTS = [
    {
        "id": "inc-0001",
        "type": "accident",
        "severity": "high",
        "status": "active",
        "road_id": "road-nehru-marg",
        "location": {"lat": 17.431, "lng": 78.454},
        "description": "Multi-vehicle collision near Ameerpet junction.",
        "reported_at": "07:35:00",
        "simulated": True,
    },
    {
        "id": "inc-0002",
        "type": "construction",
        "severity": "medium",
        "status": "in_progress",
        "road_id": "road-hitec-city",
        "location": {"lat": 17.4479, "lng": 78.3874},
        "description": "Lane closure for utility work outside Cyber Towers.",
        "reported_at": "06:50:00",
        "simulated": True,
    },
    {
        "id": "inc-0003",
        "type": "breakdown",
        "severity": "low",
        "status": "resolved",
        "road_id": "road-charminar-mehdipatnam",
        "location": {"lat": 17.361, "lng": 78.4735},
        "description": "Stalled goods vehicle cleared from carriageway.",
        "reported_at": "05:40:00",
        "simulated": True,
    },
]

SEED_MISSIONS = [
    {
        "id": "emg-0001",
        "unit_type": "ambulance",
        "priority": 1,
        "status": "enroute",
        "origin": {"lat": 17.3608, "lng": 78.5525},
        "destination": {"lat": 17.4479, "lng": 78.3874},
        "origin_road_id": "road-srisailam-hwy",
        "destination_road_id": "road-hitec-city",
        "notes": "Critical patient transfer to hospital.",
        "requested_at": "07:55:00",
        "simulated": True,
    },
    {
        "id": "emg-0002",
        "unit_type": "fire",
        "priority": 2,
        "status": "requested",
        "origin": {"lat": 17.4017, "lng": 78.4467},
        "destination": {"lat": 17.361, "lng": 78.4735},
        "origin_road_id": "road-nehru-marg",
        "destination_road_id": "road-charminar-mehdipatnam",
        "notes": "Market area fire response.",
        "requested_at": "07:58:00",
        "simulated": True,
    },
]

# Initial congestion per road id; kept separately so simulation dynamics stay
# deterministic across resets.
INITIAL_CONGESTION = {road["id"]: road["congestion"] for road in SEED_ROADS}

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------


def _initial_state():
    return {
        "step": 0,
        "clock_minutes": INITIAL_CLOCK_MINUTES,
        "roads": copy.deepcopy(SEED_ROADS),
        "incidents": copy.deepcopy(SEED_INCIDENTS),
        "missions": copy.deepcopy(SEED_MISSIONS),
        "incident_seq": len(SEED_INCIDENTS),
        "mission_seq": len(SEED_MISSIONS),
    }


STATE = _initial_state()


def reset_state():
    """Restore the deterministic initial dataset (used by reset + tests)."""
    global STATE
    STATE = _initial_state()
    return STATE


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def _clamp(value, low, high):
    return max(low, min(high, value))


def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _clock(minutes=None):
    minutes = STATE["clock_minutes"] if minutes is None else minutes
    minutes = int(minutes) % (24 * 60)
    return f"{minutes // 60:02d}:{minutes % 60:02d}:00"


def _congestion_status(congestion):
    if congestion < 40.0:
        return "smooth"
    if congestion < 65.0:
        return "moderate"
    if congestion < 85.0:
        return "congested"
    return "gridlock"


def _in_operating_area(lat, lng):
    return LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LNG_RANGE[0] <= lng <= LNG_RANGE[1]


def _haversine_km(lat1, lng1, lat2, lng2):
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _road_midpoint(road):
    start, end = road["from"], road["to"]
    return (start["lat"] + end["lat"]) / 2.0, (start["lng"] + end["lng"]) / 2.0


def _nearest_road_id(lat, lng):
    """Nearest seed road (by midpoint) to a coordinate - ties break by order."""
    best_id, best_dist = None, float("inf")
    for road in SEED_ROADS:
        mid_lat, mid_lng = _road_midpoint(road)
        dist = _haversine_km(lat, lng, mid_lat, mid_lng)
        if dist < best_dist:
            best_id, best_dist = road["id"], dist
    return best_id


def _find_road(road_id):
    for road in STATE["roads"]:
        if road["id"] == road_id:
            return road
    return None


def _find_incident(incident_id):
    for incident in STATE["incidents"]:
        if incident["id"] == incident_id:
            return incident
    return None


def _find_mission(mission_id):
    for mission in STATE["missions"]:
        if mission["id"] == mission_id:
            return mission
    return None


def _road_phase(road_id):
    """Deterministic per-road phase used by simulation and prediction."""
    for index, road in enumerate(STATE["roads"]):
        if road["id"] == road_id:
            return index * 0.9
    return 0.0


def _active_incidents(road_id=None):
    incidents = [
        i for i in STATE["incidents"] if i["status"] in ("active", "in_progress")
    ]
    if road_id is not None:
        incidents = [i for i in incidents if i["road_id"] == road_id]
    return incidents


def _road_pressure(road_id):
    """Congestion pressure from unresolved incidents on a road (capped)."""
    total = sum(
        SEVERITY_PRESSURE[i["severity"]] for i in _active_incidents(road_id)
    )
    return min(total, MAX_INCIDENT_PRESSURE)


def _public_road(road):
    """Road record with derived (simulated) traffic values."""
    congestion = round(float(road["congestion"]), 1)
    speed = road["free_flow_speed_kmh"] * (1.0 - 0.75 * congestion / 100.0)
    capacity = VEHICLE_CAPACITY[road["category"]]
    vehicles = int(round(capacity * (0.2 + 0.8 * congestion / 100.0)))
    return {
        "id": road["id"],
        "name": road["name"],
        "category": road["category"],
        "from": road["from"],
        "to": road["to"],
        "length_km": road["length_km"],
        "free_flow_speed_kmh": road["free_flow_speed_kmh"],
        "congestion": congestion,
        "status": _congestion_status(congestion),
        "avg_speed_kmh": round(max(8.0, speed), 1),
        "vehicle_count": vehicles,
        "simulated": True,
    }


# ---------------------------------------------------------------------------
# Routing graph (Dijkstra over the existing junction network)
# ---------------------------------------------------------------------------
# The graph reuses the named junctions of the seed roads. Straight-line
# "corridor links" (at most JUNCTION_LINK_MAX_KM apart) join nearby junctions
# so a route can cross the simulated city; links are labelled "corridor_link"
# in responses and are never presented as additional modelled roads.

def _build_network_graph():
    nodes = {}
    for road in SEED_ROADS:
        for endpoint in (road["from"], road["to"]):
            nodes.setdefault(
                endpoint["name"],
                {"lat": endpoint["lat"], "lng": endpoint["lng"]},
            )

    road_pairs = set()
    edges = []
    for road in SEED_ROADS:
        start, end = road["from"]["name"], road["to"]["name"]
        road_pairs.add(frozenset((start, end)))
        edges.append(
            {
                "kind": "road",
                "road_id": road["id"],
                "a": start,
                "b": end,
                "km": float(road["length_km"]),
            }
        )

    names = sorted(nodes)
    for index, start in enumerate(names):
        for end in names[index + 1 :]:
            if frozenset((start, end)) in road_pairs:
                continue
            distance = _haversine_km(
                nodes[start]["lat"],
                nodes[start]["lng"],
                nodes[end]["lat"],
                nodes[end]["lng"],
            )
            if 0.0 < distance <= JUNCTION_LINK_MAX_KM:
                edges.append(
                    {
                        "kind": "corridor_link",
                        "road_id": None,
                        "a": start,
                        "b": end,
                        "km": round(distance, 3),
                    }
                )

    adjacency = {name: [] for name in names}
    for edge in edges:
        adjacency[edge["a"]].append((edge["b"], edge))
        adjacency[edge["b"]].append((edge["a"], edge))
    for name in adjacency:
        adjacency[name].sort(key=lambda item: item[0])  # deterministic order
    return {"nodes": nodes, "adjacency": adjacency}


# Static graph structure, built once; edge weights use live simulated state.
NETWORK = _build_network_graph()


def _network_average_congestion():
    roads = STATE["roads"]
    return sum(float(road["congestion"]) for road in roads) / len(roads)


def _edge_travel_time_min(edge, link_congestion):
    """Travel time (minutes) for one graph edge at the current state.

    Roads slow with their own congestion; corridor links slow with the
    network-average congestion (documented simplification).
    """
    if edge["kind"] == "road":
        road = _find_road(edge["road_id"])
        congestion = float(road["congestion"])
        speed = max(
            8.0, road["free_flow_speed_kmh"] * (1.0 - 0.75 * congestion / 100.0)
        )
    else:
        congestion = link_congestion
        speed = max(
            8.0, JUNCTION_LINK_SPEED_KMH * (1.0 - 0.75 * congestion / 100.0)
        )
    return edge["km"] / speed * 60.0, congestion


def _edge_free_flow_time_min(edge):
    if edge["kind"] == "road":
        road = _find_road(edge["road_id"])
        return edge["km"] / road["free_flow_speed_kmh"] * 60.0
    return edge["km"] / JUNCTION_LINK_SPEED_KMH * 60.0


def _nearest_junction(lat, lng):
    best_name, best_dist = None, float("inf")
    for name in sorted(NETWORK["nodes"]):
        node = NETWORK["nodes"][name]
        dist = _haversine_km(lat, lng, node["lat"], node["lng"])
        if dist < best_dist:
            best_name, best_dist = name, dist
    return best_name


def _dijkstra(source, target, priority):
    """Least-cost path between two junctions.

    Edge cost = travel time x (1 + congestion aversion x congestion/100).
    Higher-priority missions (1 = highest) are more congestion-averse, so the
    selected route can change with priority. Returns (cost, path) or None.
    """
    aversion = (5 - priority) * PRIORITY_CONGESTION_AVERSION
    link_congestion = _network_average_congestion()
    best_cost = {source: 0.0}
    previous = {}
    queue = [(0.0, source)]
    visited = set()
    while queue:
        cost_u, node = heapq.heappop(queue)
        if node in visited:
            continue
        visited.add(node)
        if node == target:
            break
        for neighbour, edge in NETWORK["adjacency"][node]:
            if neighbour in visited:
                continue
            minutes, congestion = _edge_travel_time_min(edge, link_congestion)
            weight = minutes * (1.0 + aversion * congestion / 100.0)
            candidate = cost_u + weight
            if candidate < best_cost.get(neighbour, float("inf")):
                best_cost[neighbour] = candidate
                previous[neighbour] = (node, edge)
                heapq.heappush(queue, (candidate, neighbour))
    if target not in best_cost:
        return None
    path = []
    node = target
    while node != source:
        prev_node, edge = previous[node]
        path.append((prev_node, node, edge))
        node = prev_node
    path.reverse()
    return best_cost[target], path


def _compute_route(origin, destination, priority):
    """Dijkstra route between the junctions nearest to two coordinates.

    Returns a dict with segments, times, simulated intersection priority and
    illustrative fuel/emission estimates. Always reachable-false on failure.
    """
    source = _nearest_junction(origin["lat"], origin["lng"])
    target = _nearest_junction(destination["lat"], destination["lng"])
    saving_pct = round((5 - priority) * PRIORITY_TIME_SAVING_PER_LEVEL, 3)
    route = {
        "origin_junction": source,
        "destination_junction": target,
        "priority": priority,
        "reachable": False,
        "segments": [],
        "road_ids": [],
        "distance_km": 0.0,
        "free_flow_time_min": 0.0,
        "raw_travel_time_min": 0.0,
        "travel_time_min": 0.0,
        "cost": 0.0,
        "congestion_exposure": 0.0,
        "priority_time_saved_min": 0.0,
        "simulated_intersection_priority": {
            "saving_pct": saving_pct,
            "note": ROUTING_DISCLAIMER,
        },
        "estimates": {
            "delay_min": 0.0,
            "excess_fuel_l": 0.0,
            "excess_co2_kg": 0.0,
            "note": "Illustrative simulated estimate - not measured savings.",
        },
        "simulated": True,
        "disclaimer": ROUTING_DISCLAIMER,
    }

    if source == target:
        route["reachable"] = True
        route["message"] = (
            "Origin and destination resolve to the same simulated junction."
        )
        return route

    link_congestion = _network_average_congestion()
    found = _dijkstra(source, target, priority)
    if found is None:
        route["message"] = "No simulated path exists between these junctions."
        return route

    cost, path = found
    segments = []
    raw_time = 0.0
    free_flow_time = 0.0
    distance = 0.0
    weighted_congestion = 0.0
    excess_fuel = 0.0
    for start, end, edge in path:
        minutes, congestion = _edge_travel_time_min(edge, link_congestion)
        free_flow_time += _edge_free_flow_time_min(edge)
        segment = {
            "from": start,
            "to": end,
            "type": edge["kind"],
            "distance_km": round(edge["km"], 3),
            "travel_time_min": round(minutes, 1),
            "congestion": round(congestion, 1),
        }
        if edge["kind"] == "road":
            segment["road_id"] = edge["road_id"]
            segment["road_name"] = _find_road(edge["road_id"])["name"]
        excess_fuel += (
            (edge["km"] / 100.0)
            * FUEL_FREE_FLOW_L_PER_100KM
            * FUEL_CONGESTION_PENALTY
            * (congestion / 100.0)
        )
        segments.append(segment)
        raw_time += minutes
        distance += edge["km"]
        weighted_congestion += minutes * congestion

    delay = max(0.0, raw_time - free_flow_time)
    excess_fuel += (delay / 60.0) * IDLE_FUEL_L_PER_HOUR
    saved = raw_time * (saving_pct)
    exposure = weighted_congestion / raw_time if raw_time else 0.0

    route.update(
        {
            "reachable": True,
            "segments": segments,
            "road_ids": [
                segment["road_id"] for segment in segments if segment["type"] == "road"
            ],
            "distance_km": round(distance, 3),
            "free_flow_time_min": round(free_flow_time, 1),
            "raw_travel_time_min": round(raw_time, 1),
            "travel_time_min": round(raw_time - saved, 1),
            "priority_time_saved_min": round(saved, 1),
            "cost": round(cost, 2),
            "congestion_exposure": round(exposure, 1),
            "estimates": {
                "delay_min": round(delay, 1),
                "excess_fuel_l": round(excess_fuel, 3),
                "excess_co2_kg": round(excess_fuel * CO2_KG_PER_LITRE, 3),
                "note": "Illustrative simulated estimate - not measured savings.",
            },
        }
    )
    return route


def _mission_view(mission):
    """Mission payload with a freshly computed simulated route."""
    view = dict(mission)
    view["route"] = _compute_route(
        mission["origin"], mission["destination"], mission["priority"]
    )
    return view


# ---------------------------------------------------------------------------
# Response helpers (consistent envelope)
# ---------------------------------------------------------------------------


def _meta():
    return {
        "simulated": True,
        "api_version": API_VERSION,
        "notice": SIMULATION_NOTICE,
    }


def _ok(data, status=200):
    response = jsonify({"ok": True, "data": data, "meta": _meta()})
    response.status_code = status
    return response


def _error(code, message, status):
    response = jsonify(
        {"ok": False, "error": {"code": code, "message": message}, "meta": _meta()}
    )
    response.status_code = status
    return response


def _required_json_body():
    """Return the JSON object body or None when missing/invalid."""
    body = request.get_json(silent=True)
    if isinstance(body, dict):
        return body
    return None


def _optional_json_body():
    """Return {} when no body is sent, a dict when valid, or None otherwise."""
    if not request.data:
        return {}
    body = request.get_json(silent=True)
    if isinstance(body, dict):
        return body
    return None


# ---------------------------------------------------------------------------
# Prediction logic (deterministic heuristic - no trained model yet)
# ---------------------------------------------------------------------------


def _predict(road_id, horizon_minutes):
    road = _find_road(road_id)
    if road is None:
        return None
    phase = _road_phase(road_id)
    horizon_steps = max(1, int(round(horizon_minutes / STEP_MINUTES)))
    step = STATE["step"]
    base = float(road["congestion"])
    wave_now = math.sin(0.7 * step + phase)
    wave_later = math.sin(0.7 * (step + horizon_steps) + phase)
    trend = (wave_later - wave_now) * 6.0
    pressure = _road_pressure(road_id)
    bias = pressure * min(horizon_steps, 4) * 0.25
    predicted = _clamp(base + trend + bias, 5.0, 100.0)

    factors = ["current_congestion", "deterministic_demand_wave"]
    if pressure > 0:
        factors.append(f"active_incident_pressure:{pressure:g}")

    category = _congestion_status(predicted)
    delta = predicted - base
    if delta > 0.5:
        direction = "rising"
    elif delta < -0.5:
        direction = "falling"
    else:
        direction = "stable"

    return {
        "road_id": road["id"],
        "road_name": road["name"],
        "horizon_minutes": horizon_minutes,
        "current_congestion": round(base, 1),
        "predicted_congestion": round(predicted, 1),
        "delta_congestion": round(delta, 1),
        "category": category,
        "predicted_status": category,
        "trend": direction,
        "risk_score": int(round(_clamp(predicted, 0.0, 100.0))),
        "confidence": 0.6,
        "factors": factors,
        "recommendation": PREDICTION_RECOMMENDATIONS[category],
        "method": "deterministic_heuristic",
        "simulated": True,
    }


def _prediction_for_horizon(horizon_minutes):
    return [
        _predict(road["id"], horizon_minutes) for road in STATE["roads"]
    ]


# ---------------------------------------------------------------------------
# Simulation logic
# ---------------------------------------------------------------------------


def _advance_one_step():
    """Advance the simulation by one 5-minute step (fully deterministic)."""
    STATE["step"] += 1
    STATE["clock_minutes"] += STEP_MINUTES
    step = STATE["step"]
    for road in STATE["roads"]:
        phase = _road_phase(road["id"])
        initial = INITIAL_CONGESTION[road["id"]]
        pressure = _road_pressure(road["id"])
        target = initial + math.sin(0.7 * step + phase) * 8.0 + pressure
        pull = (target - float(road["congestion"])) * 0.35
        road["congestion"] = round(
            _clamp(float(road["congestion"]) + pull, 5.0, 100.0), 1
        )


# ---------------------------------------------------------------------------
# App and CORS
# ---------------------------------------------------------------------------

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": CORS_ORIGINS}},
    methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/api/health")
def health():
    return _ok(
        {
            "status": "healthy",
            "service": SERVICE_NAME,
            "api_version": API_VERSION,
            "simulation": {
                "step": STATE["step"],
                "clock": _clock(),
                "running": True,
            },
            "notice": SIMULATION_NOTICE,
        }
    )


@app.get("/api/roads")
def list_roads():
    roads = [_public_road(road) for road in STATE["roads"]]
    return _ok({"count": len(roads), "roads": roads})


@app.get("/api/incidents")
def list_incidents():
    incidents = STATE["incidents"]
    return _ok({"count": len(incidents), "incidents": incidents})


@app.post("/api/incidents")
def create_incident():
    body = _required_json_body()
    if body is None:
        return _error("invalid_json", "Request body must be a JSON object.", 400)

    road_id = body.get("road_id")
    if not isinstance(road_id, str) or not road_id:
        return _error(
            "validation_error",
            "road_id is required and must be a non-empty string.",
            400,
        )
    road = _find_road(road_id)
    if road is None:
        return _error(
            "validation_error",
            f"road_id '{road_id}' does not exist in the simulated network.",
            400,
        )

    itype = body.get("type")
    if itype not in INCIDENT_TYPES:
        return _error(
            "validation_error",
            f"type must be one of: {', '.join(INCIDENT_TYPES)}.",
            400,
        )

    severity = body.get("severity", "medium")
    if severity not in INCIDENT_SEVERITIES:
        return _error(
            "validation_error",
            f"severity must be one of: {', '.join(INCIDENT_SEVERITIES)}.",
            400,
        )

    status = body.get("status", "active")
    if status not in INCIDENT_STATUSES:
        return _error(
            "validation_error",
            f"status must be one of: {', '.join(INCIDENT_STATUSES)}.",
            400,
        )

    description = body.get("description", "")
    if not isinstance(description, str):
        return _error(
            "validation_error", "description must be a string.", 400
        )

    location = body.get("location")
    if location is None:
        midpoint_lat, midpoint_lng = _road_midpoint(road)
        location = {"lat": midpoint_lat, "lng": midpoint_lng}
    else:
        if not isinstance(location, dict):
            return _error(
                "validation_error",
                "location must be an object with numeric lat and lng.",
                400,
            )
        lat, lng = location.get("lat"), location.get("lng")
        if not _is_number(lat) or not _is_number(lng):
            return _error(
                "validation_error",
                "location.lat and location.lng must be numbers.",
                400,
            )
        if not _in_operating_area(lat, lng):
            return _error(
                "validation_error",
                "location is outside the simulated Hyderabad operating area.",
                400,
            )
        location = {"lat": float(lat), "lng": float(lng)}

    STATE["incident_seq"] += 1
    incident = {
        "id": f"inc-{STATE['incident_seq']:04d}",
        "type": itype,
        "severity": severity,
        "status": status,
        "road_id": road_id,
        "location": location,
        "description": description,
        "reported_at": _clock(),
        "simulated": True,
    }
    STATE["incidents"].append(incident)
    return _ok({"incident": incident}, status=201)


@app.patch("/api/incidents/<incident_id>")
def update_incident(incident_id):
    incident = _find_incident(incident_id)
    if incident is None:
        return _error(
            "not_found", f"Incident '{incident_id}' was not found.", 404
        )

    body = _required_json_body()
    if body is None:
        return _error("invalid_json", "Request body must be a JSON object.", 400)

    allowed = {"status", "severity", "description"}
    unknown = sorted(set(body) - allowed)
    if unknown:
        return _error(
            "validation_error",
            f"Unknown field(s): {', '.join(unknown)}. Allowed: {', '.join(sorted(allowed))}.",
            400,
        )
    if not body:
        return _error(
            "validation_error",
            f"At least one of {', '.join(sorted(allowed))} must be provided.",
            400,
        )

    updates = {}
    if "status" in body:
        if body["status"] not in INCIDENT_STATUSES:
            return _error(
                "validation_error",
                f"status must be one of: {', '.join(INCIDENT_STATUSES)}.",
                400,
            )
        if body["status"] != incident["status"]:
            allowed_transitions = INCIDENT_TRANSITIONS[incident["status"]]
            if body["status"] not in allowed_transitions:
                return _error(
                    "invalid_transition",
                    f"Incident '{incident_id}' cannot move from "
                    f"'{incident['status']}' to '{body['status']}'. "
                    f"Allowed from '{incident['status']}': "
                    f"{', '.join(allowed_transitions)}.",
                    409,
                )
        updates["status"] = body["status"]
    if "severity" in body:
        if body["severity"] not in INCIDENT_SEVERITIES:
            return _error(
                "validation_error",
                f"severity must be one of: {', '.join(INCIDENT_SEVERITIES)}.",
                400,
            )
        updates["severity"] = body["severity"]
    if "description" in body:
        if not isinstance(body["description"], str):
            return _error(
                "validation_error", "description must be a string.", 400
            )
        updates["description"] = body["description"]

    # Apply only after every field validated (atomic update).
    incident.update(updates)
    return _ok({"incident": incident})


@app.get("/api/predictions")
def list_predictions():
    horizon = 30  # default horizon, minutes
    raw = request.args.get("horizon_minutes")
    if raw is not None:
        try:
            horizon = int(raw)
        except (TypeError, ValueError):
            return _error(
                "validation_error",
                f"horizon_minutes must be an integer between {HORIZON_RANGE[0]} and {HORIZON_RANGE[1]}.",
                400,
            )
        if not HORIZON_RANGE[0] <= horizon <= HORIZON_RANGE[1]:
            return _error(
                "validation_error",
                f"horizon_minutes must be between {HORIZON_RANGE[0]} and {HORIZON_RANGE[1]}.",
                400,
            )

    predictions = _prediction_for_horizon(horizon)
    return _ok(
        {
            "horizon_minutes": horizon,
            "method": "deterministic_heuristic",
            "model_trained": False,
            "count": len(predictions),
            "predictions": predictions,
        }
    )


@app.post("/api/predict")
def predict():
    body = _required_json_body()
    if body is None:
        return _error("invalid_json", "Request body must be a JSON object.", 400)

    unknown = sorted(set(body) - {"road_id", "minutes_ahead"})
    if unknown:
        return _error(
            "validation_error",
            f"Unknown field(s): {', '.join(unknown)}. "
            "Allowed: minutes_ahead, road_id.",
            400,
        )

    road_id = body.get("road_id")
    if not isinstance(road_id, str) or not road_id:
        return _error(
            "validation_error",
            "road_id is required and must be a non-empty string.",
            400,
        )
    if _find_road(road_id) is None:
        return _error(
            "not_found", f"Road '{road_id}' was not found.", 404
        )

    horizon = body.get("minutes_ahead", 30)
    if not _is_int(horizon) or not HORIZON_RANGE[0] <= horizon <= HORIZON_RANGE[1]:
        return _error(
            "validation_error",
            f"minutes_ahead must be an integer between {HORIZON_RANGE[0]} and {HORIZON_RANGE[1]}.",
            400,
        )

    return _ok({"prediction": _predict(road_id, horizon)})


@app.get("/api/emergency/missions")
def list_missions():
    missions = STATE["missions"]
    return _ok(
        {"count": len(missions), "missions": [_mission_view(m) for m in missions]}
    )


@app.post("/api/emergency/missions")
def create_mission():
    body = _required_json_body()
    if body is None:
        return _error("invalid_json", "Request body must be a JSON object.", 400)

    unit_type = body.get("unit_type")
    if unit_type not in MISSION_UNIT_TYPES:
        return _error(
            "validation_error",
            f"unit_type must be one of: {', '.join(MISSION_UNIT_TYPES)}.",
            400,
        )

    def _read_point(field):
        point = body.get(field)
        if not isinstance(point, dict):
            return None, _error(
                "validation_error",
                f"{field} must be an object with numeric lat and lng.",
                400,
            )
        lat, lng = point.get("lat"), point.get("lng")
        if not _is_number(lat) or not _is_number(lng):
            return None, _error(
                "validation_error",
                f"{field}.lat and {field}.lng must be numbers.",
                400,
            )
        if not _in_operating_area(lat, lng):
            return None, _error(
                "validation_error",
                f"{field} is outside the simulated Hyderabad operating area.",
                400,
            )
        return {"lat": float(lat), "lng": float(lng)}, None

    origin, error = _read_point("origin")
    if error is not None:
        return error
    destination, error = _read_point("destination")
    if error is not None:
        return error

    priority = body.get("priority", 3)
    if not _is_int(priority) or not 1 <= priority <= 5:
        return _error(
            "validation_error", "priority must be an integer between 1 and 5.", 400
        )

    notes = body.get("notes", "")
    if not isinstance(notes, str):
        return _error("validation_error", "notes must be a string.", 400)

    STATE["mission_seq"] += 1
    mission = {
        "id": f"emg-{STATE['mission_seq']:04d}",
        "unit_type": unit_type,
        "priority": priority,
        "status": "requested",
        "origin": origin,
        "destination": destination,
        "origin_road_id": _nearest_road_id(origin["lat"], origin["lng"]),
        "destination_road_id": _nearest_road_id(
            destination["lat"], destination["lng"]
        ),
        "notes": notes,
        "requested_at": _clock(),
        "simulated": True,
    }
    STATE["missions"].append(mission)
    return _ok({"mission": _mission_view(mission)}, status=201)


@app.patch("/api/emergency/missions/<mission_id>")
def update_mission(mission_id):
    mission = _find_mission(mission_id)
    if mission is None:
        return _error(
            "not_found", f"Mission '{mission_id}' was not found.", 404
        )

    body = _required_json_body()
    if body is None:
        return _error("invalid_json", "Request body must be a JSON object.", 400)

    allowed = {"status", "priority", "notes"}
    unknown = sorted(set(body) - allowed)
    if unknown:
        return _error(
            "validation_error",
            f"Unknown field(s): {', '.join(unknown)}. Allowed: {', '.join(sorted(allowed))}.",
            400,
        )
    if not body:
        return _error(
            "validation_error",
            f"At least one of {', '.join(sorted(allowed))} must be provided.",
            400,
        )

    updates = {}
    if "status" in body:
        if body["status"] not in MISSION_STATUSES:
            return _error(
                "validation_error",
                f"status must be one of: {', '.join(MISSION_STATUSES)}.",
                400,
            )
        if body["status"] != mission["status"]:
            allowed_transitions = MISSION_TRANSITIONS[mission["status"]]
            if body["status"] not in allowed_transitions:
                return _error(
                    "invalid_transition",
                    f"Mission '{mission_id}' cannot move from "
                    f"'{mission['status']}' to '{body['status']}'. "
                    f"Allowed from '{mission['status']}': "
                    f"{', '.join(allowed_transitions)}.",
                    409,
                )
        updates["status"] = body["status"]
    if "priority" in body:
        value = body["priority"]
        if not _is_int(value) or not 1 <= value <= 5:
            return _error(
                "validation_error",
                "priority must be an integer between 1 and 5.",
                400,
            )
        updates["priority"] = value
    if "notes" in body:
        if not isinstance(body["notes"], str):
            return _error("validation_error", "notes must be a string.", 400)
        updates["notes"] = body["notes"]

    # Apply only after every field validated (atomic update); a priority
    # change re-routes the mission on the next view.
    mission.update(updates)
    return _ok({"mission": _mission_view(mission)})


@app.post("/api/routes")
def compute_route():
    """Dijkstra route between two points (or two roads) of the network."""
    body = _required_json_body()
    if body is None:
        return _error("invalid_json", "Request body must be a JSON object.", 400)

    unknown = sorted(set(body) - {"origin", "destination", "priority"})
    if unknown:
        return _error(
            "validation_error",
            f"Unknown field(s): {', '.join(unknown)}. "
            "Allowed: destination, origin, priority.",
            400,
        )

    def _resolve(field):
        spec = body.get(field)
        if not isinstance(spec, dict):
            return None, _error(
                "validation_error",
                f"{field} must be an object with lat/lng or a road_id.",
                400,
            )
        if "road_id" in spec:
            road_id = spec["road_id"]
            road = _find_road(road_id) if isinstance(road_id, str) else None
            if road is None:
                return None, _error(
                    "validation_error",
                    f"{field}.road_id does not exist in the simulated network.",
                    400,
                )
            mid_lat, mid_lng = _road_midpoint(road)
            return {"lat": mid_lat, "lng": mid_lng}, None
        lat, lng = spec.get("lat"), spec.get("lng")
        if not _is_number(lat) or not _is_number(lng):
            return None, _error(
                "validation_error",
                f"{field} must contain numeric lat and lng (or road_id).",
                400,
            )
        if not _in_operating_area(float(lat), float(lng)):
            return None, _error(
                "validation_error",
                f"{field} is outside the simulated Hyderabad operating area.",
                400,
            )
        return {"lat": float(lat), "lng": float(lng)}, None

    origin, error = _resolve("origin")
    if error is not None:
        return error
    destination, error = _resolve("destination")
    if error is not None:
        return error

    priority = body.get("priority", 3)
    if not _is_int(priority) or not 1 <= priority <= 5:
        return _error(
            "validation_error", "priority must be an integer between 1 and 5.", 400
        )

    return _ok({"route": _compute_route(origin, destination, priority)})


@app.get("/api/impact")
def environmental_impact():
    """Illustrative simulated time/fuel/emissions estimates.

    Derived only from data the API actually has: road length, free-flow speed,
    simulated congestion and simulated vehicle counts (plus mission routes).
    """
    road_rows = []
    totals = {"delay_vehicle_hours": 0.0, "fuel_liters": 0.0, "co2_kg": 0.0}
    for road in STATE["roads"]:
        published = _public_road(road)
        length = float(road["length_km"])
        congestion = published["congestion"]
        vehicles = published["vehicle_count"]
        free_flow_hours = length / road["free_flow_speed_kmh"]
        actual_hours = length / published["avg_speed_kmh"]
        delay_vehicle_hours = max(0.0, actual_hours - free_flow_hours) * vehicles
        fuel_liters = (
            (length / 100.0)
            * vehicles
            * (FUEL_FREE_FLOW_L_PER_100KM * FUEL_CONGESTION_PENALTY * congestion / 100.0)
            + delay_vehicle_hours * IDLE_FUEL_L_PER_HOUR
        )
        co2_kg = fuel_liters * CO2_KG_PER_LITRE
        totals["delay_vehicle_hours"] += delay_vehicle_hours
        totals["fuel_liters"] += fuel_liters
        totals["co2_kg"] += co2_kg
        road_rows.append(
            {
                "road_id": road["id"],
                "name": road["name"],
                "congestion": congestion,
                "vehicle_count": vehicles,
                "delay_vehicle_hours": round(delay_vehicle_hours, 2),
                "fuel_liters": round(fuel_liters, 3),
                "co2_kg": round(co2_kg, 3),
            }
        )

    mission_rows = []
    mission_totals = {
        "routes_estimated": 0,
        "routes_unreachable": 0,
        "delay_minutes": 0.0,
        "excess_fuel_liters": 0.0,
        "excess_co2_kg": 0.0,
    }
    for mission in STATE["missions"]:
        route = _compute_route(
            mission["origin"], mission["destination"], mission["priority"]
        )
        row = {
            "mission_id": mission["id"],
            "unit_type": mission["unit_type"],
            "priority": mission["priority"],
            "reachable": route["reachable"],
        }
        if not route["reachable"]:
            mission_totals["routes_unreachable"] += 1
            mission_rows.append(row)
            continue
        estimates = route["estimates"]
        mission_totals["routes_estimated"] += 1
        mission_totals["delay_minutes"] += estimates["delay_min"]
        mission_totals["excess_fuel_liters"] += estimates["excess_fuel_l"]
        mission_totals["excess_co2_kg"] += estimates["excess_co2_kg"]
        row.update(
            {
                "distance_km": route["distance_km"],
                "delay_min": estimates["delay_min"],
                "excess_fuel_l": estimates["excess_fuel_l"],
                "excess_co2_kg": estimates["excess_co2_kg"],
            }
        )
        mission_rows.append(row)

    return _ok(
        {
            "simulation": {"step": STATE["step"], "clock": _clock()},
            "network": {
                "road_count": len(road_rows),
                "delay_vehicle_hours": round(totals["delay_vehicle_hours"], 2),
                "fuel_liters": round(totals["fuel_liters"], 3),
                "co2_kg": round(totals["co2_kg"], 3),
                "roads": road_rows,
            },
            "missions": {
                "routes_estimated": mission_totals["routes_estimated"],
                "routes_unreachable": mission_totals["routes_unreachable"],
                "delay_minutes_total": round(mission_totals["delay_minutes"], 1),
                "excess_fuel_liters_total": round(
                    mission_totals["excess_fuel_liters"], 3
                ),
                "excess_co2_kg_total": round(mission_totals["excess_co2_kg"], 3),
                "missions": mission_rows,
            },
            "assumptions": list(IMPACT_ASSUMPTIONS),
            "units": {
                "time": "vehicle-hours (network) / minutes (missions)",
                "fuel": "litres",
                "emissions": "kg CO2",
            },
            "notice": (
                "Illustrative simulated estimates only - not measured data "
                "and not measured savings."
            ),
        }
    )


@app.get("/api/dashboard")
def dashboard():
    public_roads = [_public_road(road) for road in STATE["roads"]]
    road_count = len(public_roads)
    avg_congestion = round(
        sum(r["congestion"] for r in public_roads) / road_count, 1
    )
    avg_speed = round(
        sum(r["avg_speed_kmh"] for r in public_roads) / road_count, 1
    )
    total_vehicles = sum(r["vehicle_count"] for r in public_roads)

    breakdown = {"smooth": 0, "moderate": 0, "congested": 0, "gridlock": 0}
    for road in public_roads:
        breakdown[road["status"]] += 1

    busiest = sorted(
        public_roads, key=lambda r: (-r["congestion"], r["id"])
    )[:3]

    active_incidents = _active_incidents()
    by_severity = {level: 0 for level in INCIDENT_SEVERITIES}
    by_type = {itype: 0 for itype in INCIDENT_TYPES}
    for incident in active_incidents:
        by_severity[incident["severity"]] += 1
        by_type[incident["type"]] += 1
    resolved_incidents = [
        i for i in STATE["incidents"] if i["status"] == "resolved"
    ]
    dismissed_incidents = [
        i for i in STATE["incidents"] if i["status"] == "dismissed"
    ]

    missions = STATE["missions"]
    active_missions = [m for m in missions if m["status"] in ("requested", "enroute")]
    missions_by_unit = {unit: 0 for unit in MISSION_UNIT_TYPES}
    missions_by_status = {status: 0 for status in MISSION_STATUSES}
    for mission in missions:
        missions_by_unit[mission["unit_type"]] += 1
        missions_by_status[mission["status"]] += 1

    riskiest = sorted(
        _prediction_for_horizon(30),
        key=lambda p: (-p["risk_score"], p["road_id"]),
    )[:3]

    return _ok(
        {
            "simulation": {"step": STATE["step"], "clock": _clock()},
            "summary": {
                "roads_monitored": road_count,
                "avg_congestion": avg_congestion,
                "avg_speed_kmh": avg_speed,
                "vehicles_observed": total_vehicles,
                "active_incidents": len(active_incidents),
                "active_missions": len(active_missions),
            },
            "congestion_breakdown": breakdown,
            "busiest_roads": [
                {
                    "road_id": r["id"],
                    "name": r["name"],
                    "congestion": r["congestion"],
                    "status": r["status"],
                }
                for r in busiest
            ],
            "incidents": {
                "total": len(STATE["incidents"]),
                "active": len(active_incidents),
                "resolved": len(resolved_incidents),
                "dismissed": len(dismissed_incidents),
                "by_severity": by_severity,
                "by_type": by_type,
            },
            "emergency": {
                "total": len(missions),
                "active": len(active_missions),
                "by_unit_type": missions_by_unit,
                "by_status": missions_by_status,
            },
            "highest_risk_roads": [
                {
                    "road_id": p["road_id"],
                    "risk_score": p["risk_score"],
                    "predicted_status": p["predicted_status"],
                }
                for p in riskiest
            ],
            "notice": SIMULATION_NOTICE,
        }
    )


@app.post("/api/simulation/step")
def simulation_step():
    body = _optional_json_body()
    if body is None:
        return _error("invalid_json", "Request body must be a JSON object.", 400)

    steps = body.get("steps", 1)
    if not _is_int(steps) or not 1 <= steps <= MAX_STEPS_PER_CALL:
        return _error(
            "validation_error",
            f"steps must be an integer between 1 and {MAX_STEPS_PER_CALL}.",
            400,
        )

    for _ in range(steps):
        _advance_one_step()

    roads = [_public_road(road) for road in STATE["roads"]]
    return _ok(
        {
            "step": STATE["step"],
            "clock": _clock(),
            "steps_applied": steps,
            "count": len(roads),
            "roads": roads,
        }
    )


@app.post("/api/simulation/reset")
def simulation_reset():
    reset_state()
    roads = [_public_road(road) for road in STATE["roads"]]
    return _ok(
        {
            "step": STATE["step"],
            "clock": _clock(),
            "message": "Simulation reset to deterministic initial data.",
            "count": len(roads),
            "roads": roads,
        }
    )


# ---------------------------------------------------------------------------
# Error handlers (JSON for every failure mode)
# ---------------------------------------------------------------------------


@app.errorhandler(400)
def handle_bad_request(_error_obj):
    return _error("bad_request", "The request could not be understood.", 400)


@app.errorhandler(404)
def handle_not_found(_error_obj):
    return _error(
        "not_found", "The requested endpoint or resource was not found.", 404
    )


@app.errorhandler(405)
def handle_method_not_allowed(_error_obj):
    return _error(
        "method_not_allowed", "The HTTP method is not allowed for this endpoint.", 405
    )


@app.errorhandler(409)
def handle_conflict(_error_obj):
    return _error(
        "conflict", "The request conflicts with the current resource state.", 409
    )


@app.errorhandler(500)
def handle_internal_error(_error_obj):
    return _error("internal_error", "An unexpected server error occurred.", 500)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Safe local defaults (127.0.0.1:5000). Hosting platforms inject PORT;
    # FLOW_AI_PORT / FLOW_AI_HOST override either. Use 0.0.0.0 as
    # FLOW_AI_HOST only when the platform requires external binding.
    host = os.environ.get("FLOW_AI_HOST", "127.0.0.1")
    port = int(
        os.environ.get("FLOW_AI_PORT") or os.environ.get("PORT") or DEFAULT_PORT
    )
    app.run(host=host, port=port, debug=False)
