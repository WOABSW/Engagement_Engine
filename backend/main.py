"""Engagement Engine API.

React frontend -> FastAPI (`/api`) -> Supabase + OpenAI.
Secrets stay in `.env`; this module only reads them.
"""

from __future__ import annotations

import csv
import io
import json
from contextlib import asynccontextmanager
from datetime import datetime
from functools import lru_cache
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import APIError, OpenAI
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import Client, create_client

load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    supabase_url: str = ""
    supabase_key: str = ""
    openai_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


def supabase_project_url(url: str) -> str:
    """Accept either the project URL or the PostgREST `/rest/v1` URL from `.env`."""
    cleaned = url.strip().rstrip("/")
    if cleaned.endswith("/rest/v1"):
        cleaned = cleaned[: -len("/rest/v1")]
    return cleaned


def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=503, detail="Supabase is not configured.")
    return create_client(supabase_project_url(settings.supabase_url), settings.supabase_key)


def get_openai() -> OpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI is not configured.")
    return OpenAI(api_key=settings.openai_api_key)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_settings()
    yield


app = FastAPI(
    title="Engagement Engine",
    description="API for contact engagement: import connections, generate outreach, read contacts, log events.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    contact_name: str
    context: str = ""
    channel: Literal["email", "sms", "linkedin"] = "email"
    goal: str = "book a meeting"
    kind: Literal["outreach", "icebreaker", "comment"] = "outreach"
    style: Literal["Insight-Led", "Executive", "Casual"] | None = None
    current_title: str = ""
    current_company: str = ""


class GenerateResponse(BaseModel):
    message: str
    model: str
    channel: str
    kind: str


class EngagementEvent(BaseModel):
    contact_id: str | None = None
    event_type: str = Field(..., examples=["generated", "sent", "opened", "replied"])
    channel: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class RefreshRequest(BaseModel):
    contact_id: str
    profile_text: str = Field(..., min_length=1)


class RefreshResponse(BaseModel):
    current_title: str
    current_company: str
    item: dict[str, Any]


PipelineStage = Literal["Identified", "Warming", "Messaged", "Replied", "Warm"]


class UpdateStageRequest(BaseModel):
    contact_id: str
    pipeline_stage: PipelineStage


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health")
def api_health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/status")
def status() -> dict[str, Any]:
    settings = get_settings()
    return {
        "service": "engagement-engine",
        "supabase_configured": bool(settings.supabase_url and settings.supabase_key),
        "openai_configured": bool(settings.openai_api_key),
    }


CSV_FIELD_MAP = {
    "first name": "first_name",
    "last name": "last_name",
    "email address": "email",
    "email": "email",
    "company": "original_company",
    "position": "original_title",
    "title": "original_title",
    "headline": "original_title",
    "url": "profile_url",
    "linkedin url": "profile_url",
    "profile url": "profile_url",
    "connected on": "connected_on",
}

DATE_FORMATS = ("%d %b %Y", "%b %d, %Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y")


def _normalize_header(value: str) -> str:
    return " ".join(value.replace("_", " ").strip().lower().split())


def _find_csv_start(text: str) -> str:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        lower = line.lower()
        if "first name" in lower and "last name" in lower:
            return "\n".join(lines[index:])
        if "email" in lower and ("company" in lower or "url" in lower):
            return "\n".join(lines[index:])
    return text


def _parse_connected_on(value: str) -> str | None:
    cleaned = value.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _row_from_csv(raw: dict[str, str]) -> dict[str, Any] | None:
    mapped: dict[str, Any] = {}
    for key, value in raw.items():
        if key is None:
            continue
        field = CSV_FIELD_MAP.get(_normalize_header(key))
        if not field:
            continue
        cleaned = (value or "").strip()
        if cleaned:
            mapped[field] = cleaned

    if not mapped.get("profile_url"):
        return None

    if mapped.get("original_company") and "current_company" not in mapped:
        mapped["current_company"] = mapped["original_company"]
    if mapped.get("original_title") and "current_title" not in mapped:
        mapped["current_title"] = mapped["original_title"]

    connected_on = mapped.get("connected_on")
    if connected_on:
        parsed = _parse_connected_on(connected_on)
        if parsed:
            mapped["connected_on"] = parsed
        else:
            mapped.pop("connected_on", None)

    mapped.setdefault("pipeline_stage", "Identified")
    return mapped


def _extract_current_role(profile_text: str) -> tuple[str, str]:
    completion = get_openai().chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract the person's CURRENT job title and CURRENT company from "
                    "pasted LinkedIn headline and experience text. Prefer the most "
                    "recent role. Ignore older jobs. Return JSON with keys "
                    "current_title and current_company. Use empty strings if unknown. "
                    "Do not invent employers or titles."
                ),
            },
            {"role": "user", "content": profile_text.strip()},
        ],
    )
    raw = (completion.choices[0].message.content or "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="OpenAI returned invalid JSON.") from exc

    title = str(data.get("current_title") or data.get("title") or "").strip()
    company = str(data.get("current_company") or data.get("company") or "").strip()
    if not title and not company:
        raise HTTPException(
            status_code=422,
            detail="Could not extract a current title or company from the pasted profile text.",
        )
    return title, company


@app.post("/api/import/connections")
async def import_connections(file: UploadFile = File(...)) -> dict[str, Any]:
    filename = (file.filename or "").lower()
    if filename and not filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.") from exc

    reader = csv.DictReader(io.StringIO(_find_csv_start(text)))
    rows = [row for raw_row in reader if (row := _row_from_csv(raw_row))]
    if not rows:
        raise HTTPException(status_code=400, detail="No connection rows were found in the CSV.")

    inserted = 0
    try:
        client = get_supabase()
        for start in range(0, len(rows), 50):
            chunk = rows[start : start + 50]
            result = client.table("contacts").insert(chunk).execute()
            inserted += len(result.data or chunk)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not import connections into Supabase: {exc}",
        ) from exc

    return {"imported": inserted, "parsed": len(rows)}


