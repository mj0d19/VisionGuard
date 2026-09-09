from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from queue import Queue
from threading import Thread
from typing import Any, Deque, Dict, Optional, Tuple

import cv2
import os
import numpy as np
from ultralytics import YOLO

from src.alerts.engine import ActionAlertEngine
from src.alerts.models import AlertRule
from src.alerts.rule_loader import load_alert_rules
from src.events.db_event_sink import DBEventSink
from src.events.video_event_logger import VideoEventLogger
from src.notifications.alert_notifier import AlertNotifier
from src.models.action.x3d_recognizer import (
	X3DRecognizer,
	apply_action_model_presets,
	load_action_label_map,
)
from src.models.detection.box_utils import expand_box, get_object_label
from src.models.segmentation.person_mask import apply_person_segmentation_mask
from src.models.segmentation.scene_segmentation import SceneSegmentationEngine
from src.models.tracking.embedding_manager import EmbeddingManager


@dataclass
class ActionState:
	label: str
	score: float


class AsyncVideoEventLogger:
	"""Background writer for JSONL events to reduce main-loop I/O stalls."""

	def __init__(self, logger: VideoEventLogger):
		self._logger = logger
		self._queue: Queue = Queue()
		self._stop_sentinel = object()
		self._worker_error: Optional[BaseException] = None
		self._closed = False
		self._thread = Thread(target=self._run, name="event-log-writer", daemon=True)
		self._thread.start()

	def _run(self) -> None:
		try:
			while True:
				item = self._queue.get()
				if item is self._stop_sentinel:
					break

				kind, payload = item
				if kind == "track":
					self._logger.log_track(payload)
				elif kind == "alert":
					self._logger.log_alert(payload)
				elif kind == "frame":
					self._logger.log_frame(
						frame_idx=int(payload["frame_idx"]),
						timestamp_s=float(payload["timestamp_s"]),
						active_track_count=int(payload["active_track_count"]),
						tracked_person_count=int(payload["tracked_person_count"]),
					)
		except BaseException as exc:
			self._worker_error = exc

	def _enqueue(self, kind: str, payload: Dict[str, Any]) -> None:
		if self._worker_error is not None:
			raise RuntimeError(f"Async event logger worker failed: {self._worker_error}")
		if self._closed:
			return
		self._queue.put((kind, payload))

	def log_track(self, payload: Dict[str, Any]) -> None:
		self._enqueue("track", payload)

	def log_alert(self, payload: Dict[str, Any]) -> None:
		self._enqueue("alert", payload)

	def log_frame(self, *, frame_idx: int, timestamp_s: float, active_track_count: int, tracked_person_count: int) -> None:
		self._enqueue(
			"frame",
			{
				"frame_idx": int(frame_idx),
				"timestamp_s": float(timestamp_s),
				"active_track_count": int(active_track_count),
				"tracked_person_count": int(tracked_person_count),
			},
		)

	def close(self) -> None:
		if self._closed:
			return
		self._closed = True
		self._queue.put(self._stop_sentinel)
		self._thread.join()
		self._logger.close()
		if self._worker_error is not None:
			raise RuntimeError(f"Async event logger worker failed: {self._worker_error}")


