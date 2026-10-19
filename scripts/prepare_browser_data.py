#!/usr/bin/env python
"""Prepare inspectable TSV inputs for the manuscript-subset browser."""

from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

import pandas as pd


BATCHES = ("b1", "b2", "b3", "b4")
CONTROL_CONDITION = "None_0_T1 - None_0_T0"
REQUIRED_GUIDE_COLUMNS = {
    "PAO1_ID",
    "PA14_ID",
    "gene_name",
    "category",
    "spacer",
    "type",
    "y_pred",
    "original",
    "offset",
    "TU",
    "condition",
    "LFC",
    "pval",
    "LFC.adj",
    "shift",
    "base",
}
REQUIRED_MEDIAN_COLUMNS = {
    "PAO1_ID",
    "PA14_ID",
    "gene_name",
    "type",
    "condition",
    "medLFC",
    "p_stouffer",
    "shift",
    "base",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
    )
    return parser.parse_args()


def comparison_id(batch: str, condition: str) -> str:
    value = re.sub(r"[^A-Za-z0-9]+", "_", condition).strip("_")
    return f"{batch}_{value}"


def load_input(path: Path, required: set[str]) -> pd.DataFrame:
    frame = pd.read_csv(path, sep="\t", compression="infer")
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"{path} is missing required columns: {', '.join(missing)}")
    return frame


