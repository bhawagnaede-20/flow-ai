"""Endpoint tests for the FLOW AI backend.

Every test starts from the deterministic initial dataset (see conftest.py).
"""

import pytest

SEED_ROAD_IDS = {
    "road-orr-west",
    "road-orr-south",
    "road-hitec-city",
    "road-gachibowli-miyapur",
    "road-nehru-marg",
    "road-banjara-hills",
    "road-necklace",
    "road-sardar-patel",
    "road-charminar-mehdipatnam",
    "road-uppal-nagole",
    "road-kphb-kukatpally",
    "road-srisailam-hwy",
}

ACTIVE_INCIDENT_STATUSES = ("active", "in_progress")
ACTIVE_MISSION_STATUSES = ("requested", "enroute")


def get_data(response):
    """Assert a success envelope and return its data payload."""
    payload = response.get_json()
    assert payload is not None, "response must be JSON"
    assert payload["ok"] is True
    assert payload["meta"]["simulated"] is True
    return payload["data"]


def get_error(response, status):
    """Assert an error envelope with the given status; return the payload."""
    assert response.status_code == status
    payload = response.get_json()
    assert payload["ok"] is False
    assert payload["error"]["code"]
    assert payload["error"]["message"]
    assert payload["meta"]["simulated"] is True
    return payload


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = get_data(response)
    assert data["status"] == "healthy"
    assert data["service"] == "flow-ai-backend"
    assert data["simulation"]["step"] == 0
    assert data["simulation"]["clock"] == "08:00:00"
    assert "simulated" in data["notice"].lower()


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------


