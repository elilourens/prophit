"""
Gradio UI for the Prophit multi-LLM test backend.

Run:
  source venv/bin/activate && python ui.py
"""

import asyncio
import json
from pathlib import Path

import gradio as gr

from main import (
    ask_claude,
    ask_gemini,
    ask_openai,
    ask_claude_calendar,
    prepare_input,
    get_budget_tips,
    get_income_runway,
    generate_financial_summary,
    run_week_ahead_pipeline,
    parse_pdf_to_transactions,
)

DATA_DIR = Path(__file__).parent.parent / "backend" / "data"


def _list_local_files() -> list[str]:
    """List available JSON files in backend/data/."""
    if not DATA_DIR.exists():
        return []
    return sorted(f.name for f in DATA_DIR.glob("*.json"))


def _run_predictions(data_str: str):
    """Run all three providers and return their results."""
    claude = asyncio.run(ask_claude(data_str))
    gemini = asyncio.run(ask_gemini(data_str))
    openai = asyncio.run(ask_openai(data_str))
    return claude, gemini, openai


def _load_and_prepare(filepath) -> str:
    """Load a file, apply JSON trimming or line cap for non-JSON."""
    with open(filepath, "rb") as f:
        raw = f.read()
    return prepare_input(raw, str(filepath))


def analyse_uploaded(file):
    """Analyse an uploaded JSON file."""
    if file is None:
        return "Upload a file first.", "", ""
    data_str = _load_and_prepare(file.name)
    return _run_predictions(data_str)


def parse_pdf(file):
    """Parse a PDF bank statement and extract transactions as JSON."""
    if file is None:
        return json.dumps({"error": "Upload a PDF file first.", "transactions": []})

    try:
        with open(file.name, "rb") as f:
            raw_bytes = f.read()

        result = asyncio.run(parse_pdf_to_transactions(raw_bytes))
        return json.dumps(result, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e), "transactions": []})


def analyse_local(filename):
    """Analyse a file from backend/data/."""
    if not filename:
        return "Select a file first.", "", ""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return f"File not found: {filepath}", "", ""
    return _run_predictions(_load_and_prepare(filepath))


def _format_calendar(raw_json: str) -> str:
    """Format calendar JSON into a readable markdown string."""
    try:
        cleaned = raw_json.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        cal = json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        return raw_json

    lines = [f"## Week Ahead — Starting {cal.get('week_start', '?')}\n"]
    for day in cal.get("daily_predictions", []):
        lines.append(f"### {day['day']} ({day['date']})")
        for p in day.get("predictions", []):
            agreed_list = p.get("agreed_by") or []
            agreed = ", ".join(str(x) for x in agreed_list) if agreed_list else "—"
            avg = p.get("avg_spend", 0)
            lines.append(
                f"- **{p['behavior']}** — {p.get('likelihood', 0)}% likelihood, "
                f"~${avg:.2f} avg  _(agreed: {agreed})_"
            )
        lines.append("")
    return "\n".join(lines)


def _format_week_ahead_response(result: dict) -> str:
    """Build markdown: location, context used (only true when at least one day has weather or holiday ok), summary, debug panel, calendar."""
    parts = []
    # Location
    if result.get("used_default_location"):
        parts.append("**Location:** Default (London)")
    else:
        src = result.get("location_source", "unknown")
        parts.append(f"**Location:** From {src} (request or env)")
    parts.append("")
    # Context used: true only if at least one day has weather_status=="ok" or holiday_status=="ok"
    context_used = result.get("context_available") or result.get("context_used")
    if context_used:
        parts.append("**Context used:** Yes — weather and/or holiday data used for predictions.")
    else:
        parts.append("**Context used:** No — context unavailable; predictions are history-only.")
        errs = result.get("context_errors") or []
        if errs:
            parts.append("_( " + "; ".join(errs) + " )_")
    parts.append("")
    parts.append("### Context Summary\n")
    parts.append(result.get("context_summary") or "—")
    # Debug panel: per-day weather_status, holiday_status, holiday_error
    day_context = result.get("day_context") or []
    if day_context:
        parts.append("\n#### Debug: Per-day context status\n")
        parts.append("| Date | weather_status | holiday_status | holiday_error |")
        parts.append("|------|----------------|----------------|---------------|")
        for dc in day_context:
            w = dc.get("weather") or {}
            h = dc.get("holiday") or {}
            ws = w.get("weather_status") or "—"
            hs = h.get("holiday_status") or "—"
            he = (h.get("holiday_error") or "—")[:40]
            parts.append(f"| {dc.get('date', '?')} | {ws} | {hs} | {he} |")
    parts.append("\n---\n\n")
    cal = result.get("final_calendar") or {}
    parts.append(f"## Week Ahead — Starting {cal.get('week_start', '?')}\n")
    for day in cal.get("daily_predictions", []):
        parts.append(f"### {day['day']} ({day['date']})")
        for p in day.get("predictions", []):
            agreed_list = p.get("agreed_by") or []
            agreed = ", ".join(str(x) for x in agreed_list) if agreed_list else "—"
            avg = p.get("avg_spend", 0)
            parts.append(
                f"- **{p['behavior']}** — {p.get('likelihood', 0)}% likelihood, "
                f"~${avg:.2f} avg  _(agreed: {agreed})_"
            )
        parts.append("")
    return "\n".join(parts)