class AsyncDBEventSink:
	"""Background DB writer for track and alert events."""

	def __init__(
		self,
		*,
		input_path: str,
		output_path: str,
		fps: float,
		frame_width: int,
		frame_height: int,
		run_name: str = "",
		scene_context_topk: int = 5,
	):
		self._sink_kwargs = {
			"input_path": input_path,
			"output_path": output_path,
			"fps": float(fps),
			"frame_width": int(frame_width),
			"frame_height": int(frame_height),
			"run_name": run_name,
			"scene_context_topk": int(scene_context_topk),
		}
		self._sink: Optional[DBEventSink] = None
		self._run_id = ""
		self._queue: Queue = Queue()
		self._stop_sentinel = object()
		self._worker_error: Optional[BaseException] = None
		self._closed = False
		self._thread = Thread(target=self._run, name="db-event-writer", daemon=True)
		self._thread.start()

	@property
	def run_id(self) -> str:
		return self._run_id

	def _run(self) -> None:
		try:
			self._sink = DBEventSink(**self._sink_kwargs)
			self._run_id = self._sink.run_id
			while True:
				item = self._queue.get()
				if item is self._stop_sentinel:
					break

				kind, payload = item
				if kind == "track":
					self._sink.add_track_event(payload)
				elif kind == "alert":
					self._sink.add_alert(payload)
				elif kind == "finalize":
					self._sink.finalize(total_frames=int(payload.get("total_frames", 0)))
		except BaseException as exc:
			self._worker_error = exc

	def _enqueue(self, kind: str, payload: Dict[str, Any]) -> None:
		if self._worker_error is not None:
			raise RuntimeError(f"Async DB sink worker failed: {self._worker_error}")
		if self._closed:
			return
		self._queue.put((kind, payload))

	def add_track_event(self, payload: Dict[str, Any]) -> None:
		self._enqueue("track", payload)

	def add_alert(self, payload: Dict[str, Any]) -> None:
		self._enqueue("alert", payload)

	def finalize(self, total_frames: int) -> None:
		if self._closed:
			return
		self._closed = True
		self._queue.put(("finalize", {"total_frames": int(total_frames)}))
		self._queue.put(self._stop_sentinel)
		self._thread.join()
		if self._worker_error is not None:
			raise RuntimeError(f"Async DB sink worker failed: {self._worker_error}")


def draw_modern_box(
	frame: np.ndarray,
	x1: int,
	y1: int,
	x2: int,
	y2: int,
	*,
	color: Tuple[int, int, int] = (80, 235, 120),
	line_thickness: int = 2,
	fill_alpha: float = 0.16,
	corner_ratio: float = 0.2,
) -> None:
	"""Draw a modern overlay box with subtle fill and corner accents."""
	if x1 >= x2 or y1 >= y2:
		return

	h, w = frame.shape[:2]
	x1 = max(0, min(x1, w - 1))
	y1 = max(0, min(y1, h - 1))
	x2 = max(0, min(x2, w - 1))
	y2 = max(0, min(y2, h - 1))
	if x1 >= x2 or y1 >= y2:
		return

	# Add a transparent fill to improve target visibility without clutter.
	overlay = frame.copy()
	cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
	cv2.addWeighted(overlay, float(fill_alpha), frame, 1.0 - float(fill_alpha), 0.0, frame)

	box_w = x2 - x1
	box_h = y2 - y1
	corner_len = max(8, int(min(box_w, box_h) * float(corner_ratio)))

	# Draw corner accents for a cleaner modern style.
	cv2.line(frame, (x1, y1), (x1 + corner_len, y1), color, line_thickness, cv2.LINE_AA)
	cv2.line(frame, (x1, y1), (x1, y1 + corner_len), color, line_thickness, cv2.LINE_AA)

	cv2.line(frame, (x2, y1), (x2 - corner_len, y1), color, line_thickness, cv2.LINE_AA)
	cv2.line(frame, (x2, y1), (x2, y1 + corner_len), color, line_thickness, cv2.LINE_AA)

	cv2.line(frame, (x1, y2), (x1 + corner_len, y2), color, line_thickness, cv2.LINE_AA)
	cv2.line(frame, (x1, y2), (x1, y2 - corner_len), color, line_thickness, cv2.LINE_AA)

	cv2.line(frame, (x2, y2), (x2 - corner_len, y2), color, line_thickness, cv2.LINE_AA)
	cv2.line(frame, (x2, y2), (x2, y2 - corner_len), color, line_thickness, cv2.LINE_AA)

	# Keep a very light outer frame for better edge definition.
	cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)


