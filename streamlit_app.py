"""
Streamlit UI for GoszakupAI.

Run:
    streamlit run streamlit_app.py
"""
import json
import numpy as np
import pandas as pd
import streamlit as st

from src.model.analyzer import GoszakupAnalyzer
from src.utils.config import GOSZAKUP_TOKEN, RAW_DIR, set_goszakup_token


st.set_page_config(page_title="GoszakupAI", layout="wide")


def _get_analyzer() -> GoszakupAnalyzer:
    analyzer = st.session_state.get("analyzer")
    if analyzer is None:
        analyzer = GoszakupAnalyzer(use_transformers=False)
        analyzer.initialize()
        st.session_state["analyzer"] = analyzer
    return analyzer


def _reset_analyzer() -> GoszakupAnalyzer:
    analyzer = GoszakupAnalyzer(use_transformers=False)
    analyzer.initialize()
    st.session_state["analyzer"] = analyzer
    return analyzer


def _load_schema_mock() -> dict:
    mock_path = RAW_DIR / "goszakup_schema_mock.json"
    if not mock_path.exists():
        return {}
    try:
        return json.loads(mock_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _analysis_to_row(result) -> dict:
    return {
        "lot_id": result.lot_id,
        "name_ru": result.lot_data.get("name_ru", ""),
        "category_code": result.lot_data.get("category_code", ""),
        "category_name": result.lot_data.get("category_name", ""),
        "budget": result.lot_data.get("budget", 0),
        "participants": result.lot_data.get("participants_count", 0),
        "deadline_days": result.lot_data.get("deadline_days", 0),
        "risk_score": round(result.final_score, 1),
        "risk_level": result.final_level,
    }


st.title("GoszakupAI")

analyzer = _get_analyzer()
results = analyzer.analyze_all()

with st.sidebar:
    st.header("Data Access")
    st.caption("Set goszakup token or run with mock data.")

    token_input = st.text_input(
        "Goszakup token",
        type="password",
        value=GOSZAKUP_TOKEN or "",
        help="Leave empty to use mock data.",
    )
    persist_token = st.checkbox("Persist to .env", value=True)

    if st.button("Save token"):
        set_goszakup_token(token_input, persist=persist_token)
        analyzer = _reset_analyzer()
        results = analyzer.analyze_all()
        st.success("Token updated. Analyzer reloaded.")

    mode_label = "Mock" if analyzer.client.use_mock else "Real API"
    st.markdown(f"**Mode:** {mode_label}")
    st.markdown(f"**Total lots:** {len(analyzer._lots)}")


st.markdown("---")

tab_lots, tab_text, tab_schema, tab_insights = st.tabs([
    "Lots",
    "Analyze Text",
    "Schema Mock",
    "Insights",
])

with tab_lots:
    st.subheader("Lots")
    col_filters, col_detail = st.columns([2, 3])

    with col_filters:
        page_size = st.selectbox("Page size", [10, 20, 50, 100], index=1)
        total = len(results)
        total_pages = max(1, (total + page_size - 1) // page_size)
        page = st.number_input("Page", min_value=1, max_value=total_pages, value=1)
        start = (page - 1) * page_size
        end = start + page_size

        rows = [_analysis_to_row(r) for r in results[start:end]]
        st.dataframe(rows, width="stretch")

        lot_options = [r.lot_id for r in results[start:end]]
        selected_lot_id = st.selectbox("Select lot", lot_options) if lot_options else None

    with col_detail:
        if selected_lot_id:
            analysis = analyzer.analyze_lot(selected_lot_id)
            st.markdown("### Lot analysis")
            if analysis.explanation:
                st.markdown("**Explanation**")
                st.write(analysis.explanation)
            st.json(analysis.to_dict())
        else:
            st.info("Select a lot to see full analysis.")

with tab_text:
    st.subheader("Analyze custom text")
    with st.form("analyze_text_form"):
        text = st.text_area("Specification text", height=180)
        col_a, col_b, col_c, col_d = st.columns(4)
        with col_a:
            budget = st.number_input("Budget (KZT)", min_value=0.0, value=0.0)
        with col_b:
            participants = st.number_input("Participants", min_value=0, value=0)
        with col_c:
            deadline = st.number_input("Deadline (days)", min_value=0, value=0)
        with col_d:
            category_code = st.text_input("Category code")

        submitted = st.form_submit_button("Analyze")

    if submitted:
        result = analyzer.analyze_text(
            text,
            metadata={
                "budget": budget,
                "participants_count": participants,
                "deadline_days": deadline,
                "category_code": category_code,
            },
        )
        st.json(result.to_dict())

with tab_schema:
    st.subheader("goszakup_schema_mock.json")
    schema_data = _load_schema_mock()
    if not schema_data:
        st.info("Schema mock not found. Generate it by running the mock generator.")
    else:
        st.json(schema_data)

with tab_insights:
    st.subheader("Insights")

    df = pd.DataFrame([_analysis_to_row(r) for r in results])
    if df.empty:
        st.info("No data available.")
    else:
        st.markdown("**Risk distribution**")
        order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        counts = df["risk_level"].value_counts().reindex(order, fill_value=0)
        st.bar_chart(counts)

        st.markdown("**Risk score histogram**")
        bins = list(range(0, 101, 10))
        hist, edges = np.histogram(df["risk_score"], bins=bins)
        labels = [f"{edges[i]}-{edges[i + 1]}" for i in range(len(edges) - 1)]
        hist_df = pd.DataFrame({"score_bucket": labels, "count": hist})
        st.bar_chart(hist_df.set_index("score_bucket"))

        st.markdown("**Top 10 risky lots**")
        top_df = df.sort_values("risk_score", ascending=False).head(10)
        st.dataframe(top_df, width="stretch")

        st.markdown("**ML diagnostics**")
        selected = st.selectbox("Lot for ML details", df["lot_id"].tolist())
        if selected:
            selected_analysis = analyzer.analyze_lot(selected)
            ml = selected_analysis.ml_prediction or {}
            st.json(ml)
