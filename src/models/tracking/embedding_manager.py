from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, Tuple

import cv2
import numpy as np
import torch
from scipy.spatial.distance import cosine
from ultralytics import YOLO


@dataclass
class TrackEmbedding:
	"""Store appearance embeddings for a tracked person."""
	track_id: int
	crop_rgb: np.ndarray
	embedding_full: np.ndarray
	embedding_head: np.ndarray
	embedding_middle: np.ndarray
	embedding_lower: np.ndarray
	embedding_fused: np.ndarray
	frame_idx: int
	confidence: float


class EmbeddingManager:
	"""Extract and store ReID embeddings for track consistency."""

	def __init__(self, device: str = "cuda:0", sim_threshold: float = 0.3):
		self.device = device if torch.cuda.is_available() and device.startswith("cuda") else "cpu"
		self.track_embeddings: Dict[int, Deque[TrackEmbedding]] = defaultdict(lambda: deque(maxlen=5))
		self.embedding_sim_threshold = sim_threshold

		try:
			self.head_detector = YOLO("yolov8n.pt")
			self.head_detector_available = True
		except Exception as e:
			print(f"Warning: Head detector not available: {e}")
			self.head_detector_available = False

	def extract_embedding(self, crop_rgb: np.ndarray) -> np.ndarray:
		"""Extract histogram-based embedding from a crop."""
		crop_resized = cv2.resize(crop_rgb, (64, 128))
		hist_b = cv2.calcHist([crop_resized], [0], None, [16], [0, 256])
		hist_g = cv2.calcHist([crop_resized], [1], None, [16], [0, 256])
		hist_r = cv2.calcHist([crop_resized], [2], None, [16], [0, 256])

		embedding = np.concatenate([hist_b.flatten(), hist_g.flatten(), hist_r.flatten()]).astype(np.float32)
		embedding = embedding / (np.linalg.norm(embedding) + 1e-5)
		return embedding

	@staticmethod
	def fuse_embeddings(
		embedding_full: np.ndarray,
		embedding_head: np.ndarray,
		embedding_middle: np.ndarray,
		embedding_lower: np.ndarray,
	) -> np.ndarray:
		"""Fuse region embeddings into one normalized vector for cross-track matching."""
		fused = np.concatenate([embedding_full, embedding_head, embedding_middle, embedding_lower]).astype(np.float32)
		fused = fused / (np.linalg.norm(fused) + 1e-5)
		return fused

	def extract_head_region(self, crop_rgb: np.ndarray) -> np.ndarray:
		"""Detect head using YOLO, with intelligent fallback if detection fails."""
		h, w = crop_rgb.shape[:2]

		if self.head_detector_available:
			try:
				results = self.head_detector(crop_rgb, conf=0.3, verbose=False)

				if results and len(results) > 0 and results[0].boxes is not None:
					boxes = results[0].boxes
					head_boxes = []
					for box in boxes:
						x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
						conf_val = box.conf.item()
						box_h = y2 - y1
						box_y_center = (y1 + y2) / 2
						if box_y_center < h * 0.5 and box_h > 15:
							head_boxes.append((x1, y1, x2, y2, conf_val))

					if head_boxes:
						x1, y1, x2, y2, _ = max(head_boxes, key=lambda b: b[4])
						x1 = max(0, x1 - 5)
						y1 = max(0, y1 - 10)
						x2 = min(w, x2 + 5)
						y2 = min(h, y2 + 5)

						head_crop = crop_rgb[y1:y2, x1:x2, :]
						if head_crop.size > 0 and head_crop.shape[0] > 10:
							return head_crop
			except Exception:
				pass

		aspect_ratio = h / (w + 1e-5)
		if aspect_ratio > 2.0:
			head_height = int(h * 0.20)
		elif aspect_ratio > 1.2:
			head_height = int(h * 0.25)
		else:
			head_height = int(h * 0.30)

		head_crop = crop_rgb[:head_height, :]
		return head_crop if head_crop.size > 0 else crop_rgb

	def extract_middle_region(self, crop_rgb: np.ndarray) -> np.ndarray:
		"""Extract middle body region (torso/arms area)."""
		h, _ = crop_rgb.shape[:2]
		middle_start = int(h * 0.25)
		middle_end = int(h * 0.65)
		middle_crop = crop_rgb[middle_start:middle_end, :]
		return middle_crop if middle_crop.size > 0 else crop_rgb

	def extract_lower_region(self, crop_rgb: np.ndarray) -> np.ndarray:
		"""Extract lower body region (legs/feet area)."""
		h, _ = crop_rgb.shape[:2]
		lower_start = int(h * 0.60)
		lower_crop = crop_rgb[lower_start:, :]
		return lower_crop if lower_crop.size > 0 else crop_rgb

	def extract_region_embeddings(
		self, crop_rgb: np.ndarray
	) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
		"""Extract full/head/middle/lower embeddings and a fused embedding."""
		embedding_full = self.extract_embedding(crop_rgb)
		head_crop = self.extract_head_region(crop_rgb)
		embedding_head = self.extract_embedding(head_crop)
		middle_crop = self.extract_middle_region(crop_rgb)
		embedding_middle = self.extract_embedding(middle_crop)
		lower_crop = self.extract_lower_region(crop_rgb)
		embedding_lower = self.extract_embedding(lower_crop)
		fused = self.fuse_embeddings(embedding_full, embedding_head, embedding_middle, embedding_lower)
		return embedding_full, embedding_head, embedding_middle, embedding_lower, fused

	def store_embedding(
		self,
		track_id: int,
		crop_rgb: np.ndarray,
		frame_idx: int,
		confidence: float,
		region_embeddings: Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray] = None,
	):
		"""Store 4-part embeddings (full, head, middle, lower) for a track."""
		if region_embeddings is None:
			embedding_full, embedding_head, embedding_middle, embedding_lower, embedding_fused = self.extract_region_embeddings(crop_rgb)
		else:
			embedding_full, embedding_head, embedding_middle, embedding_lower, embedding_fused = region_embeddings
		track_emb = TrackEmbedding(
			track_id=track_id,
			crop_rgb=crop_rgb,
			embedding_full=embedding_full,
			embedding_head=embedding_head,
			embedding_middle=embedding_middle,
			embedding_lower=embedding_lower,
			embedding_fused=embedding_fused,
			frame_idx=frame_idx,
			confidence=confidence,
		)
		self.track_embeddings[track_id].append(track_emb)

	def fused_similarity_to_track(self, track_id: int, fused_embedding: np.ndarray) -> float:
		"""Maximum fused-embedding cosine similarity against stored samples for this track."""
		history = self.track_embeddings.get(track_id)
		if not history:
			return 1.0
		return max(1.0 - cosine(fused_embedding, item.embedding_fused) for item in history)

	def check_embedding_consistency(
		self,
		track_id: int,
		crop_rgb: np.ndarray,
		debug: bool = False,
		region_embeddings: Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray] = None,
	) -> Tuple[bool, float]:
		"""Check if crop matches stored embeddings using 4 vectors (full, head, middle, lower).
		Returns (is_consistent, best_similarity)."""
		if track_id not in self.track_embeddings or len(self.track_embeddings[track_id]) == 0:
			return True, 1.0

		if region_embeddings is None:
			current_full, current_head, current_middle, current_lower, _ = self.extract_region_embeddings(crop_rgb)
		else:
			current_full, current_head, current_middle, current_lower, _ = region_embeddings

		best_similarity = 0.0
		for stored in self.track_embeddings[track_id]:
			sim_full = 1.0 - cosine(current_full, stored.embedding_full)
			sim_head = 1.0 - cosine(current_head, stored.embedding_head)
			sim_middle = 1.0 - cosine(current_middle, stored.embedding_middle)
			sim_lower = 1.0 - cosine(current_lower, stored.embedding_lower)

			sim = max(sim_full, sim_head, sim_middle, sim_lower)
			best_similarity = max(best_similarity, sim)

		is_consistent = best_similarity >= self.embedding_sim_threshold

		if debug and not is_consistent:
			print(f"  [EMBEDDING] Track {track_id}: similarity={best_similarity:.3f} (threshold={self.embedding_sim_threshold:.2f})")

		return is_consistent, best_similarity

	@staticmethod
	def max_similarity_to_gallery(query_embedding: np.ndarray, gallery: Deque[np.ndarray]) -> float:
		"""Return max cosine similarity between query and gallery embeddings."""
		if not gallery:
			return 0.0
		return max(1.0 - cosine(query_embedding, candidate) for candidate in gallery)
