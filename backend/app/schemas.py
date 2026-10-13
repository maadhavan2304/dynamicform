from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

FieldType = Literal["text", "number", "email", "date", "dropdown", "checkbox", "radio", "file", "rating"]
Operator = Literal["equals", "not_equals", "contains", "gt", "lt", "not_empty", "empty"]
CHOICE_TYPES = {"dropdown", "radio", "checkbox"}


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth / users ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserOut(ORM):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    @field_validator("role", mode="before")
    @classmethod
    def _role(cls, v):
        return v.name if hasattr(v, "name") else v


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    role: Literal["Admin", "User"] | None = None
    is_active: bool | None = None


# ---------- forms ----------
class OptionIn(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    value: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _default_value(self):
        if not self.value:
            self.value = self.label
        return self


class OptionOut(ORM):
    id: int
    label: str
    value: str


class ConditionIn(BaseModel):
    field_key: str
    operator: Operator = "equals"
    value: Any = None


class FieldIn(BaseModel):
    field_key: str = Field(pattern=r"^[A-Za-z0-9_\-]{1,64}$")
    label: str = Field(min_length=1, max_length=255)
    field_type: FieldType
    is_required: bool = False
    placeholder: str | None = Field(default=None, max_length=255)
    validation: dict[str, Any] | None = None
    condition: ConditionIn | None = None
    options: list[OptionIn] = []


class FieldOut(ORM):
    id: int
    field_key: str
    label: str
    field_type: FieldType
    is_required: bool
    placeholder: str | None
    position: int
    validation: dict[str, Any] | None
    condition: ConditionIn | None
    options: list[OptionOut]


class FormIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    is_active: bool = True
    is_public: bool = False
    allow_response_edit: bool = False
    fields: list[FieldIn] = []

    @model_validator(mode="after")
    def _check_fields(self):
        seen: set[str] = set()
        for f in self.fields:
            if f.field_key in seen:
                raise ValueError(f"Duplicate field_key '{f.field_key}'")
            if f.field_type in CHOICE_TYPES:
                if not f.options:
                    raise ValueError(f"Field '{f.label}' needs at least one option")
                vals = [o.value for o in f.options]
                if len(set(vals)) != len(vals):
                    raise ValueError(f"Field '{f.label}' has duplicate option values")
            if f.condition and f.condition.field_key not in seen:
                raise ValueError(f"Field '{f.label}': a condition can only depend on a field placed above it")
            seen.add(f.field_key)
        return self


class StatusIn(BaseModel):
    is_active: bool


class FormSummary(ORM):
    id: int
    title: str
    description: str | None
    is_active: bool
    is_public: bool
    allow_response_edit: bool
    owner_id: int
    owner_name: str
    field_count: int
    response_count: int = 0
    created_at: datetime
    updated_at: datetime


class FormOut(FormSummary):
    fields: list[FieldOut]


# ---------- responses ----------
class SubmissionIn(BaseModel):
    answers: dict[str, Any]


class ResponseOut(BaseModel):
    id: int
    form_id: int
    form_title: str
    user_id: int | None
    submitted_by: str
    submitted_by_email: str | None
    submitted_at: datetime
    updated_at: datetime | None
    answers: dict[str, Any]
    can_edit: bool


class ResponseDetailOut(ResponseOut):
    fields: list[FieldOut]


class ResponsePage(BaseModel):
    items: list[ResponseOut]
    total: int
    page: int
    page_size: int


class LogOut(ORM):
    id: int
    user_id: int | None
    user_name: str
    form_id: int | None
    action: str
    entity_type: str | None
    entity_id: int | None
    details: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime


class LogPage(BaseModel):
    items: list[LogOut]
    total: int
    page: int
    page_size: int


class UploadOut(BaseModel):
    id: str
    name: str
    size: int
