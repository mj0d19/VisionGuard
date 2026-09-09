from typing import Tuple

import cv2
import numpy as np
from ultralytics import YOLO


def apply_person_segmentation_mask(
	crop_bgr: np.ndarray,
	segmenter: YOLO,
	person_class_id: int,
	seg_conf: float,
	mask_threshold: float,
	min_foreground_ratio: float,
) -> Tuple[np.ndarray, np.ndarray, float]:
	"""Apply person mask to crop; returns original crop when no valid mask is found."""
	if crop_bgr.size == 0 or crop_bgr.shape[0] < 20 or crop_bgr.shape[1] < 20:
		return crop_bgr, None, 0.0

	try:
		results = segmenter.predict(source=crop_bgr, conf=seg_conf, verbose=False)
		if not results:
			return crop_bgr, None, 0.0

		res = results[0]
		if res.masks is None or res.boxes is None or len(res.boxes) == 0:
			return crop_bgr, None, 0.0

		classes = res.boxes.cls.int().cpu().numpy()
		confs = res.boxes.conf.cpu().numpy()
		masks = res.masks.data

		best_idx = -1
		best_conf = -1.0
		for i, cls_id in enumerate(classes):
			if int(cls_id) != person_class_id:
				continue
			if confs[i] > best_conf:
				best_conf = float(confs[i])
				best_idx = i

		if best_idx < 0:
			return crop_bgr, None, 0.0

		mask = masks[best_idx].cpu().numpy()
		if mask.shape[:2] != crop_bgr.shape[:2]:
			mask = cv2.resize(mask, (crop_bgr.shape[1], crop_bgr.shape[0]), interpolation=cv2.INTER_NEAREST)

		mask_bin = (mask > mask_threshold).astype(np.uint8)
		if mask_bin.sum() < 20:
			return crop_bgr, None, 0.0

		foreground_ratio = float(mask_bin.sum()) / float(mask_bin.shape[0] * mask_bin.shape[1] + 1e-5)
		if foreground_ratio < min_foreground_ratio:
			return crop_bgr, mask_bin, foreground_ratio

		masked = crop_bgr.copy()
		masked[mask_bin == 0] = 0
		return masked, mask_bin, foreground_ratio
	except Exception:
		return crop_bgr, None, 0.0