@app.get("/api/contacts")
def list_contacts() -> dict[str, Any]:
    try:
        result = get_supabase().table("contacts").select("*").limit(100).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not read contacts from Supabase: {exc}",
        ) from exc
    return {"items": result.data or []}


@app.post("/api/contacts/refresh", response_model=RefreshResponse)
def refresh_contact(body: RefreshRequest) -> RefreshResponse:
    profile_text = body.profile_text.strip()
    if not profile_text:
        raise HTTPException(status_code=400, detail="Paste profile headline or experience text first.")

    try:
        title, company = _extract_current_role(profile_text)
    except HTTPException:
        raise
    except APIError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc.message}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc}") from exc

    updates: dict[str, Any] = {}
    if title:
        updates["current_title"] = title
    if company:
        updates["current_company"] = company

    try:
        result = (
            get_supabase()
            .table("contacts")
            .update(updates)
            .eq("id", body.contact_id)
            .execute()
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not update contact in Supabase: {exc}",
        ) from exc

    item = (result.data or [None])[0]
    if not item:
        raise HTTPException(status_code=404, detail="Contact was not found.")

    return RefreshResponse(
        current_title=item.get("current_title") or title,
        current_company=item.get("current_company") or company,
        item=item,
    )


@app.post("/api/contacts/update_stage")
@app.patch("/api/contacts/update_stage")
def update_contact_stage(body: UpdateStageRequest) -> dict[str, Any]:
    try:
        result = (
            get_supabase()
            .table("contacts")
            .update({"pipeline_stage": body.pipeline_stage})
            .eq("id", body.contact_id)
            .execute()
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not update pipeline stage in Supabase: {exc}",
        ) from exc

    item = (result.data or [None])[0]
    if not item:
        raise HTTPException(status_code=404, detail="Contact was not found.")
    return {"item": item, "pipeline_stage": item.get("pipeline_stage") or body.pipeline_stage}


def _generation_prompt(body: GenerateRequest) -> tuple[str, str, float]:
    role = " ".join(
        part
        for part in (
            body.current_title,
            f"at {body.current_company}" if body.current_company else "",
        )
        if part
    ) or "role unknown"
    context = body.context.strip() or "none provided"

    if body.kind == "icebreaker":
        style = body.style or "Insight-Led"
        style_guide = {
            "Insight-Led": (
                "Lead with a specific observation about their work, company, or market. "
                "Sound sharp and informed, not salesy."
            ),
            "Executive": (
                "Write as a peer to a senior operator. Short, direct, high-signal. "
                "No slang, no hype."
            ),
            "Casual": (
                "Warm, human, and lightly conversational. Still professional. "
                "One clear reason for reaching out."
            ),
        }[style]
        system = "You write LinkedIn icebreakers that start real conversations."
        prompt = (
            f"Write one LinkedIn icebreaker DM for {body.contact_name} ({role}). "
            f"Style: {style}. {style_guide} "
            f"Goal: {body.goal}. Context: {context}. "
            "3-6 sentences max. No subject line. No quotes around the message."
        )
        return system, prompt, 0.6

    if body.kind == "comment":
        system = "You write LinkedIn comments that add a real point of view."
        prompt = (
            f"Draft one LinkedIn comment from me on a post by {body.contact_name} ({role}). "
            f"Post: {context}. Goal: {body.goal}. "
            "Be specific to the post, add a useful take, and invite a reply. "
            "2-5 sentences. No hashtags. No emojis unless the post uses them. "
            "Do not mention that you are an AI."
        )
        return system, prompt, 0.5

    system = "You write high-signal B2B outreach for an engagement engine."
    prompt = (
        f"Write a short {body.channel} outreach message for {body.contact_name}. "
        f"Goal: {body.goal}. Context: {context}. "
        "Be professional, specific, and concise. Do not use a subject line unless channel is email."
    )
    return system, prompt, 0.4


@app.post("/api/engagements/generate", response_model=GenerateResponse)
def generate_engagement(body: GenerateRequest) -> GenerateResponse:
    model = "gpt-4o-mini"
    system, prompt, temperature = _generation_prompt(body)
    try:
        completion = get_openai().chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
        )
    except HTTPException:
        raise
    except APIError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc.message}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc}") from exc

    message = (completion.choices[0].message.content or "").strip().strip('"')
    if not message:
        raise HTTPException(status_code=502, detail="OpenAI returned an empty message.")
    return GenerateResponse(message=message, model=model, channel=body.channel, kind=body.kind)


@app.post("/api/events")
def log_event(event: EngagementEvent) -> dict[str, Any]:
    row = event.model_dump()
    try:
        result = get_supabase().table("engagement_events").insert(row).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not write engagement_events to Supabase: {exc}",
        ) from exc
    return {"item": (result.data or [row])[0]}
