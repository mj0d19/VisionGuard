from typing import Tuple


def expand_box(
	x1: int,
	y1: int,
	x2: int,
	y2: int,
	frame_w: int,
	frame_h: int,
	scale: float = 1.2,
) -> Tuple[int, int, int, int]:
	box_w = x2 - x1
	box_h = y2 - y1
	cx = x1 + box_w / 2.0
	cy = y1 + box_h / 2.0
	new_w = box_w * scale
	new_h = box_h * scale

	nx1 = int(max(0, cx - new_w / 2.0))
	ny1 = int(max(0, cy - new_h / 2.0))
	nx2 = int(min(frame_w, cx + new_w / 2.0))
	ny2 = int(min(frame_h, cy + new_h / 2.0))
	return nx1, ny1, nx2, ny2


def get_object_label(names: object, class_id: int) -> str:
	if isinstance(names, dict):
		return str(names.get(class_id, class_id))
	if isinstance(names, list) and 0 <= class_id < len(names):
		return str(names[class_id])
	return str(class_id)