def draw_label_badge(
	frame: np.ndarray,
	x1: int,
	y1: int,
	text: str,
	*,
	color: Tuple[int, int, int] = (80, 235, 120),
	text_scale: float = 0.5,
	text_thickness: int = 1,
) -> None:
	"""Draw a compact label badge above a tracked subject."""
	if not text:
		return

	h, w = frame.shape[:2]
	(text_w, text_h), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, text_scale, text_thickness)
	pad_x = 8
	pad_y = 6

	badge_x1 = max(0, x1)
	badge_y2 = max(0, y1 - 8)
	badge_y1 = max(0, badge_y2 - (text_h + baseline + pad_y * 2))
	badge_x2 = min(w - 1, badge_x1 + text_w + pad_x * 2)
	if badge_x2 <= badge_x1:
		return

	# If there is not enough room above the box, anchor the badge inside the top edge.
	if badge_y1 == 0 and badge_y2 == 0:
		badge_y1 = max(0, y1)
		badge_y2 = min(h - 1, badge_y1 + text_h + baseline + pad_y * 2)
	else:
		badge_y2 = min(h - 1, badge_y2)

	overlay = frame.copy()
	cv2.rectangle(overlay, (badge_x1, badge_y1), (badge_x2, badge_y2), (12, 18, 28), -1)
	cv2.addWeighted(overlay, 0.88, frame, 0.12, 0.0, frame)
	cv2.rectangle(frame, (badge_x1, badge_y1), (badge_x2, badge_y2), color, 1, cv2.LINE_AA)

	text_x = badge_x1 + pad_x
	text_y = min(h - 1, badge_y2 - pad_y - baseline)
	cv2.putText(
		frame,
		text,
		(text_x, text_y),
		cv2.FONT_HERSHEY_SIMPLEX,
		text_scale,
		(255, 255, 255),
		text_thickness,
		cv2.LINE_AA,
	)