def calendar_uploaded(file):
    """Run context-aware week-ahead pipeline (weather + holidays + 3 candidates + judge)."""
    if file is None:
        return "Upload a file first.", "{}"
    data_str = _load_and_prepare(file.name)
    result = asyncio.run(run_week_ahead_pipeline(data_str, include_candidate_outputs=False))
    md = _format_week_ahead_response(result)
    raw = json.dumps(result, indent=2)
    return md, raw


def calendar_local(filename):
    """Run context-aware week-ahead pipeline for a local file."""
    if not filename:
        return "Select a file first.", "{}"
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return f"File not found: {filepath}", "{}"
    data_str = _load_and_prepare(filepath)
    result = asyncio.run(run_week_ahead_pipeline(data_str, include_candidate_outputs=False))
    md = _format_week_ahead_response(result)
    raw = json.dumps(result, indent=2)
    return md, raw


def get_tips(predictions_text):
    """Get budget tips from predicted spending."""
    if not predictions_text or not predictions_text.strip():
        return "Enter spending predictions first."
    tips = asyncio.run(get_budget_tips(predictions_text))
    return tips


def get_runway(financial_text):
    """Get how long user can go without income from financial summary."""
    if not financial_text or not financial_text.strip():
        return "Enter a financial summary (savings, monthly expenses) first."
    return asyncio.run(get_income_runway(financial_text))


def runway_summary_from_upload(file):
    """Generate financial summary from an uploaded file and return it for the runway textbox."""
    if file is None:
        return ""
    path = file.name if hasattr(file, "name") else file
    data_str = _load_and_prepare(path)
    return asyncio.run(generate_financial_summary(data_str))


def runway_summary_from_local(filename):
    """Generate financial summary from a local backend/data file for the runway textbox."""
    if not filename:
        return ""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return ""
    data_str = _load_and_prepare(filepath)
    return asyncio.run(generate_financial_summary(data_str))


