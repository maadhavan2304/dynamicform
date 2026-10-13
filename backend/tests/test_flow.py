import io

import pytest


def login(client, email, password):
    r = client.post("/api/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def register(client, name, email):
    r = client.post("/api/auth/register", json={"name": name, "email": email, "password": "Passw0rd!x"})
    assert r.status_code == 201, r.text
    return login(client, email, "Passw0rd!x")


FORM = {
    "title": "Customer feedback",
    "description": "Tell us how we did",
    "is_public": True,
    "allow_response_edit": True,
    "fields": [
        {"field_key": "name", "label": "Name", "field_type": "text", "is_required": True,
         "validation": {"min_length": 2}},
        {"field_key": "email", "label": "Email", "field_type": "email", "is_required": True},
        {"field_key": "age", "label": "Age", "field_type": "number", "validation": {"min": 18, "max": 99}},
        {"field_key": "visit", "label": "Visit date", "field_type": "date"},
        {"field_key": "plan", "label": "Plan", "field_type": "dropdown", "is_required": True,
         "options": [{"label": "Free"}, {"label": "Pro"}]},
        {"field_key": "why", "label": "Why Pro?", "field_type": "text", "is_required": True,
         "condition": {"field_key": "plan", "operator": "equals", "value": "Pro"}},
        {"field_key": "tags", "label": "Interests", "field_type": "checkbox",
         "options": [{"label": "API"}, {"label": "UI"}]},
        {"field_key": "contact", "label": "Contact by", "field_type": "radio",
         "options": [{"label": "Email"}, {"label": "Phone"}]},
        {"field_key": "score", "label": "Score", "field_type": "rating", "validation": {"max": 5}},
        {"field_key": "doc", "label": "Attachment", "field_type": "file"},
    ],
}


@pytest.fixture(scope="module")
def ctx(client):
    admin = login(client, "admin@example.com", "Admin@12345")
    owner = register(client, "Olive Owner", "olive@example.com")
    other = register(client, "Omar Other", "omar@example.com")
    r = client.post("/api/forms", json=FORM, headers=owner)
    assert r.status_code == 201, r.text
    form = r.json()
    ids = {f["field_key"]: f["id"] for f in form["fields"]}
    return dict(admin=admin, owner=owner, other=other, form=form, ids=ids)


def answers(ids, **kw):
    return {"answers": {str(ids[k]): v for k, v in kw.items()}}


def test_auth_and_rbac(client, ctx):
    assert client.get("/api/forms").status_code == 401
    assert client.get("/api/users", headers=ctx["owner"]).status_code == 403
    assert client.get("/api/users", headers=ctx["admin"]).status_code == 200
    assert client.post("/api/auth/register", json={"name": "x y", "email": "olive@example.com",
                                                   "password": "Passw0rd!x"}).status_code == 409


def test_form_isolation(client, ctx):
    fid = ctx["form"]["id"]
    assert client.get(f"/api/forms/{fid}", headers=ctx["other"]).status_code == 403
    assert client.get(f"/api/forms/{fid}", headers=ctx["admin"]).status_code == 200
    assert client.get("/api/forms", headers=ctx["other"]).json() == []
    assert len(client.get("/api/forms", headers=ctx["owner"]).json()) == 1


def test_invalid_condition_rejected(client, ctx):
    bad = {**FORM, "fields": [FORM["fields"][5], FORM["fields"][4]]}  # 'why' depends on a later field
    assert client.post("/api/forms", json=bad, headers=ctx["owner"]).status_code == 422


def test_validation_and_conditional_logic(client, ctx):
    fid, ids = ctx["form"]["id"], ctx["ids"]
    url = f"/api/forms/{fid}/responses"
    # anonymous on public form: required + conditional-required errors
    r = client.post(url, json=answers(ids, name="A", email="nope", plan="Pro", age=5))
    assert r.status_code == 422
    errs = r.json()["detail"]["errors"]
    assert {str(ids[k]) for k in ("name", "email", "age", "why")} <= set(errs)
    # choosing Free hides "why": no error even though it is required
    ok = client.post(url, json=answers(ids, name="Alice", email="a@x.com", plan="Free", why="should be dropped",
                                       tags=["API"], contact="Email", score=4, age=30))
    assert ok.status_code == 201, ok.text
    body = ok.json()
    assert str(ids["why"]) not in body["answers"]          # hidden answer discarded
    assert body["answers"][str(ids["tags"])] == ["API"]
    assert body["submitted_by"] == "Anonymous"
    # bad option / rating
    r = client.post(url, json=answers(ids, name="Bob", email="b@x.com", plan="Gold", score=9))
    assert r.status_code == 422


def test_file_upload_and_submit(client, ctx):
    fid, ids = ctx["form"]["id"], ctx["ids"]
    up = client.post("/api/uploads", files={"file": ("cv.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")})
    assert up.status_code == 201
    assert client.post("/api/uploads", files={"file": ("x.exe", io.BytesIO(b"MZ"), "application/octet-stream")}).status_code == 415
    f = up.json()
    r = client.post(f"/api/forms/{fid}/responses", headers=ctx["other"],
                    json=answers(ids, name="Omar", email="omar@x.com", plan="Pro", why="Need API",
                                 doc={"id": f["id"], "name": f["name"]}))
    assert r.status_code == 201, r.text
    ctx["omar_resp"] = r.json()
    # owner can download, a stranger cannot
    assert client.get(f"/api/files/{f['id']}", headers=ctx["owner"]).status_code == 200
    stranger = register(client, "Sam Stranger", "sam@example.com")
    assert client.get(f"/api/files/{f['id']}", headers=stranger).status_code == 403


def test_search_filter_pagination(client, ctx):
    fid, ids = ctx["form"]["id"], ctx["ids"]
    h = ctx["owner"]
    assert client.get(f"/api/forms/{fid}/responses", headers=ctx["other"]).status_code == 403
    r = client.get(f"/api/forms/{fid}/responses", headers=h).json()
    assert r["total"] == 2
    assert client.get(f"/api/forms/{fid}/responses", params={"q": "alice"}, headers=h).json()["total"] == 1
    assert client.get(f"/api/forms/{fid}/responses", params={"field_id": ids["plan"], "value": "Pro"}, headers=h).json()["total"] == 1
    assert client.get(f"/api/forms/{fid}/responses", params={"date_from": "2999-01-01"}, headers=h).json()["total"] == 0
    assert client.get(f"/api/forms/{fid}/responses", params={"page_size": 1}, headers=h).json()["items"].__len__() == 1


def test_edit_permissions_and_history(client, ctx):
    ids, resp = ctx["ids"], ctx["omar_resp"]
    rid = resp["id"]
    assert resp["can_edit"] is True  # form allows submitters to edit their own response
    new = answers(ids, name="Omar R", email="omar@x.com", plan="Pro", why="Changed my mind")
    r = client.put(f"/api/responses/{rid}", json=new, headers=ctx["other"])
    assert r.status_code == 200, r.text
    assert r.json()["answers"][str(ids["name"])] == "Omar R"
    # owner can edit too; a stranger cannot
    assert client.put(f"/api/responses/{rid}", json=new, headers=ctx["owner"]).status_code == 200
    stranger = login(client, "sam@example.com", "Passw0rd!x")
    assert client.put(f"/api/responses/{rid}", json=new, headers=stranger).status_code == 403
    hist = client.get(f"/api/responses/{rid}/history", headers=ctx["owner"]).json()
    assert [h["action"] for h in hist] == ["response.updated", "response.created"] or hist[0]["action"] == "response.updated"
    changes = hist[0]["details"]["changes"]
    assert changes["Name"] == {"old": "Omar", "new": "Omar R"}
    # removing the attachment (omitted) is recorded as a change
    last = [h for h in hist if h["action"] == "response.updated"]
    assert any("Attachment" in h["details"]["changes"] for h in last)


def test_submitter_edit_disabled(client, ctx):
    ids = ctx["ids"]
    f = {**FORM, "title": "No edit", "allow_response_edit": False}
    form = client.post("/api/forms", json=f, headers=ctx["owner"]).json()
    fids = {x["field_key"]: x["id"] for x in form["fields"]}
    r = client.post(f"/api/forms/{form['id']}/responses", headers=ctx["other"],
                    json=answers(fids, name="Omar", email="o@x.com", plan="Free"))
    assert r.status_code == 201 and r.json()["can_edit"] is False
    assert client.put(f"/api/responses/{r.json()['id']}", headers=ctx["other"],
                      json=answers(fids, name="Omar2", email="o@x.com", plan="Free")).status_code == 403


def test_private_form_needs_login_and_disable(client, ctx):
    f = {**FORM, "title": "Private", "is_public": False}
    form = client.post("/api/forms", json=f, headers=ctx["owner"]).json()
    fids = {x["field_key"]: x["id"] for x in form["fields"]}
    payload = answers(fids, name="Zed", email="z@x.com", plan="Free")
    assert client.get(f"/api/public/forms/{form['id']}").status_code == 401
    assert client.post(f"/api/forms/{form['id']}/responses", json=payload).status_code == 401
    assert client.post(f"/api/forms/{form['id']}/responses", json=payload, headers=ctx["other"]).status_code == 201
    # disable
    r = client.patch(f"/api/forms/{form['id']}/status", json={"is_active": False}, headers=ctx["owner"])
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert client.post(f"/api/forms/{form['id']}/responses", json=payload, headers=ctx["other"]).status_code == 403
    assert client.get(f"/api/public/forms/{form['id']}", headers=ctx["other"]).status_code == 403
    assert client.patch(f"/api/forms/{form['id']}/status", json={"is_active": True}, headers=ctx["other"]).status_code == 403


def test_update_form_keeps_response_data(client, ctx):
    fid = ctx["form"]["id"]
    cur = client.get(f"/api/forms/{fid}", headers=ctx["owner"]).json()
    fields = [{k: v for k, v in f.items() if k not in ("id", "position")} for f in cur["fields"]]
    fields[0]["label"] = "Full name"
    fields.reverse() if False else None
    payload = {**{k: cur[k] for k in ("title", "description", "is_active", "is_public", "allow_response_edit")}, "fields": fields}
    r = client.put(f"/api/forms/{fid}", json=payload, headers=ctx["owner"])
    assert r.status_code == 200, r.text
    assert r.json()["fields"][0]["id"] == cur["fields"][0]["id"]   # ids stable
    assert client.get(f"/api/forms/{fid}/responses", headers=ctx["owner"]).json()["total"] == 2


def test_analytics_logs_exports(client, ctx):
    fid, h = ctx["form"]["id"], ctx["owner"]
    a = client.get(f"/api/analytics/forms/{fid}", headers=h).json()
    assert a["total_responses"] == 2 and len(a["series"]) == 30
    plan = next(f for f in a["fields"] if f["label"] == "Plan")
    assert {d["label"]: d["count"] for d in plan["distribution"]} == {"Free": 1, "Pro": 1}
    d = client.get("/api/analytics/dashboard", headers=h).json()
    assert d["total_forms"] >= 1 and d["total_responses"] >= 2
    assert client.get("/api/analytics/dashboard", headers=ctx["admin"]).json()["total_users"] >= 3
    logs = client.get("/api/logs", headers=h).json()
    assert logs["total"] > 0
    assert client.get("/api/logs", headers=ctx["admin"]).json()["total"] >= logs["total"]
    x = client.get(f"/api/forms/{fid}/export", params={"format": "xlsx"}, headers=h)
    assert x.status_code == 200 and x.content[:2] == b"PK"
    p = client.get(f"/api/forms/{fid}/export", params={"format": "pdf"}, headers=h)
    assert p.status_code == 200 and p.content[:4] == b"%PDF"
    assert client.get(f"/api/forms/{fid}/export", headers=ctx["other"]).status_code == 403


def test_delete_form_cascades(client, ctx):
    fid = ctx["form"]["id"]
    assert client.delete(f"/api/forms/{fid}", headers=ctx["other"]).status_code == 403
    assert client.delete(f"/api/forms/{fid}", headers=ctx["owner"]).status_code == 204
    assert client.get(f"/api/forms/{fid}", headers=ctx["admin"]).status_code == 404
