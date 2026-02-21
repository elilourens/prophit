"""Timestamp parsing utilities."""
from datetime import datetime, timezone
from typing import Optional


def parse_timestamp(s: str) -> datetime:
    """
    Parse a timestamp string into a datetime object.
    
    Supports multiple formats:
    - ISO format with "Z" suffix: "2024-01-02T09:10:00Z"
    - ISO format with timezone: "2024-01-02T09:10:00+00:00"
    - ISO format without timezone: "2024-01-02T09:10:00"
    - Space-separated: "2024-01-02 09:10:00"
    
    Args:
        s: Timestamp string
        
    Returns:
        datetime object
        
    Raises:
        ValueError: If timestamp cannot be parsed
    """
    if not s:
        raise ValueError("Empty timestamp string")
    
    # Strip whitespace
    s = s.strip()
    
    # Convert trailing "Z" to "+00:00" for ISO format compatibility
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    
    # Try ISO format first
    try:
        dt = datetime.fromisoformat(s)
        # If naive datetime, assume UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        pass
    
    # Try replacing space with "T" for ISO-like format
    if " " in s and "T" not in s:
        try:
            dt = datetime.fromisoformat(s.replace(" ", "T"))
            # If naive datetime, assume UTC
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            pass
    
    # Try dateutil.parser if available (optional fallback)
    try:
        from dateutil import parser
        return parser.isoparse(s) if hasattr(parser, 'isoparse') else parser.parse(s)
    except ImportError:
        pass
    except Exception:
        pass
    
    # If all else fails, raise a clear error
    raise ValueError(f"Unable to parse timestamp: {s}. Expected ISO format (e.g., '2024-01-02T09:10:00Z' or '2024-01-02T09:10:00+00:00')")