with gr.Blocks(
    title="Prophit — Multi-LLM Analyser",
    theme=gr.themes.Base(primary_hue="blue", neutral_hue="slate"),
) as demo:
    gr.Markdown("# Prophit — Multi-LLM Transaction Analyser")
    gr.Markdown("Upload a file (JSON, PDF, CSV, or TXT) or pick one from `backend/data/`. "
                "Each provider analyses the transaction data.")

    with gr.Tabs():
        # --- Tab 1: Upload ---
        with gr.Tab("Upload File"):
            file_input = gr.File(label="Upload file", file_types=[".json", ".pdf", ".csv", ".txt"])
            upload_btn = gr.Button("Analyse", variant="primary")

            with gr.Row():
                claude_up = gr.Markdown(label="Claude (Haiku 4.5)")
                gemini_up = gr.Markdown(label="Gemini (2.5 Flash Lite)")
                openai_up = gr.Markdown(label="OpenAI (GPT-4o Mini)")

            upload_btn.click(
                fn=analyse_uploaded,
                inputs=[file_input],
                outputs=[claude_up, gemini_up, openai_up],
            )

        # --- Tab 2: Local files ---
        with gr.Tab("Local Data"):
            local_files = _list_local_files()
            file_dropdown = gr.Dropdown(
                choices=local_files,
                label="Select a file from backend/data/",
                value=local_files[0] if local_files else None,
            )
            local_btn = gr.Button("Analyse", variant="primary")

            with gr.Row():
                claude_loc = gr.Markdown(label="Claude (Haiku 4.5)")
                gemini_loc = gr.Markdown(label="Gemini (2.5 Flash Lite)")
                openai_loc = gr.Markdown(label="OpenAI (GPT-4o Mini)")

            local_btn.click(
                fn=analyse_local,
                inputs=[file_dropdown],
                outputs=[claude_loc, gemini_loc, openai_loc],
            )

        # --- Tab 3: Week Ahead Calendar ---
        with gr.Tab("Week Ahead"):
            gr.Markdown("Context-aware week-ahead: weather (Open-Meteo) + public holidays (OpenHolidaysAPI) "
                        "are used to adjust likelihoods. Three candidate LLMs produce calendars; a judge picks the best. "
                        "Set USER_LAT, USER_LON, USER_COUNTRY in .env for your location.")

            with gr.Tabs():
                with gr.Tab("Upload File"):
                    cal_file_input = gr.File(label="Upload file", file_types=[".json", ".pdf", ".csv", ".txt"])
                    cal_upload_btn = gr.Button("Generate Calendar", variant="primary")
                    cal_up_md = gr.Markdown(label="Week Ahead Calendar")
                    cal_up_json = gr.Code(label="Raw JSON", language="json")

                    cal_upload_btn.click(
                        fn=calendar_uploaded,
                        inputs=[cal_file_input],
                        outputs=[cal_up_md, cal_up_json],
                    )

                with gr.Tab("Local Data"):
                    cal_local_files = _list_local_files()
                    cal_dropdown = gr.Dropdown(
                        choices=cal_local_files,
                        label="Select a file from backend/data/",
                        value=cal_local_files[0] if cal_local_files else None,
                    )
                    cal_local_btn = gr.Button("Generate Calendar", variant="primary")
                    cal_loc_md = gr.Markdown(label="Week Ahead Calendar")
                    cal_loc_json = gr.Code(label="Raw JSON", language="json")

                    cal_local_btn.click(
                        fn=calendar_local,
                        inputs=[cal_dropdown],
                        outputs=[cal_loc_md, cal_loc_json],
                    )

        # --- Tab 4: Budget Tips ---
        with gr.Tab("Budget Tips"):
            gr.Markdown("Paste predicted spending patterns to get AI-powered budget-saving tips.")

            predictions_input = gr.Textbox(
                label="Predicted Spending Patterns",
                placeholder="e.g., Coffee at Starbucks 3x weekly for $5.50, gym supplements $12/week, groceries $120/month",
                lines=4
            )
            tips_btn = gr.Button("Get Budget Tips", variant="primary")
            tips_output = gr.Markdown(label="Budget Tips")

            tips_btn.click(
                fn=get_tips,
                inputs=[predictions_input],
                outputs=[tips_output],
            )

        # --- Tab 5: Income Runway ---
        with gr.Tab("Income Runway"):
            gr.Markdown("Paste your financial summary (savings, monthly expenses) or **generate it from a file** to see how long you could go without any new income.")

            with gr.Row():
                runway_upload = gr.File(label="Upload file (JSON/CSV/PDF)", file_types=[".json", ".csv", ".pdf", ".txt"])
                runway_dropdown = gr.Dropdown(
                    label="Or pick from backend/data",
                    choices=_list_local_files(),
                    value=None,
                )
            runway_gen_btn = gr.Button("Generate financial summary from file", variant="secondary")
            runway_input = gr.Textbox(
                label="Financial Summary",
                placeholder="e.g., Savings: $25,000. Monthly rent $1,800, groceries $400, other expenses ~$600. No other income.",
                lines=4,
            )
            runway_btn = gr.Button("How long without income?", variant="primary")
            runway_output = gr.Markdown(label="Runway")

            def _runway_summary_from_file(upload, local_name):
                if upload is not None:
                    return runway_summary_from_upload(upload)
                if local_name:
                    return runway_summary_from_local(local_name)
                return ""

            runway_gen_btn.click(
                fn=_runway_summary_from_file,
                inputs=[runway_upload, runway_dropdown],
                outputs=[runway_input],
            )
            runway_btn.click(
                fn=get_runway,
                inputs=[runway_input],
                outputs=[runway_output],
            )

        # --- Tab 6: PDF Parser ---
        with gr.Tab("PDF Parser"):
            gr.Markdown("Upload a PDF bank statement to extract transactions as structured JSON data.")

            pdf_file_input = gr.File(label="Upload PDF", file_types=[".pdf"])
            pdf_parse_btn = gr.Button("Extract Transactions", variant="primary")
            pdf_output = gr.Code(label="Extracted Transactions (JSON)", language="json")

            pdf_parse_btn.click(
                fn=parse_pdf,
                inputs=[pdf_file_input],
                outputs=[pdf_output],
                api_name="parse_pdf",  # Expose as API endpoint
            )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=8003)
