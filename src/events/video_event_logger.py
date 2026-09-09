import json
from pathlib import Path
from typing import Any, Dict, Optional


class VideoEventLogger:
	"""Write structured pipeline events to a JSONL file."""

	def __init__(self, path: str, flush_every: int = 100):
		if not path:
			raise ValueError("Log path must be non-empty when logger is enabled")
		self.path = Path(path)
		self.path.parent.mkdir(parents=True, exist_ok=True)
		self.flush_every = max(1, int(flush_every))
		self._line_count = 0
		self._fh = self.path.open("w", encoding="utf-8")

	def log(self, event: Dict[str, Any]) -> None:
		self._fh.write(json.dumps(event, ensure_ascii=True) + "\n")
		self._line_count += 1
		if self._line_count % self.flush_every == 0:
			self._fh.flush()

	def log_frame(
		self,
		frame_idx: int,
		timestamp_s: float,
		active_track_count: int,
		tracked_person_count: int,
	) -> None:
		self.log(
			{
				"event": "frame",
				"frame_idx": frame_idx,
				"timestamp_s": round(timestamp_s, 3),
				"active_track_count": int(active_track_count),
				"tracked_person_count": int(tracked_person_count),
			}
		)

	def log_track(self, payload: Dict[str, Any]) -> None:
		event = {"event": "track"}
		event.update(payload)
		self.log(event)

	def log_alert(self, payload: Dict[str, Any]) -> None:
		event = {"event": "alert"}
		event.update(payload)
		self.log(event)

	def close(self) -> None:
		if self._fh and not self._fh.closed:
			self._fh.flush()
			self._fh.close()

	def __enter__(self) -> "VideoEventLogger":
		return self

	def __exit__(self, exc_type, exc, tb) -> Optional[bool]:
		self.close()
		return None
