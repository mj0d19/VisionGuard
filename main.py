import argparse
from pathlib import Path

import yaml


def _load_yaml_config(config_path: str) -> dict:
	path = Path(config_path)
	if not path.is_file():
		fallback = Path("config") / config_path
		if fallback.is_file():
			path = fallback
		else:
			raise FileNotFoundError(
				f"Config file not found: {config_path}. Also checked: {fallback}"
			)

	try:
		data = yaml.safe_load(path.read_text(encoding="utf-8"))
	except yaml.YAMLError as exc:
		raise ValueError(f"Invalid YAML in config file {config_path}: {exc}") from exc

	if data is None:
		return {}
	if not isinstance(data, dict):
		raise ValueError(f"Config file must contain a YAML mapping at top level: {config_path}")
	return data

def parse_args() -> argparse.Namespace:
	config_parser = argparse.ArgumentParser(add_help=False)
	config_parser.add_argument(
		"--config",
		default="",
		help="Optional path to YAML config file. CLI flags override config values.",
	)
	config_args, remaining_argv = config_parser.parse_known_args()

	parser = argparse.ArgumentParser(
		description="YOLO tracking + X3D action recognition",
		parents=[config_parser],
	)
	parser.add_argument("--input", default="", help="Input video path")
	parser.add_argument("--output", default="output_actions.mp4", help="Output video path")
	parser.add_argument("--yolo-weights", default="yolov8n.pt", help="YOLO model weights")
	parser.add_argument("--enable-segmentation", action="store_true", help="Enable person segmentation masking for embeddings")
	parser.add_argument("--seg-weights", default="yolov8n-seg.pt", help="Segmentation model weights")
	parser.add_argument("--seg-conf", type=float, default=0.25, help="Segmentation confidence threshold")
	parser.add_argument("--seg-mask-threshold", type=float, default=0.5, help="Mask binarization threshold")
	parser.add_argument("--seg-min-foreground-ratio", type=float, default=0.15, help="Minimum foreground ratio to trust segmented embeddings")
	parser.add_argument("--visualize-seg-mask", action="store_true", help="Overlay segmentation mask on output video")
	parser.add_argument("--seg-overlay-alpha", type=float, default=0.35, help="Overlay alpha for segmentation mask visualization")
	parser.add_argument("--enable-scene-segmentation", action="store_true", help="Enable semantic scene segmentation at video start")
	parser.add_argument("--scene-segmentation-model", default="nvidia/segformer-b0-finetuned-ade-512-512", help="HuggingFace model ID for scene segmentation")
	parser.add_argument("--visualize-scene-segmentation", action="store_true", help="Overlay scene segmentation on output video")
	parser.add_argument(
		"--scene-segmentation-frame-idx",
		type=int,
		default=185,
		help="Frame index (0-based) to run scene segmentation on (default: 185)",
	)
	parser.add_argument("--scene-context-expansion", type=float, default=1.5, help="Expansion factor for sampling scene context around detection bbox")
	parser.add_argument("--scene-context-topk", type=int, default=5, help="Number of top segmentation classes to include per detection in logs")
	parser.add_argument("--scene-context-save-path", default="", help="Optional path to save per-detection scene crops (png)")
	parser.add_argument(
		"--action-model",
		default="x3d_l",
		choices=["x3d_xs", "x3d_s", "x3d_m", "x3d_l", "x3d_custom"],
		help="Action model: x3d_xs/x3d_s/x3d_m/x3d_l (Kinetics-400) or x3d_custom (weights/X3D.pth).",
	)
	parser.add_argument(
		"--action-label-map",
		default="config/custom_action_labels.txt",
		help="Path to action class labels (one label per line)",
	)
	parser.add_argument(
		"--tracker",
		default="config/botsort_occlusion.yaml",
		help="YOLO tracker config. Options: botsort_occlusion.yaml (balanced) or botsort_best_quality.yaml (strongest IDs)",
	)
	parser.add_argument("--device", default="cuda:0", help="Device: cuda:0 or cpu")

	parser.add_argument("--person-class-id", type=int, default=0, help="YOLO person class id")
	parser.add_argument("--clip-len", type=int, default=16, help="Frames per action clip")
	parser.add_argument("--infer-stride", type=int, default=4, help="Run action every N frames")
	parser.add_argument("--smooth-window", type=int, default=8, help="Prediction smoothing window")
	parser.add_argument("--expand-scale", type=float, default=1.2, help="BBox expansion scale")
	parser.add_argument(
		"--action-expand-scale",
		type=float,
		default=1.45,
		help="BBox expansion scale specifically for X3D action crops (should be >= --expand-scale)",
	)
	parser.add_argument("--min-box-size", type=int, default=12, help="Skip tiny tracks")
	parser.add_argument("--reid-reassociate-threshold", type=float, default=0.75, help="Similarity threshold to map new raw IDs to old stable IDs")
	parser.add_argument("--reid-max-gap-frames", type=int, default=300, help="Max frame gap for stable ID reassociation")
	parser.add_argument("--reid-margin-threshold", type=float, default=0.08, help="Minimum best-vs-second-best similarity margin for reassociation")
	parser.add_argument("--reid-min-probe-frames", type=int, default=2, help="Minimum observations of a new raw track before reassociation")
	parser.add_argument("--reid-tentative-max-age-frames", type=int, default=120, help="Max age of a new stable ID that is still eligible for late merge")
	parser.add_argument("--reid-tentative-max-gallery", type=int, default=4, help="Max gallery size for a stable ID to still be treated as tentative")
	parser.add_argument("--memory-min-fused-similarity", type=float, default=0.55, help="Minimum fused similarity to allow embedding memory update")
	parser.add_argument("--memory-min-det-conf", type=float, default=0.25, help="Minimum detection confidence to allow embedding memory update")

	parser.add_argument("--side-size", type=int, default=256, help="Short side resize for X3D")
	parser.add_argument("--crop-size", type=int, default=224, help="Center crop size for X3D")
	parser.add_argument(
		"--event-log-path",
		default="",
		help="Optional path to write JSONL runtime events (one event per line)",
	)
	parser.add_argument(
		"--event-log-flush-every",
		type=int,
		default=100,
		help="Flush event log file every N events",
	)
	parser.add_argument(
		"--event-log-frames",
		action="store_true",
		help="Also log per-frame summary events (in addition to per-track events)",
	)
	parser.add_argument(
		"--save-events-db",
		action="store_true",
		help="Persist deduplicated track events into PostgreSQL",
	)
	parser.add_argument(
		"--db-run-name",
		default="",
		help="Optional human-readable name for the DB run",
	)
	parser.add_argument(
		"--track-crop-size",
		type=int,
		default=256,
		help="Resize each tracked person crop to a fixed size before buffering",
	)
	parser.add_argument(
		"--enable-alerts",
		action="store_true",
		help="Enable action-based alert generation",
	)
	parser.add_argument(
		"--alert-rules-path",
		default="config/alert_rules.json",
		help="Path to JSON alert rules",
	)
	parser.add_argument(
		"--alert-min-score",
		type=float,
		default=0.7,
		help="Fallback minimum action score for generated default alert rule",
	)
	parser.add_argument(
		"--alert-min-consecutive",
		type=int,
		default=3,
		help="Fallback consecutive hits required for generated default alert rule",
	)
	parser.add_argument(
		"--alert-cooldown-frames",
		type=int,
		default=60,
		help="Fallback cooldown for generated default alert rule",
	)
	if config_args.config:
		config_data = _load_yaml_config(config_args.config)
		valid_keys = {action.dest for action in parser._actions if action.dest}
		unknown_keys = [key for key in config_data.keys() if key not in valid_keys]
		if unknown_keys:
			raise ValueError(
				"Unknown config key(s): "
				+ ", ".join(sorted(unknown_keys))
				+ f". Update {config_args.config} to match available CLI args."
			)

		parser.set_defaults(**config_data)

	args = parser.parse_args(remaining_argv)
	if not str(args.input).strip():
		parser.error("the following arguments are required: --input")
	if int(args.infer_stride) < 1:
		parser.error("--infer-stride must be >= 1")
	return args


if __name__ == "__main__":
	args = parse_args()
	from src.pipeline.video_action_pipeline import run

	run(args)