def run(args) -> None:
	apply_action_model_presets(args)

	detector = YOLO(args.yolo_weights)
	segmenter = YOLO(args.seg_weights) if args.enable_segmentation else None
	recognizer = X3DRecognizer(
		device=args.device,
		num_frames=args.clip_len,
		side_size=args.side_size,
		crop_size=args.crop_size,
		model_name=args.action_model,
	)
	
	# Initialize scene segmentation if enabled
	scene_segmenter = None
	scene_segmentation_result = None
	scene_segmentation_frame_idx = int(getattr(args, "scene_segmentation_frame_idx", 185))
	if args.enable_scene_segmentation:
		try:
			scene_segmenter = SceneSegmentationEngine(
				device=args.device,
				model_name=args.scene_segmentation_model,
			)
		except Exception as e:
			print(f"Warning: Failed to initialize scene segmentation: {e}")
			scene_segmenter = None
	
	expected_num_classes = recognizer.expected_num_classes

	embedding_mgr = EmbeddingManager(device=args.device)

	label_map = load_action_label_map(args.action_label_map, num_classes=expected_num_classes)

	if len(label_map) < expected_num_classes:
		raise ValueError(
			f"Label map has only {len(label_map)} classes but model expects {expected_num_classes}. "
			f"Ensure {args.action_label_map} contains enough action labels."
		)

	if expected_num_classes == 21:
		placeholder_count = sum(
			1 for idx in range(expected_num_classes) if label_map.get(idx, "").startswith("class_")
		)
		if placeholder_count > 0:
			raise ValueError(
				f"Custom model requires 21 explicit labels, but {placeholder_count} placeholders were found in {args.action_label_map}."
			)

	clip_buffers: Dict[int, Deque[np.ndarray]] = defaultdict(lambda: deque(maxlen=args.clip_len))
	pred_hist: Dict[int, Deque[str]] = defaultdict(lambda: deque(maxlen=args.smooth_window))
	action_state: Dict[int, ActionState] = {}

	raw_to_stable: Dict[int, int] = {}
	stable_last_seen: Dict[int, int] = {}
	stable_gallery: Dict[int, Deque[np.ndarray]] = defaultdict(lambda: deque(maxlen=12))
	raw_probe_gallery: Dict[int, Deque[np.ndarray]] = defaultdict(lambda: deque(maxlen=4))
	stable_birth_frame: Dict[int, int] = {}
	next_stable_id = 1
	frame_idx = 0
	event_logger = VideoEventLogger(args.event_log_path, args.event_log_flush_every) if args.event_log_path else None
	async_event_logger = AsyncVideoEventLogger(event_logger) if event_logger is not None else None
	async_db_sink = None
	alert_engine = None

	alert_notifier = None
	if args.enable_alerts:
		configured_rules = load_alert_rules(args.alert_rules_path)
		if not configured_rules:
			configured_rules = [
				AlertRule(
					name="default_high_conf_action",
					severity="medium",
					action_labels=None,
					min_action_score=float(args.alert_min_score),
					min_consecutive_hits=int(args.alert_min_consecutive),
					cooldown_frames=int(args.alert_cooldown_frames),
					message_template="High-confidence action '{action_label}' detected for subject {stable_id}.",
				)
			]
		alert_engine = ActionAlertEngine(configured_rules)
		alert_notifier = AlertNotifier()

	def probe_and_query(raw_id: int, fallback_embedding: np.ndarray) -> Tuple[Deque[np.ndarray], np.ndarray]:
		probe = raw_probe_gallery[raw_id]
		if len(probe) <= 1:
			return probe, fallback_embedding
		query = np.mean(np.stack(list(probe), axis=0), axis=0).astype(np.float32)
		query = query / (np.linalg.norm(query) + 1e-5)
		return probe, query

	def best_reid_candidate(
		query_embedding: np.ndarray,
		active_ids: set,
		reserved_ids: set,
		exclude_sid: int = -1,
	) -> Tuple[int, float, float]:
		best_sid, best_sim, second_best = None, 0.0, 0.0
		for sid, gallery in stable_gallery.items():
			if sid == exclude_sid or sid in active_ids or sid in reserved_ids:
				continue
			if frame_idx - stable_last_seen.get(sid, -10**9) > args.reid_max_gap_frames:
				continue
			sim = embedding_mgr.max_similarity_to_gallery(query_embedding, gallery)
			if sim > best_sim:
				second_best, best_sim, best_sid = best_sim, sim, sid
			elif sim > second_best:
				second_best = sim
		return best_sid, best_sim, second_best

	def merge_stable_state(old_sid: int, new_sid: int) -> None:
		if old_sid in clip_buffers:
			clip_buffers[new_sid].extend(clip_buffers[old_sid])
			clip_buffers.pop(old_sid, None)
		if old_sid in pred_hist:
			pred_hist[new_sid].extend(pred_hist[old_sid])
			pred_hist.pop(old_sid, None)
		if old_sid in action_state and new_sid not in action_state:
			action_state[new_sid] = action_state[old_sid]
		action_state.pop(old_sid, None)
		if old_sid in stable_gallery:
			stable_gallery[new_sid].extend(stable_gallery[old_sid])
			stable_gallery.pop(old_sid, None)
		stable_last_seen.pop(old_sid, None)
		stable_birth_frame.pop(old_sid, None)

	def should_update_identity_memory(stable_id: int, fused_embedding: np.ndarray, det_conf: float, seg_ok: bool) -> bool:
		"""Allow memory updates only for reliable samples to avoid identity contamination."""
		if not seg_ok:
			return False
		if det_conf < args.memory_min_det_conf:
			return False
		fused_sim = embedding_mgr.fused_similarity_to_track(stable_id, fused_embedding)
		if fused_sim < args.memory_min_fused_similarity:
			return False
		return True

	cap = cv2.VideoCapture(args.input)
	if not cap.isOpened():
		raise RuntimeError(f"Could not open input video: {args.input}")

	fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
	frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
	frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

	if args.save_events_db:
		async_db_sink = AsyncDBEventSink(
			input_path=args.input,
			output_path=args.output,
			fps=float(fps),
			frame_width=frame_w,
			frame_height=frame_h,
			run_name=args.db_run_name,
			scene_context_topk=args.scene_context_topk,
		)

	writer = cv2.VideoWriter(
		args.output,
		cv2.VideoWriter_fourcc(*"mp4v"),
		fps,
		(frame_w, frame_h),
	)

	while True:
		ok, frame = cap.read()
		if not ok:
			break

		# Run scene segmentation on the configured frame.
		if frame_idx == scene_segmentation_frame_idx and scene_segmenter is not None:
			try:
				scene_segmentation_result = scene_segmenter.segment_scene(frame)
				scene_description = scene_segmenter.get_scene_description(scene_segmentation_result)
				print(f"Scene segmentation complete on frame {scene_segmentation_frame_idx}:")
				print(scene_description)
			except Exception as e:
				print(f"Error during scene segmentation: {e}")
				scene_segmentation_result = None

		active_stable_ids_this_frame = set()
		frame_person_count = 0

		results = detector.track(
			source=frame,
			persist=True,
			tracker=args.tracker,
			verbose=False,
		)
		boxes = results[0].boxes

		if boxes is not None and boxes.id is not None:
			xyxy = boxes.xyxy.cpu().numpy()
			class_ids = boxes.cls.int().cpu().numpy()
			track_ids = boxes.id.int().cpu().numpy()
			confs = boxes.conf.cpu().numpy()
			action_expand_scale = max(float(args.action_expand_scale), float(args.expand_scale))

			present_raw_ids = {int(tid) for tid in track_ids}
			reserved_stable_ids = {
				raw_to_stable[rid]
				for rid in present_raw_ids
				if rid in raw_to_stable
			}
			stable_owner_this_frame: Dict[int, int] = {}
			action_sample_frame = (frame_idx % args.infer_stride) == 0

			for box, cls_id, track_id, conf in zip(xyxy, class_ids, track_ids, confs):
				raw_track_id = int(track_id)
				obj_label = get_object_label(detector.names, int(cls_id))
				if cls_id != args.person_class_id:
					continue

				frame_person_count += 1

				raw_x1, raw_y1, raw_x2, raw_y2 = map(lambda v: int(round(float(v))), box)
				if raw_x1 > raw_x2:
					raw_x1, raw_x2 = raw_x2, raw_x1
				if raw_y1 > raw_y2:
					raw_y1, raw_y2 = raw_y2, raw_y1
				x1, y1, x2, y2 = expand_box(raw_x1, raw_y1, raw_x2, raw_y2, frame_w, frame_h, args.expand_scale)

				if (x2 - x1) < args.min_box_size or (y2 - y1) < args.min_box_size:
					continue

				if x1 >= x2 or y1 >= y2 or x1 < 0 or y1 < 0 or x2 > frame_w or y2 > frame_h:
					continue

				# Build scene context from segmentation map within 1.5x expanded bbox
				scene_context_local = []
				if scene_segmentation_result is not None:
					try:
						ctx_x1, ctx_y1, ctx_x2, ctx_y2 = expand_box(raw_x1, raw_y1, raw_x2, raw_y2, frame_w, frame_h, float(args.scene_context_expansion))
						seg_map = scene_segmentation_result.get("segmentation_map")
						if seg_map is not None and ctx_x2 > ctx_x1 and ctx_y2 > ctx_y1:
							sub = seg_map[ctx_y1:ctx_y2, ctx_x1:ctx_x2]
							if sub.size > 0:
								vals, counts = np.unique(sub, return_counts=True)
								order = np.argsort(-counts)
								topk = int(getattr(args, "scene_context_topk", 5))
								for idx in order[:topk]:
									cls_id = int(vals[idx])
									cnt = int(counts[idx])
									label = (
										scene_segmenter.label_names[cls_id]
										if (scene_segmenter is not None and cls_id < len(scene_segmenter.label_names))
										else f"class_{cls_id}"
									)
									pct = round(100.0 * cnt / float(sub.size), 2)
									scene_context_local.append({"class": label, "pixels": cnt, "pct": pct})
								# Optionally save the context crop image
								save_path = getattr(args, "scene_context_save_path", "")
								if save_path:
									try:
										os.makedirs(save_path, exist_ok=True)
										crop_img = frame[ctx_y1:ctx_y2, ctx_x1:ctx_x2]
										fname = f"frame{frame_idx}_raw{raw_track_id}.png"
										cv2.imwrite(os.path.join(save_path, fname), crop_img)
									except Exception:
										pass
					except Exception:
						# keep scene_context_local empty on any failure
						pass

				emb_crop = frame[y1:y2, x1:x2]
				if emb_crop.size == 0 or emb_crop.shape[0] < 10 or emb_crop.shape[1] < 10:
					continue

				action_crop: Optional[np.ndarray] = None
				if action_sample_frame:
					action_x1, action_y1, action_x2, action_y2 = expand_box(
						raw_x1,
						raw_y1,
						raw_x2,
						raw_y2,
						frame_w,
						frame_h,
						action_expand_scale,
					)

					if (action_x2 - action_x1) >= args.min_box_size and (action_y2 - action_y1) >= args.min_box_size:
						if (
							action_x1 < action_x2
							and action_y1 < action_y2
							and action_x1 >= 0
							and action_y1 >= 0
							and action_x2 <= frame_w
							and action_y2 <= frame_h
						):
							action_crop = frame[action_y1:action_y2, action_x1:action_x2]
							if action_crop.size == 0 or action_crop.shape[0] < 10 or action_crop.shape[1] < 10:
								action_crop = None

				mask_bin = None
				mask_ratio = 0.0
				if segmenter is not None:
					emb_crop, mask_bin, mask_ratio = apply_person_segmentation_mask(
						crop_bgr=emb_crop,
						segmenter=segmenter,
						person_class_id=args.person_class_id,
						seg_conf=args.seg_conf,
						mask_threshold=args.seg_mask_threshold,
						min_foreground_ratio=args.seg_min_foreground_ratio,
					)

				if args.visualize_seg_mask and mask_bin is not None:
					region = frame[y1:y2, x1:x2]
					if region.shape[:2] == mask_bin.shape[:2]:
						alpha_map = (mask_bin.astype(np.float32) * args.seg_overlay_alpha)[:, :, None]
						seg_color = np.zeros_like(region, dtype=np.float32)
						seg_color[:, :, 1] = 255.0
						blended = region.astype(np.float32) * (1.0 - alpha_map) + seg_color * alpha_map
						frame[y1:y2, x1:x2] = blended.astype(np.uint8)

				crop_rgb = cv2.cvtColor(emb_crop, cv2.COLOR_BGR2RGB)
				identity_update_ok = (segmenter is None) or (mask_ratio >= args.seg_min_foreground_ratio)

				region_embeddings = embedding_mgr.extract_region_embeddings(crop_rgb)
				_, _, _, _, fused_embedding = region_embeddings
				stable_id_event = "reused"
				reid_best_sim = None
				reid_second_best_sim = None

				if raw_track_id in raw_to_stable:
					stable_id = raw_to_stable[raw_track_id]

					owner = stable_owner_this_frame.get(stable_id)
					if owner is not None and owner != raw_track_id:
						stable_id = next_stable_id
						stable_birth_frame[stable_id] = frame_idx
						next_stable_id += 1
						raw_to_stable[raw_track_id] = stable_id
						stable_id_event = "owner_collision_new"

					probe = raw_probe_gallery[raw_track_id]
					stable_age = frame_idx - stable_birth_frame.get(stable_id, frame_idx)
					if (
						len(probe) >= args.reid_min_probe_frames
						and stable_age <= args.reid_tentative_max_age_frames
						and len(stable_gallery.get(stable_id, [])) <= args.reid_tentative_max_gallery
					):
						_, query_embedding = probe_and_query(raw_track_id, fused_embedding)
						best_sid, best_sim, second_best_sim = best_reid_candidate(
							query_embedding,
							active_stable_ids_this_frame,
							reserved_stable_ids,
							exclude_sid=stable_id,
						)
						reid_best_sim = float(best_sim)
						reid_second_best_sim = float(second_best_sim)

						if (
							best_sid is not None
							and best_sim >= args.reid_reassociate_threshold
							and (best_sim - second_best_sim) >= args.reid_margin_threshold
						):
							old_sid = stable_id
							stable_id = best_sid
							raw_to_stable[raw_track_id] = stable_id
							merge_stable_state(old_sid, stable_id)
							stable_id_event = "late_merge"
				else:
					probe, query_embedding = probe_and_query(raw_track_id, fused_embedding)
					best_sid, best_sim, second_best_sim = best_reid_candidate(
						query_embedding,
						active_stable_ids_this_frame,
						reserved_stable_ids,
					)
					reid_best_sim = float(best_sim)
					reid_second_best_sim = float(second_best_sim)

					match_margin = best_sim - second_best_sim
					if (
						best_sid is not None
						and best_sim >= args.reid_reassociate_threshold
						and match_margin >= args.reid_margin_threshold
						and len(probe) >= args.reid_min_probe_frames
					):
						stable_id = best_sid
						stable_id_event = "reassociated"
					else:
						stable_id = next_stable_id
						stable_birth_frame[stable_id] = frame_idx
						next_stable_id += 1
						stable_id_event = "new"

					raw_to_stable[raw_track_id] = stable_id

				memory_update_ok = should_update_identity_memory(stable_id, fused_embedding, float(conf), identity_update_ok)

				active_stable_ids_this_frame.add(stable_id)
				stable_owner_this_frame[stable_id] = raw_track_id
				if memory_update_ok:
					raw_probe_gallery[raw_track_id].append(fused_embedding)
					stable_last_seen[stable_id] = frame_idx
					stable_gallery[stable_id].append(fused_embedding)

				embedding_mgr.check_embedding_consistency(
					stable_id,
					crop_rgb,
					debug=False,
					region_embeddings=region_embeddings,
				)

				if memory_update_ok:
					embedding_mgr.store_embedding(
						stable_id,
						crop_rgb,
						frame_idx,
						float(conf),
						region_embeddings=region_embeddings,
					)

				if action_crop is not None:
					action_crop = cv2.resize(
						action_crop,
						(args.track_crop_size, args.track_crop_size),
						interpolation=(
							cv2.INTER_LINEAR
							if action_crop.shape[0] >= args.track_crop_size
							else cv2.INTER_CUBIC
						),
					)

					clip_buffers[stable_id].append(action_crop)

				if action_sample_frame and len(clip_buffers[stable_id]) == args.clip_len:
					pred_idx, pred_score = recognizer.infer(list(clip_buffers[stable_id]))
					
					# Validate prediction index
					if pred_idx < 0 or pred_idx >= expected_num_classes:
						print(f"Warning: Invalid prediction index {pred_idx} for stable_id {stable_id}. "
							  f"Model expects {expected_num_classes} classes. Using 'unknown'.")
						pred_label = "unknown"
					else:
						pred_label = label_map.get(pred_idx, f"class_{pred_idx}")
					
					pred_hist[stable_id].append(pred_label)
					smooth_label = Counter(pred_hist[stable_id]).most_common(1)[0][0]
					action_state[stable_id] = ActionState(label=smooth_label, score=pred_score)

				if stable_id in action_state:
					state = action_state[stable_id]
					action_label = state.label
					action_score = float(state.score)
				else:
					action_label = "pending"
					action_score = 0.0

				event_payload = {
					"frame_idx": frame_idx,
					"timestamp_s": round(frame_idx / max(fps, 1e-6), 3),
					"raw_track_id": raw_track_id,
					"stable_id": int(stable_id),
					"stable_id_event": stable_id_event,
					"object_label": obj_label,
					"det_conf": round(float(conf), 4),
					"bbox_xyxy": [int(x1), int(y1), int(x2), int(y2)],
					"mask_ratio": round(float(mask_ratio), 4),
					"scene_context": [],
					"identity_update_ok": bool(identity_update_ok),
					"memory_update_ok": bool(memory_update_ok),
					"action_label": action_label,
					"action_score": round(float(action_score), 4),
					"reid_best_sim": None if reid_best_sim is None else round(float(reid_best_sim), 4),
					"reid_second_best_sim": None if reid_second_best_sim is None else round(float(reid_second_best_sim), 4),
				}

				if async_event_logger is not None:
					# Attach scene context collected earlier (if any)
					event_payload["scene_context"] = scene_context_local if 'scene_context_local' in locals() else []
					async_event_logger.log_track(event_payload)
				if async_db_sink is not None:
					async_db_sink.add_track_event(event_payload)

				if alert_engine is not None and alert_engine.has_rules:
					generated_alerts = alert_engine.process_track_event(event_payload)
					for alert in generated_alerts:
						alert_payload = {
							"rule_name": alert.rule_name,
							"severity": alert.severity,
							"stable_id": alert.stable_id,
							"action_label": alert.action_label,
							"action_score": round(float(alert.action_score), 4),
							"frame_idx": alert.frame_idx,
							"timestamp_s": round(float(alert.timestamp_s), 3),
							"message": alert.message,
							"metadata": alert.metadata,
						}
						if async_event_logger is not None:
							async_event_logger.log_alert(alert_payload)
						if async_db_sink is not None:
							async_db_sink.add_alert(alert_payload)
						if alert_notifier is not None and alert_notifier.is_active:
							run_id = async_db_sink.run_id if async_db_sink else ""
							alert_notifier.notify(alert_payload, run_id=run_id)

				label_text = f"{obj_label} | {action_label} ({action_score:.2f})"
				draw_modern_box(frame, x1, y1, x2, y2)
				draw_label_badge(frame, x1, y1, label_text)

		# Apply scene segmentation visualization on the configured frame if enabled.
		output_frame = frame.copy()
		if frame_idx == scene_segmentation_frame_idx and args.visualize_scene_segmentation and scene_segmentation_result is not None:
			try:
				output_frame = scene_segmenter.visualize_segmentation(scene_segmentation_result, frame, alpha=0.7)
				print(f"Scene segmentation visualization applied to frame {scene_segmentation_frame_idx}")
			except Exception as e:
				print(f"Error applying scene visualization: {e}")

		writer.write(output_frame)
		if async_event_logger is not None and args.event_log_frames:
			async_event_logger.log_frame(
				frame_idx=frame_idx,
				timestamp_s=frame_idx / max(fps, 1e-6),
				active_track_count=len(active_stable_ids_this_frame),
				tracked_person_count=frame_person_count,
			)
		frame_idx += 1

	cap.release()
	writer.release()
	if async_db_sink is not None:
		async_db_sink.finalize(total_frames=frame_idx)
		print(f"Saved deduplicated events to DB run_id: {async_db_sink.run_id}")
	if async_event_logger is not None:
		async_event_logger.close()
		print(f"Saved event log to: {args.event_log_path}")
	print(f"Saved output to: {args.output}")