def select_manifest(frames: dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for batch, frame in frames.items():
        conditions = sorted(frame["condition"].dropna().astype(str).unique())
        for condition in conditions:
            left, right = [part.strip() for part in condition.split(" - ", 1)]
            if left.startswith("None_0_") and right.startswith("None_0_"):
                continue
            if left.startswith("None_0_") or not right.startswith("None_0_"):
                continue
            treatment = left
            rows.append(
                {
                    "batch": batch,
                    "comparison_id": comparison_id(batch, condition),
                    "raw_condition": condition,
                    "display_label": f"{treatment} vs {right}",
                    "comparison_class": "treatment",
                    "comparison_order": 1,
                }
            )
        if CONTROL_CONDITION in conditions:
            rows.append(
                {
                    "batch": batch,
                    "comparison_id": comparison_id(batch, CONTROL_CONDITION),
                    "raw_condition": CONTROL_CONDITION,
                    "display_label": f"{batch.upper()} untreated control",
                    "comparison_class": "control",
                    "comparison_order": 2,
                }
            )
        else:
            raise ValueError(
                f"{batch} does not contain the matched control {CONTROL_CONDITION!r}"
            )
    manifest = pd.DataFrame(rows).drop_duplicates(
        subset=["batch", "raw_condition"]
    )
    manifest["comparison_order"] = manifest.groupby("batch")["comparison_order"].rank(
        method="first"
    ).astype(int)
    return manifest.sort_values(["batch", "comparison_class", "raw_condition"])


def add_manifest_fields(
    frame: pd.DataFrame, manifest: pd.DataFrame, condition_column: str
) -> pd.DataFrame:
    selected = frame.merge(
        manifest,
        left_on=["batch", condition_column],
        right_on=["batch", "raw_condition"],
        how="inner",
    )
    selected["condition"] = selected["display_label"]
    return selected


def write_tsv(frame: pd.DataFrame, path: Path, columns: list[str]) -> int:
    output = frame.loc[:, [column for column in columns if column in frame.columns]]
    output.to_csv(path, sep="\t", index=False)
    return len(output)


def main() -> None:
    args = parse_args()
    root = args.project_root.resolve()
    input_root = root / "data_import" / "edgeR_manuscript_subset"
    output_dir = (args.output_dir or root / "data_import" / "prepared_browser").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    guide_frames: dict[str, pd.DataFrame] = {}
    median_frames: dict[str, pd.DataFrame] = {}
    for batch in BATCHES:
        guide_frames[batch] = load_input(
            input_root / batch / "melted_results.tsv.gz", REQUIRED_GUIDE_COLUMNS
        ).assign(batch=batch)
        median_frames[batch] = load_input(
            input_root / batch / "median_melted_results.tsv.gz",
            REQUIRED_MEDIAN_COLUMNS,
        ).assign(batch=batch)

    manifest = select_manifest(median_frames)
    manifest.to_csv(output_dir / "comparison_manifest.tsv", sep="\t", index=False)

    guide_data = add_manifest_fields(
        pd.concat(guide_frames.values(), ignore_index=True),
        manifest,
        "condition",
    )
    median_data = add_manifest_fields(
        pd.concat(median_frames.values(), ignore_index=True),
        manifest,
        "condition",
    )

    annotation_path = root / "dataFiles" / "PAO1_curated.tsv"
    annotation = pd.read_csv(annotation_path, sep="\t")
    annotation_columns = [
        "PAO1_ID",
        "gene_name",
        "category",
        "feature_type",
        "start",
        "end",
        "strand",
        "product_name",
        "length",
    ]
    guide_data = guide_data.merge(
        annotation[annotation_columns].drop_duplicates("PAO1_ID"),
        on="PAO1_ID",
        suffixes=("", "_annotation"),
        how="left",
    )
    median_data = median_data.merge(
        annotation[annotation_columns].drop_duplicates("PAO1_ID"),
        on="PAO1_ID",
        suffixes=("", "_annotation"),
        how="left",
    )
    for frame in (guide_data, median_data):
        if "gene_name_annotation" in frame:
            frame["gene_name"] = frame["gene_name_annotation"].fillna(
                frame["gene_name"]
            )
            frame.drop(columns=["gene_name_annotation"], inplace=True)
        if "category_annotation" in frame:
            frame["category"] = frame["category_annotation"].fillna(
                frame["category"]
            )
            frame.drop(columns=["category_annotation"], inplace=True)

    guide_metadata_path = root / "dataFiles" / "Lib1_FLguides.tsv"
    guide_metadata = pd.read_csv(guide_metadata_path, sep="\t")
    guide_metadata_columns = [
        "spacer",
        "pam",
        "downstream",
        "off_target_n",
        "mean_abund_50M",
        "gc",
        "predicted_efficacy_score",
    ]
    guide_data = guide_data.merge(
        guide_metadata[guide_metadata_columns].drop_duplicates("spacer"),
        on="spacer",
        how="left",
    )
    model_scores_path = (
        root / "data_import" / "mismatch_tab" / "Lib1_all_guides_with_model_scores.tsv.gz"
    )
    model_scores = pd.read_csv(
        model_scores_path,
        sep="\t",
        compression="infer",
        usecols=["PAO1_ID", "spacer", "predicted_efficacy_score", "score_status"],
    )
    model_scores = model_scores.rename(
        columns={"predicted_efficacy_score": "model_predicted_efficacy_score"}
    )
    guide_data = guide_data.merge(
        model_scores.drop_duplicates(["PAO1_ID", "spacer"]),
        on=["PAO1_ID", "spacer"],
        how="left",
    )
    guide_data["predicted_efficacy_score"] = guide_data[
        "model_predicted_efficacy_score"
    ].combine_first(guide_data["predicted_efficacy_score"])
    guide_data.drop(columns=["model_predicted_efficacy_score"], inplace=True)

    median_data["is_significant"] = (
        median_data["medLFC"].abs().gt(1)
        & median_data["p_stouffer"].lt(0.05)
    )
    median_data["log10_p_stouffer"] = -median_data["p_stouffer"].clip(lower=1e-300).map(
        math.log10
    )

    guide_columns = [
        "PAO1_ID",
        "PA14_ID",
        "gene_name",
        "product_name",
        "category",
        "feature_type",
        "start",
        "end",
        "strand",
        "spacer",
        "original",
        "type",
        "y_pred",
        "offset",
        "TU",
        "condition",
        "raw_condition",
        "batch",
        "comparison_id",
        "comparison_class",
        "LFC",
        "pval",
        "LFC.adj",
        "shift",
        "base",
        "pam",
        "downstream",
        "off_target_n",
        "mean_abund_50M",
        "gc",
        "predicted_efficacy_score",
        "score_status",
    ]
    median_columns = [
        "PAO1_ID",
        "PA14_ID",
        "gene_name",
        "product_name",
        "category",
        "feature_type",
        "start",
        "end",
        "strand",
        "type",
        "condition",
        "raw_condition",
        "batch",
        "comparison_id",
        "comparison_class",
        "medLFC",
        "p_stouffer",
        "log10_p_stouffer",
        "is_significant",
        "shift",
        "base",
    ]
    mismatch_columns = [
        "PAO1_ID",
        "gene_name",
        "product_name",
        "spacer",
        "original",
        "type",
        "y_pred",
        "LFC",
        "LFC.adj",
        "condition",
        "raw_condition",
        "batch",
        "comparison_id",
        "comparison_class",
        "predicted_efficacy_score",
    ]

    counts = [
        {
            "dataset": "condition_gene_data",
            "significance_rule": "abs(medLFC) > 1 and p_stouffer < 0.05",
            "rows": write_tsv(
                median_data,
                output_dir / "condition_gene_data.tsv",
                median_columns,
            ),
        },
        {
            "dataset": "guide_data",
            "significance_rule": "not classified; guide-level source data",
            "rows": write_tsv(guide_data, output_dir / "guide_data.tsv", guide_columns),
        },
        {
            "dataset": "mismatch_data",
            "significance_rule": "not classified; guide-level mismatch series",
            "rows": write_tsv(
                guide_data[guide_data["type"].isin(["mismatch", "perfect"])],
                output_dir / "mismatch_data.tsv",
                mismatch_columns,
            ),
        },
    ]
    audit = pd.DataFrame(counts)
    audit["batches"] = ",".join(BATCHES)
    audit.to_csv(output_dir / "data_audit.tsv", sep="\t", index=False)


if __name__ == "__main__":
    main()