def test_cors_allows_local_frontend(client):
    origin = "http://localhost:5173"
    response = client.get("/api/roads", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers.get("Access-Control-Allow-Origin") == origin


def test_cors_disallowed_origin_gets_no_cors_header(client):
    """A foreign origin still gets a normal response, but no CORS grant."""
    response = client.get("/api/roads", headers={"Origin": "https://evil.example.com"})
    assert response.status_code == 200
    assert response.headers.get("Access-Control-Allow-Origin") is None


# ---------------------------------------------------------------------------
# CORS origin parsing (environment-based configuration)
# ---------------------------------------------------------------------------


def test_parse_allowed_origins_defaults_when_unset():
    from app import DEFAULT_ALLOWED_ORIGINS, parse_allowed_origins

    assert parse_allowed_origins(None) == tuple(DEFAULT_ALLOWED_ORIGINS.split(","))
    assert parse_allowed_origins("") == tuple(DEFAULT_ALLOWED_ORIGINS.split(","))
    assert parse_allowed_origins("   ") == tuple(DEFAULT_ALLOWED_ORIGINS.split(","))


def test_parse_allowed_origins_parses_dedupes_and_strips():
    from app import parse_allowed_origins

    raw = " https://a.example.com ,https://b.example.com/,https://a.example.com,"
    assert parse_allowed_origins(raw) == (
        "https://a.example.com",
        "https://b.example.com",
    )


def test_parse_allowed_origins_rejects_non_http_values():
    import pytest as _pytest

    from app import parse_allowed_origins

    with _pytest.raises(ValueError):
        parse_allowed_origins("example.com")
    with _pytest.raises(ValueError):
        parse_allowed_origins("ftp://files.example.com")


def test_cors_preflight_for_post(client):
    response = client.open(
        "/api/incidents",
        method="OPTIONS",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert (
        response.headers.get("Access-Control-Allow-Origin")
        == "http://localhost:5173"
    )
    assert "POST" in response.headers.get("Access-Control-Allow-Methods", "")


# ---------------------------------------------------------------------------
# Roads
# ---------------------------------------------------------------------------


def test_roads_shape_and_stable_ids(client):
    data = get_data(client.get("/api/roads"))
    roads = data["roads"]
    assert data["count"] == len(roads) == len(SEED_ROAD_IDS)
    assert {road["id"] for road in roads} == SEED_ROAD_IDS
    assert data["count"] >= 8

    for road in roads:
        assert road["simulated"] is True
        assert 0.0 <= road["congestion"] <= 100.0
        assert road["status"] in ("smooth", "moderate", "congested", "gridlock")
        assert road["avg_speed_kmh"] > 0
        assert road["vehicle_count"] > 0
        # Geographically coherent: every endpoint inside the Hyderabad area.
        for point in (road["from"], road["to"]):
            assert 17.25 <= point["lat"] <= 17.56
            assert 78.30 <= point["lng"] <= 78.60


def test_roads_derived_values_are_consistent(client):
    roads = get_data(client.get("/api/roads"))["roads"]
    for road in roads:
        expected = (
            "smooth"
            if road["congestion"] < 40
            else "moderate"
            if road["congestion"] < 65
            else "congested"
            if road["congestion"] < 85
            else "gridlock"
        )
        assert road["status"] == expected
        speed = road["free_flow_speed_kmh"] * (1 - 0.75 * road["congestion"] / 100)
        assert road["avg_speed_kmh"] == round(max(8.0, speed), 1)


# ---------------------------------------------------------------------------
# Dashboard consistency with the other endpoints
# ---------------------------------------------------------------------------


def test_dashboard_is_calculated_from_shared_data(client):
    roads = get_data(client.get("/api/roads"))["roads"]
    incidents = get_data(client.get("/api/incidents"))["incidents"]
    missions = get_data(client.get("/api/emergency/missions"))["missions"]

    data = get_data(client.get("/api/dashboard"))
    summary = data["summary"]

    assert summary["roads_monitored"] == len(roads)
    expected_avg = round(sum(r["congestion"] for r in roads) / len(roads), 1)
    assert summary["avg_congestion"] == pytest.approx(expected_avg)
    assert summary["vehicles_observed"] == sum(r["vehicle_count"] for r in roads)

    expected_active_incidents = sum(
        1 for i in incidents if i["status"] in ACTIVE_INCIDENT_STATUSES
    )
    assert summary["active_incidents"] == expected_active_incidents
    assert data["incidents"]["total"] == len(incidents)
    assert sum(data["incidents"]["by_severity"].values()) == expected_active_incidents

    expected_active_missions = sum(
        1 for m in missions if m["status"] in ACTIVE_MISSION_STATUSES
    )
    assert summary["active_missions"] == expected_active_missions
    assert data["emergency"]["total"] == len(missions)

    assert sum(data["congestion_breakdown"].values()) == len(roads)
    busiest = data["busiest_roads"]
    assert all(
        busiest[i]["congestion"] >= busiest[i + 1]["congestion"]
        for i in range(len(busiest) - 1)
    )

    # Creating an incident through the API is reflected in the dashboard.
    before = summary["active_incidents"]
    client.post(
        "/api/incidents",
        json={"road_id": "road-orr-west", "type": "flooding", "severity": "high"},
    )
    after = get_data(client.get("/api/dashboard"))["summary"]
    assert after["active_incidents"] == before + 1


# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------


def test_incidents_seed_list(client):
    data = get_data(client.get("/api/incidents"))
    assert data["count"] == 3
    ids = [i["id"] for i in data["incidents"]]
    assert ids == ["inc-0001", "inc-0002", "inc-0003"]
    statuses = {i["status"] for i in data["incidents"]}
    assert statuses == {"active", "in_progress", "resolved"}


def test_create_incident_success(client):
    response = client.post(
        "/api/incidents",
        json={
            "road_id": "road-orr-west",
            "type": "accident",
            "severity": "high",
            "description": "Simulated collision.",
        },
    )
    assert response.status_code == 201
    incident = get_data(response)["incident"]
    assert incident["id"] == "inc-0004"  # stable, sequential ids
    assert incident["status"] == "active"
    assert incident["road_id"] == "road-orr-west"
    assert incident["reported_at"] == "08:00:00"
    assert incident["simulated"] is True
    # location defaults to the road midpoint
    assert incident["location"]["lat"] == pytest.approx(
        (17.4435 + 17.4849) / 2
    )

    listed = get_data(client.get("/api/incidents"))
    assert listed["count"] == 4
    assert incident["id"] in [i["id"] for i in listed["incidents"]]


def test_create_incident_defaults_to_medium_severity(client):
    response = client.post(
        "/api/incidents", json={"road_id": "road-necklace", "type": "breakdown"}
    )
    assert response.status_code == 201
    assert get_data(response)["incident"]["severity"] == "medium"


@pytest.mark.parametrize(
    "body",
    [
        {},  # missing road_id
        {"road_id": "road-does-not-exist", "type": "accident"},
        {"road_id": "road-orr-west", "type": "alien_invasion"},
        {"road_id": "road-orr-west", "type": "accident", "severity": "apocalyptic"},
        {"road_id": "road-orr-west", "type": "accident", "status": "deleted"},
        {"road_id": "road-orr-west", "type": "accident", "description": 42},
        {
            "road_id": "road-orr-west",
            "type": "accident",
            "location": {"lat": 99.0, "lng": 78.4},
        },
    ],
)
def test_create_incident_validation_errors(client, body):
    get_error(client.post("/api/incidents", json=body), 400)


def test_create_incident_invalid_json_body(client):
    response = client.post(
        "/api/incidents", data="{not-json", content_type="application/json"
    )
    get_error(response, 400)


def test_patch_incident_success(client):
    response = client.patch(
        "/api/incidents/inc-0001",
        json={"status": "resolved", "severity": "medium"},
    )
    assert response.status_code == 200
    incident = get_data(response)["incident"]
    assert incident["status"] == "resolved"
    assert incident["severity"] == "medium"

    listed = get_data(client.get("/api/incidents"))["incidents"]
    updated = next(i for i in listed if i["id"] == "inc-0001")
    assert updated["status"] == "resolved"


def test_patch_incident_unknown_id_returns_404(client):
    get_error(client.patch("/api/incidents/inc-9999", json={"status": "resolved"}), 404)


def test_patch_incident_validation_errors(client):
    get_error(client.patch("/api/incidents/inc-0001", json={}), 400)
    get_error(
        client.patch("/api/incidents/inc-0001", json={"status": "archived"}), 400
    )
    get_error(
        client.patch("/api/incidents/inc-0001", json={"nonsense": 1}), 400
    )
    get_error(client.patch("/api/incidents/inc-0001", json={"description": 7}), 400)


# ---------------------------------------------------------------------------
# Predictions (deterministic heuristic, no trained model)
# ---------------------------------------------------------------------------


def test_predictions_list(client):
    data = get_data(client.get("/api/predictions"))
    assert data["horizon_minutes"] == 30
    assert data["model_trained"] is False
    assert data["method"] == "deterministic_heuristic"
    assert data["count"] == len(SEED_ROAD_IDS)
    assert {p["road_id"] for p in data["predictions"]} == SEED_ROAD_IDS
    for prediction in data["predictions"]:
        assert 0 <= prediction["predicted_congestion"] <= 100
        assert 0 <= prediction["risk_score"] <= 100
        assert 0.0 < prediction["confidence"] <= 1.0
        assert prediction["simulated"] is True


def test_predictions_horizon_query_param(client):
    data = get_data(client.get("/api/predictions?horizon_minutes=60"))
    assert data["horizon_minutes"] == 60
    assert all(p["horizon_minutes"] == 60 for p in data["predictions"])

    get_error(client.get("/api/predictions?horizon_minutes=abc"), 400)
    get_error(client.get("/api/predictions?horizon_minutes=999"), 400)
    get_error(client.get("/api/predictions?horizon_minutes=0"), 400)


def test_predict_single_road(client):
    response = client.post(
        "/api/predict", json={"road_id": "road-nehru-marg", "minutes_ahead": 15}
    )
    assert response.status_code == 200
    prediction = get_data(response)["prediction"]
    assert prediction["road_id"] == "road-nehru-marg"
    assert prediction["horizon_minutes"] == 15
    assert 0 <= prediction["predicted_congestion"] <= 100
    # An active high-severity incident sits on this road and is a factor.
    assert any("incident" in factor for factor in prediction["factors"])


def test_predict_defaults_to_30_minutes(client):
    prediction = get_data(
        client.post("/api/predict", json={"road_id": "road-orr-west"})
    )["prediction"]
    assert prediction["horizon_minutes"] == 30


def test_predict_error_cases(client):
    get_error(client.post("/api/predict", json={}), 400)
    get_error(
        client.post("/api/predict", json={"road_id": "road-nowhere"}), 404
    )
    get_error(
        client.post(
            "/api/predict",
            json={"road_id": "road-orr-west", "minutes_ahead": 500},
        ),
        400,
    )
    get_error(
        client.post(
            "/api/predict",
            json={"road_id": "road-orr-west", "minutes_ahead": "soon"},
        ),
        400,
    )
    get_error(
        client.post("/api/predict", data="nope", content_type="application/json"),
        400,
    )


# ---------------------------------------------------------------------------
# Emergency missions
# ---------------------------------------------------------------------------


def test_missions_seed_list(client):
    data = get_data(client.get("/api/emergency/missions"))
    assert data["count"] == 2
    assert [m["id"] for m in data["missions"]] == ["emg-0001", "emg-0002"]


def test_create_mission_success(client):
    # Exact midpoint of road-nehru-marg -> nearest road is deterministic.
    origin = {"lat": (17.4017 + 17.4444) / 2, "lng": (78.4467 + 78.463) / 2}
    response = client.post(
        "/api/emergency/missions",
        json={
            "unit_type": "ambulance",
            "priority": 1,
            "origin": origin,
            "destination": {"lat": 17.4479, "lng": 78.3874},
            "notes": "Simulated dispatch.",
        },
    )
    assert response.status_code == 201
    mission = get_data(response)["mission"]
    assert mission["id"] == "emg-0003"
    assert mission["status"] == "requested"
    assert mission["origin_road_id"] == "road-nehru-marg"
    assert mission["destination_road_id"] in SEED_ROAD_IDS
    assert mission["requested_at"] == "08:00:00"
    assert mission["simulated"] is True

    listed = get_data(client.get("/api/emergency/missions"))
    assert listed["count"] == 3


def test_create_mission_validation_errors(client):
    valid_point = {"lat": 17.4479, "lng": 78.3874}
    cases = [
        {},  # missing everything
        {"unit_type": "helicopter", "origin": valid_point, "destination": valid_point},
        {"unit_type": "ambulance", "destination": valid_point},  # no origin
        {
            "unit_type": "ambulance",
            "origin": {"lat": 12.9, "lng": 77.6},  # outside operating area
            "destination": valid_point,
        },
        {
            "unit_type": "ambulance",
            "origin": valid_point,
            "destination": {"lat": "x", "lng": "y"},
        },
        {
            "unit_type": "ambulance",
            "origin": valid_point,
            "destination": valid_point,
            "priority": 9,
        },
        {
            "unit_type": "ambulance",
            "origin": valid_point,
            "destination": valid_point,
            "notes": ["not", "a", "string"],
        },
    ]
    for body in cases:
        get_error(client.post("/api/emergency/missions", json=body), 400)


def test_patch_mission_success(client):
    response = client.patch(
        "/api/emergency/missions/emg-0002", json={"status": "enroute", "priority": 1}
    )
    assert response.status_code == 200
    mission = get_data(response)["mission"]
    assert mission["status"] == "enroute"
    assert mission["priority"] == 1

    listed = get_data(client.get("/api/emergency/missions"))["missions"]
    updated = next(m for m in listed if m["id"] == "emg-0002")
    assert updated["status"] == "enroute"


def test_patch_mission_errors(client):
    get_error(
        client.patch("/api/emergency/missions/emg-9999", json={"status": "enroute"}),
        404,
    )
    get_error(client.patch("/api/emergency/missions/emg-0001", json={}), 400)
    get_error(
        client.patch("/api/emergency/missions/emg-0001", json={"status": "flying"}),
        400,
    )
    get_error(
        client.patch("/api/emergency/missions/emg-0001", json={"priority": 0}), 400
    )
    get_error(
        client.patch("/api/emergency/missions/emg-0001", json={"color": "red"}), 400
    )


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------


def test_simulation_step_changes_traffic(client):
    before = {
        road["id"]: road
        for road in get_data(client.get("/api/roads"))["roads"]
    }

    response = client.post("/api/simulation/step", json={})
    assert response.status_code == 200
    data = get_data(response)
    assert data["step"] == 1
    assert data["clock"] == "08:05:00"
    assert data["steps_applied"] == 1

    after = {road["id"]: road for road in data["roads"]}
    assert set(after) == set(before)
    changed = [
        road_id
        for road_id in after
        if after[road_id]["congestion"] != before[road_id]["congestion"]
    ]
    assert len(changed) == len(after), "every road's traffic must change"
    # Derived values must follow the new congestion.
    assert any(
        after[road_id]["avg_speed_kmh"] != before[road_id]["avg_speed_kmh"]
        for road_id in after
    )


def test_simulation_multiple_steps(client):
    data = get_data(client.post("/api/simulation/step", json={"steps": 3}))
    assert data["step"] == 3
    assert data["clock"] == "08:15:00"
    assert data["steps_applied"] == 3
    # The dashboard reads the same state and reports the new step.
    assert get_data(client.get("/api/dashboard"))["simulation"]["step"] == 3


def test_simulation_step_validation_errors(client):
    get_error(client.post("/api/simulation/step", json={"steps": 0}), 400)
    get_error(client.post("/api/simulation/step", json={"steps": 100}), 400)
    get_error(client.post("/api/simulation/step", json={"steps": "two"}), 400)
    get_error(
        client.post("/api/simulation/step", json=[1, 2, 3]), 400
    )


def test_simulation_reset_restores_initial_data(client):
    initial_roads = get_data(client.get("/api/roads"))["roads"]
    initial_incidents = get_data(client.get("/api/incidents"))["incidents"]
    initial_missions = get_data(client.get("/api/emergency/missions"))["missions"]

    # Perturb the simulation: steps plus a brand-new incident and mission.
    client.post("/api/simulation/step", json={"steps": 5})
    client.post(
        "/api/incidents",
        json={"road_id": "road-uppal-nagole", "type": "flooding"},
    )
    client.post(
        "/api/emergency/missions",
        json={
            "unit_type": "police",
            "origin": {"lat": 17.4126, "lng": 78.556},
            "destination": {"lat": 17.361, "lng": 78.4735},
        },
    )
    assert get_data(client.get("/api/dashboard"))["simulation"]["step"] == 5

    response = client.post("/api/simulation/reset")
    assert response.status_code == 200
    data = get_data(response)
    assert data["step"] == 0
    assert data["clock"] == "08:00:00"
    assert data["roads"] == initial_roads
    assert get_data(client.get("/api/roads"))["roads"] == initial_roads
    assert get_data(client.get("/api/incidents"))["incidents"] == initial_incidents
    assert (
        get_data(client.get("/api/emergency/missions"))["missions"]
        == initial_missions
    )


def test_simulation_reset_is_deterministic(client):
    client.post("/api/simulation/step", json={"steps": 7})
    first = get_data(client.post("/api/simulation/reset"))["roads"]

    client.post("/api/simulation/step", json={"steps": 4})
    client.post("/api/incidents", json={"road_id": "road-necklace", "type": "accident"})
    second = get_data(client.post("/api/simulation/reset"))["roads"]

    assert first == second


# ---------------------------------------------------------------------------
# Generic error handling
# ---------------------------------------------------------------------------


def test_unknown_route_returns_json_404(client):
    get_error(client.get("/api/nope"), 404)
    get_error(client.get("/api/incidents/inc-0001/details"), 404)


def test_method_not_allowed_returns_json_405(client):
    get_error(client.delete("/api/roads"), 405)
    get_error(client.get("/api/simulation/reset"), 405)
    # The incident id route exists but only accepts PATCH.
    get_error(client.get("/api/incidents/inc-0001"), 405)


# ---------------------------------------------------------------------------
# Routing (Dijkstra over the simulated junction network)
# ---------------------------------------------------------------------------

CHARMINAR = {"lat": 17.361, "lng": 78.4735}
MEHDIPATNAM = {"lat": 17.4017, "lng": 78.4467}
GACHIBOWLI = {"lat": 17.44, "lng": 78.3489}
UPPAL = {"lat": 17.4126, "lng": 78.556}


def test_route_returns_dijkstra_path_along_modelled_roads(client):
    response = client.post(
        "/api/routes",
        json={"origin": CHARMINAR, "destination": MEHDIPATNAM, "priority": 2},
    )
    assert response.status_code == 200
    route = get_data(response)["route"]

    assert route["reachable"] is True
    assert route["origin_junction"] == "Charminar"
    assert route["destination_junction"] == "Mehdipatnam"
    assert route["road_ids"] == ["road-charminar-mehdipatnam"]
    assert route["distance_km"] > 0
    assert route["free_flow_time_min"] > 0
    assert route["travel_time_min"] > 0
    assert route["cost"] > 0
    assert route["simulated"] is True
    assert "no real ambulance dispatch" in route["disclaimer"].lower()
    assert "no real traffic-signal control" in route["disclaimer"].lower()

    segments = route["segments"]
    assert segments
    for segment in segments:
        assert segment["type"] in ("road", "corridor_link")
        assert segment["travel_time_min"] > 0
        if segment["type"] == "road":
            assert segment["road_id"] in SEED_ROAD_IDS
            assert 0 <= segment["congestion"] <= 100

    # Simulated intersection priority saving: 12/9/6/3/0% for priorities 1-5.
    assert route["simulated_intersection_priority"]["saving_pct"] == pytest.approx(0.09)
    assert route["priority_time_saved_min"] > 0
    assert route["travel_time_min"] < route["raw_travel_time_min"]
    estimates = route["estimates"]
    assert estimates["delay_min"] >= 0
    assert estimates["excess_fuel_l"] >= 0
    assert estimates["excess_co2_kg"] >= 0
    assert "simulated" in estimates["note"].lower()


def test_route_priority_changes_path_and_travel_time(client):
    def route_for(priority):
        response = client.post(
            "/api/routes",
            json={"origin": GACHIBOWLI, "destination": UPPAL, "priority": priority},
        )
        assert response.status_code == 200
        return get_data(response)["route"]

    high = route_for(1)   # most congestion-averse, 12% priority saving
    low = route_for(5)    # pure fastest-time objective, no saving

    # Priority affects the selected route AND the intersection allocation.
    assert high["road_ids"] != low["road_ids"]
    assert high["travel_time_min"] < low["travel_time_min"]
    assert high["cost"] != low["cost"]
    assert high["priority_time_saved_min"] > 0
    assert low["priority_time_saved_min"] == 0
    assert high["simulated_intersection_priority"]["saving_pct"] == pytest.approx(0.12)


def test_route_reflects_live_simulation_state(client):
    body = {"origin": GACHIBOWLI, "destination": UPPAL, "priority": 1}
    before = get_data(client.post("/api/routes", json=body))["route"]
    client.post("/api/simulation/step", json={})
    after = get_data(client.post("/api/routes", json=body))["route"]
    assert after["travel_time_min"] != before["travel_time_min"]


def test_route_accepts_road_id_references(client):
    response = client.post(
        "/api/routes",
        json={
            "origin": {"road_id": "road-charminar-mehdipatnam"},
            "destination": {"road_id": "road-sardar-patel"},
        },
    )
    assert response.status_code == 200
    route = get_data(response)["route"]
    assert route["reachable"] is True
    assert route["priority"] == 3  # default


def test_route_validation_errors(client):
    valid = {"origin": CHARMINAR, "destination": MEHDIPATNAM}
    get_error(client.post("/api/routes", json={}), 400)  # missing both
    get_error(client.post("/api/routes", json={"origin": CHARMINAR}), 400)
    get_error(client.post("/api/routes", json={**valid, "speed": 99}), 400)
    get_error(client.post("/api/routes", json={"origin": "x", "destination": MEHDIPATNAM}), 400)
    get_error(
        client.post(
            "/api/routes",
            json={"origin": {"road_id": "road-none"}, "destination": MEHDIPATNAM},
        ),
        400,
    )
    get_error(
        client.post(
            "/api/routes",
            json={"origin": {"lat": 99.0, "lng": 78.0}, "destination": MEHDIPATNAM},
        ),
        400,
    )
    get_error(
        client.post(
            "/api/routes",
            json={"origin": {"lat": "x", "lng": "y"}, "destination": MEHDIPATNAM},
        ),
        400,
    )
    get_error(client.post("/api/routes", json={**valid, "priority": 0}), 400)
    get_error(client.post("/api/routes", json={**valid, "priority": 9}), 400)
    get_error(
        client.post("/api/routes", data="{bad", content_type="application/json"),
        400,
    )


# ---------------------------------------------------------------------------
# Mission lifecycle with routing
# ---------------------------------------------------------------------------


def test_mission_includes_route_and_priority_allocation(client):
    response = client.post(
        "/api/emergency/missions",
        json={
            "unit_type": "ambulance",
            "priority": 1,
            "origin": GACHIBOWLI,
            "destination": UPPAL,
        },
    )
    assert response.status_code == 201
    mission = get_data(response)["mission"]
    route = mission["route"]
    assert route["reachable"] is True
    assert route["priority"] == 1
    assert route["travel_time_min"] > 0
    assert route["simulated_intersection_priority"]["saving_pct"] == pytest.approx(0.12)
    assert "no real traffic-signal control" in route["disclaimer"].lower()

    # Raising priority number (lower urgency) removes the priority saving.
    updated = get_data(
        client.patch(
            f"/api/emergency/missions/{mission['id']}", json={"priority": 5}
        )
    )["mission"]
    assert updated["priority"] == 5
    assert updated["route"]["simulated_intersection_priority"]["saving_pct"] == 0
    assert updated["route"]["travel_time_min"] >= route["travel_time_min"]

    # Routes are also present on the list endpoint for seed missions.
    listed = get_data(client.get("/api/emergency/missions"))["missions"]
    assert all("route" in m for m in listed)
    assert all(m["route"]["simulated"] is True for m in listed)


def test_mission_lifecycle_completion_and_cancellation(client):
    base = {
        "unit_type": "ambulance",
        "origin": MEHDIPATNAM,
        "destination": CHARMINAR,
    }
    first = get_data(client.post("/api/emergency/missions", json=base))["mission"]
    assert first["status"] == "requested"

    assert (
        get_data(
            client.patch(
                f"/api/emergency/missions/{first['id']}", json={"status": "enroute"}
            )
        )["mission"]["status"]
        == "enroute"
    )
    assert (
        get_data(
            client.patch(
                f"/api/emergency/missions/{first['id']}", json={"status": "completed"}
            )
        )["mission"]["status"]
        == "completed"
    )
    # completed is terminal
    payload = get_error(
        client.patch(
            f"/api/emergency/missions/{first['id']}", json={"status": "requested"}
        ),
        409,
    )
    assert payload["error"]["code"] == "invalid_transition"

    # Cancellation from requested, then terminal.
    second = get_data(client.post("/api/emergency/missions", json=base))["mission"]
    assert (
        get_data(
            client.patch(
                f"/api/emergency/missions/{second['id']}", json={"status": "cancelled"}
            )
        )["mission"]["status"]
        == "cancelled"
    )
    payload = get_error(
        client.patch(
            f"/api/emergency/missions/{second['id']}", json={"status": "enroute"}
        ),
        409,
    )
    assert payload["error"]["code"] == "invalid_transition"
    get_error(
        client.patch("/api/emergency/missions/emg-0000", json={"status": "enroute"}),
        404,
    )


# ---------------------------------------------------------------------------
# Incident lifecycle (resolution, dismissal, transitions)
# ---------------------------------------------------------------------------


def test_incident_lifecycle_transitions(client):
    created = get_data(
        client.post(
            "/api/incidents",
            json={"road_id": "road-orr-west", "type": "accident"},
        )
    )["incident"]
    assert created["status"] == "active"
    incident_id = created["id"]

    def patch(body):
        return client.patch(f"/api/incidents/{incident_id}", json=body)

    def status_of(response):
        return get_data(response)["incident"]["status"]

    assert status_of(patch({"status": "in_progress"})) == "in_progress"
    assert status_of(patch({"status": "resolved"})) == "resolved"

    # Invalid transition: resolved incidents must be reopened first.
    payload = get_error(patch({"status": "in_progress"}), 409)
    assert payload["error"]["code"] == "invalid_transition"

    # Reopen a resolved incident, then dismiss it.
    assert status_of(patch({"status": "active"})) == "active"
    assert status_of(patch({"status": "dismissed"})) == "dismissed"

    # dismissed -> resolved is invalid, and the whole update must be atomic:
    # a mixed valid+invalid body changes nothing.
    get_error(patch({"severity": "critical", "status": "resolved"}), 409)
    listed = get_data(client.get("/api/incidents"))["incidents"]
    current = next(i for i in listed if i["id"] == incident_id)
    assert current["severity"] == "medium"  # unchanged after rejected update
    assert current["status"] == "dismissed"

    # Dismissed incidents are not active and are counted separately.
    dashboard = get_data(client.get("/api/dashboard"))
    assert dashboard["incidents"]["dismissed"] == 1
    active_ids = [
        i["id"]
        for i in listed
        if i["status"] in ("active", "in_progress")
    ]
    assert incident_id not in active_ids
    assert dashboard["summary"]["active_incidents"] == len(active_ids)

    # Unknown id -> 404 with proper code.
    payload = get_error(
        client.patch("/api/incidents/inc-0000", json={"status": "resolved"}), 404
    )
    assert payload["error"]["code"] == "not_found"


# ---------------------------------------------------------------------------
# Predictions: category, trend, recommendation, GET/POST consistency
# ---------------------------------------------------------------------------


def test_predictions_include_category_trend_and_recommendation(client):
    data = get_data(client.get("/api/predictions"))
    assert data["model_trained"] is False
    for prediction in data["predictions"]:
        assert prediction["category"] == prediction["predicted_status"]
        assert prediction["category"] in ("smooth", "moderate", "congested", "gridlock")
        assert prediction["trend"] in ("rising", "falling", "stable")
        assert isinstance(prediction["delta_congestion"], (int, float))
        assert prediction["recommendation"]
        assert "simulated advisory" in prediction["recommendation"].lower()
        assert prediction["factors"]
        assert 0 <= prediction["risk_score"] <= 100


def test_predictions_get_and_post_return_identical_json(client):
    road_id = "road-nehru-marg"
    listed = get_data(client.get("/api/predictions?horizon_minutes=45"))
    item = next(p for p in listed["predictions"] if p["road_id"] == road_id)
    single = get_data(
        client.post(
            "/api/predict", json={"road_id": road_id, "minutes_ahead": 45}
        )
    )["prediction"]
    assert item == single
    assert single["method"] == "deterministic_heuristic"


def test_predict_rejects_unknown_and_malformed_inputs(client):
    get_error(
        client.post(
            "/api/predict", json={"road_id": "road-orr-west", "bogus": 1}
        ),
        400,
    )
    get_error(
        client.post("/api/predict", data="[1,2]", content_type="application/json"),
        400,
    )


# ---------------------------------------------------------------------------
# Environmental impact (illustrative simulated estimates)
# ---------------------------------------------------------------------------


def test_environmental_impact_estimates(client):
    response = client.get("/api/impact")
    assert response.status_code == 200
    data = get_data(response)

    network = data["network"]
    assert network["road_count"] == len(SEED_ROAD_IDS)
    assert network["delay_vehicle_hours"] > 0
    assert network["fuel_liters"] > 0
    assert network["co2_kg"] > 0
    assert len(network["roads"]) == len(SEED_ROAD_IDS)
    for row in network["roads"]:
        assert row["road_id"] in SEED_ROAD_IDS
        assert row["delay_vehicle_hours"] >= 0
        assert row["fuel_liters"] >= 0
        assert row["co2_kg"] >= 0

    missions = data["missions"]
    seed_count = get_data(client.get("/api/emergency/missions"))["count"]
    assert missions["routes_estimated"] + missions["routes_unreachable"] == seed_count
    assert missions["excess_fuel_liters_total"] >= 0

    assert data["assumptions"]
    assert any("not measured" in a.lower() for a in data["assumptions"])
    assert "simulated" in data["notice"].lower()
    assert data["units"]["fuel"] == "litres"
    assert data["units"]["emissions"] == "kg CO2"


def test_environmental_impact_follows_simulation(client):
    before = get_data(client.get("/api/impact"))["network"]["fuel_liters"]
    client.post("/api/simulation/step", json={})
    after = get_data(client.get("/api/impact"))["network"]["fuel_liters"]
    assert after != before
    client.post("/api/simulation/reset")
    restored = get_data(client.get("/api/impact"))["network"]["fuel_liters"]
    assert restored == before
