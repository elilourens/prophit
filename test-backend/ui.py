"""
Gradio UI for the Prophit multi-LLM test backend.

Run:
  source venv/bin/activate && python ui.py
"""

import asyncio
import json
from pathlib import Path

import gradio as gr

from main import ask_claude, ask_gemini, ask_mistral, ask_gemini_calendar, prepare_input

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
    mistral = asyncio.run(ask_mistral(data_str))
    return claude, gemini, mistral


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
        cal = json.loads(raw_json)
    except (json.JSONDecodeError, TypeError):
        return raw_json  # return raw if not valid JSON

    lines = [f"## Week Ahead — Starting {cal.get('week_start', '?')}\n"]
    for day in cal.get("daily_predictions", []):
        lines.append(f"### {day['day']} ({day['date']})")
        for p in day.get("predictions", []):
            agreed = ", ".join(p.get("agreed_by", []))
            lines.append(
                f"- **{p['behavior']}** — {p['likelihood']}% likelihood, "
                f"~${p['avg_spend']:.2f} avg  _(agreed: {agreed})_"
            )
        lines.append("")
    return "\n".join(lines)


def calendar_uploaded(file):
    """Run predictions + calendar for an uploaded file."""
    if file is None:
        return "Upload a file first.", ""
    data_str = _load_and_prepare(file.name)
    claude, gemini, mistral = _run_predictions(data_str)
    raw = asyncio.run(ask_gemini_calendar(data_str, claude, gemini, mistral))
    return _format_calendar(raw), raw


def calendar_local(filename):
    """Run predictions + calendar for a local file."""
    if not filename:
        return "Select a file first.", ""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return f"File not found: {filepath}", ""
    data_str = _load_and_prepare(filepath)
    claude, gemini, mistral = _run_predictions(data_str)
    raw = asyncio.run(ask_gemini_calendar(data_str, claude, gemini, mistral))
    return _format_calendar(raw), raw


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
                mistral_up = gr.Markdown(label="Mistral")

            upload_btn.click(
                fn=analyse_uploaded,
                inputs=[file_input],
                outputs=[claude_up, gemini_up, mistral_up],
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
                mistral_loc = gr.Markdown(label="Mistral")

            local_btn.click(
                fn=analyse_local,
                inputs=[file_dropdown],
                outputs=[claude_loc, gemini_loc, mistral_loc],
            )

        # --- Tab 3: Week Ahead Calendar ---
        with gr.Tab("Week Ahead"):
            gr.Markdown("Runs all providers, then sends combined results to Gemini "
                        "to build a week-ahead spending calendar. "
                        "Predictions that agree across models are prioritised.")

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

if __name__ == "__main__":
    demo.launch(server_port=8002)
