"""External data models for enrichment (weather, holidays)."""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class WeatherForecast(BaseModel):
    """Weather forecast data."""
    
    date: date
    precip_prob: float = Field(..., ge=0.0, le=1.0, description="Precipitation probability")
    temp_c: float = Field(..., description="Temperature in Celsius")


class HolidayCalendar(BaseModel):
    """Holiday calendar data."""
    
    date: date
    name: str = Field(..., description="Holiday name")
