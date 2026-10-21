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
REMOVED_COMPARISONS = {
    "b1_TOB_0_4_T1_None_0_T2",
    "b1_TOB_0_4_T2_None_0_T1",
}
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
    parser.add_argument(
        "--prepared-source-dir",
        type=Path,
        default=None,
        help="Use an existing prepared_browser snapshot as the experimental source.",
    )
    parser.add_argument(
        "--annotation-path",
        type=Path,
        default=None,
        help="PAO1 annotation TSV containing operon and TU fields.",
    )
    parser.add_argument(
        "--guide-metadata-path",
        type=Path,
        default=None,
        help="Guide-library TSV used to fill design metadata.",
    )
    return parser.parse_args()


def comparison_id(batch: str, condition: str) -> str:
    value = re.sub(r"[^A-Za-z0-9]+", "_", condition).strip("_")
    return f"{batch}_{value}"


def display_condition(batch: str, raw_condition: str) -> str:
    """Create the user-facing batch-aware comparison label."""
    left, right = [part.strip() for part in raw_condition.split(" - ", 1)]
    left = left.replace("None_0_", "MH_control_")
    right = right.replace("None_0_", "MH_control_")
    return f"{batch.upper()}: {left} vs {right}"


def normalize_manifest(manifest: pd.DataFrame) -> pd.DataFrame:
    """Apply the shared label convention and remove invalid comparisons."""
    manifest = manifest[
        ~manifest["comparison_id"].isin(REMOVED_COMPARISONS)
    ].copy()
    manifest["display_label"] = manifest.apply(
        lambda row: display_condition(row["batch"], row["raw_condition"]),
        axis=1,
    )
    manifest["comparison_order"] = (
        manifest.sort_values(["batch", "comparison_order", "comparison_id"])
        .groupby("batch")
        .cumcount()
        .add(1)
    )
    return manifest.sort_values(["batch", "comparison_order", "comparison_id"])


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
                    "display_label": display_condition(batch, condition),
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
                    "display_label": display_condition(batch, CONTROL_CONDITION),
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
    return normalize_manifest(manifest)


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


def enrich_annotation(frame: pd.DataFrame, annotation: pd.DataFrame) -> pd.DataFrame:
    """Fill browser annotation fields from the PAO1 locus-keyed annotation."""
    fields = [
        "PA14_ID",
        "gene_name",
        "product_name",
        "category",
        "feature_type",
        "start",
        "end",
        "strand",
        "operon",
        "TU",
    ]
    available = ["PAO1_ID"] + [field for field in fields if field in annotation]
    annotation_frame = annotation[available].drop_duplicates("PAO1_ID")
    enriched = frame.drop(
        columns=[
            column
            for column in ["operon", "TU"]
            if column in frame.columns
        ],
        errors="ignore",
    ).merge(annotation_frame, on="PAO1_ID", how="left", suffixes=("", "_annotation"))
    for field in fields:
        annotation_field = f"{field}_annotation"
        if annotation_field in enriched:
            if field in enriched:
                enriched[field] = enriched[field].replace("", pd.NA).fillna(
                    enriched[annotation_field]
                )
            else:
                enriched[field] = enriched[annotation_field]
            enriched.drop(columns=[annotation_field], inplace=True)
    return enriched


def prepare_existing_snapshot(
    source_dir: Path,
    output_dir: Path,
    annotation_path: Path | None,
    guide_metadata_path: Path | None,
) -> None:
    """Rebuild canonical import files from an existing prepared snapshot."""
    required_files = [
        "comparison_manifest.tsv",
        "condition_gene_data.tsv",
        "guide_data.tsv",
        "mismatch_data.tsv",
    ]
    missing = [name for name in required_files if not (source_dir / name).exists()]
    if missing:
        raise ValueError(
            f"{source_dir} is missing prepared browser files: {', '.join(missing)}"
        )

    manifest = pd.read_csv(source_dir / required_files[0], sep="\t", dtype=str).fillna("")
    summaries = pd.read_csv(source_dir / required_files[1], sep="\t").fillna("")
    guides = pd.read_csv(source_dir / required_files[2], sep="\t").fillna("")
    mismatch = pd.read_csv(source_dir / required_files[3], sep="\t").fillna("")
    manifest = normalize_manifest(manifest)
    valid_ids = set(manifest["comparison_id"])
    for frame in (guides, summaries, mismatch):
        if "comparison_id" in frame:
            frame.drop(
                index=frame.index[~frame["comparison_id"].isin(valid_ids)],
                inplace=True,
            )
        if "condition" in frame:
            labels = manifest.set_index("comparison_id")["display_label"]
            frame["condition"] = frame["comparison_id"].map(labels)

    annotation = None
    if annotation_path:
        annotation = pd.read_csv(annotation_path, sep="\t").fillna("")
        for frame in (summaries, guides):
            if "PAO1_ID" not in frame:
                raise ValueError("Prepared browser rows must contain PAO1_ID")
        summaries = enrich_annotation(summaries, annotation)
        guides = enrich_annotation(guides, annotation)

    if guide_metadata_path:
        guide_metadata = pd.read_csv(guide_metadata_path, sep="\t").fillna("")
        metadata_columns = [
            column
            for column in [
                "spacer",
                "pam",
                "downstream",
                "off_target_n",
                "mean_abund_50M",
                "gc",
                "predicted_efficacy_score",
            ]
            if column in guide_metadata
        ]
        if "spacer" not in metadata_columns:
            raise ValueError("Guide metadata must contain spacer")
        guides = guides.drop(
            columns=[
                column
                for column in metadata_columns
                if column != "spacer" and column in guides
            ],
            errors="ignore",
        ).merge(
            guide_metadata[metadata_columns].drop_duplicates("spacer"),
            on="spacer",
            how="left",
            suffixes=("", "_library"),
        )

    for frame in (guides, mismatch):
        if "predicted_efficacy_score" not in frame:
            frame["predicted_efficacy_score"] = ""
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest.to_csv(output_dir / required_files[0], sep="\t", index=False)
    summaries.to_csv(output_dir / required_files[1], sep="\t", index=False)
    guides.to_csv(output_dir / required_files[2], sep="\t", index=False)
    mismatch.to_csv(output_dir / required_files[3], sep="\t", index=False)
    pd.DataFrame(
        [
            {
                "dataset": name.removesuffix(".tsv"),
                "rows": len(pd.read_csv(output_dir / name, sep="\t")),
                "source": str(source_dir / name),
            }
            for name in required_files
        ]
    ).to_csv(output_dir / "data_audit.tsv", sep="\t", index=False)


def main() -> None:
    args = parse_args()
    root = args.project_root.resolve()
    output_dir = (args.output_dir or root / "data_import" / "prepared_browser").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.prepared_source_dir:
        prepare_existing_snapshot(
            args.prepared_source_dir.resolve(),
            output_dir,
            args.annotation_path.resolve() if args.annotation_path else None,
            args.guide_metadata_path.resolve() if args.guide_metadata_path else None,
        )
        return

    input_root = root / "data_import" / "edgeR_manuscript_subset"

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
