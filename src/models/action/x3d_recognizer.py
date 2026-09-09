import argparse
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from pytorchvideo.models.hub import x3d_l, x3d_m, x3d_s, x3d_xs


class X3DRecognizer:
	def __init__(self, device: str, num_frames: int, side_size: int, crop_size: int, model_name: str):
		self.device = device if torch.cuda.is_available() and device.startswith("cuda") else "cpu"
		self.num_frames = num_frames
		self.side_size = side_size
		self.crop_size = crop_size
		self.model_name = model_name
		self.mean = torch.tensor([0.45, 0.45, 0.45]).view(3, 1, 1, 1)
		self.std = torch.tensor([0.225, 0.225, 0.225]).view(3, 1, 1, 1)

		builders = {
			"x3d_xs": x3d_xs,
			"x3d_s": x3d_s,
			"x3d_m": x3d_m,
			"x3d_l": x3d_l,
			"x3d_custom": x3d_l,
		}
		if model_name not in builders:
			raise ValueError(f"Unsupported action model: {model_name}. Choose from: {list(builders.keys())}")

		if model_name == "x3d_custom":
			# Custom model path: initialize X3D-L backbone and load project checkpoint.
			self.expected_num_classes = 21
			self.model = builders[model_name](pretrained=False, model_num_class=self.expected_num_classes).to(self.device).eval()
			model_path = Path(__file__).parent.parent.parent.parent / "weights" / "X3D.pth"
			if not model_path.exists():
				raise FileNotFoundError(f"Model weights not found at {model_path}")

			checkpoint = torch.load(model_path, map_location=self.device)
			state_dict = _extract_state_dict(checkpoint)
			if not isinstance(state_dict, dict):
				raise ValueError("Invalid checkpoint format in weights/X3D.pth")

			# Handle checkpoints saved from DataParallel/DistributedDataParallel.
			if state_dict and all(k.startswith("module.") for k in state_dict.keys()):
				state_dict = {k[len("module."):]: v for k, v in state_dict.items()}

			try:
				self.model.load_state_dict(state_dict, strict=True)
			except RuntimeError as exc:
				missing, unexpected = self.model.load_state_dict(state_dict, strict=False)
				print(
					"Warning: custom model loaded with non-strict matching "
					f"(missing={len(missing)}, unexpected={len(unexpected)}): {exc}"
				)
		else:
			# Standard PyTorchVideo models.
			self.expected_num_classes = 400
			self.model = builders[model_name](pretrained=True).to(self.device).eval()

	def uniform_temporal_subsample(self, video: torch.Tensor) -> torch.Tensor:
		# video: [C, T, H, W]
		t = video.shape[1]
		if t == self.num_frames:
			return video
		idx = torch.linspace(0, max(t - 1, 0), self.num_frames).long()
		return video[:, idx, :, :]

	def short_side_scale(self, video: torch.Tensor) -> torch.Tensor:
		# video: [C, T, H, W]
		_, _, h, w = video.shape
		if h == 0 or w == 0:
			return video
		if h < w:
			new_h = self.side_size
			new_w = int(w * self.side_size / h)
		else:
			new_w = self.side_size
			new_h = int(h * self.side_size / w)

		# Interpolate expects [N, C, H, W], so treat time as batch.
		video_btchw = video.permute(1, 0, 2, 3)
		video_btchw = F.interpolate(
			video_btchw,
			size=(new_h, new_w),
			mode="bilinear",
			align_corners=False,
		)
		return video_btchw.permute(1, 0, 2, 3)

	@staticmethod
	def center_crop_video(video: torch.Tensor, out_h: int, out_w: int) -> torch.Tensor:
		_, _, h, w = video.shape
		top = max((h - out_h) // 2, 0)
		left = max((w - out_w) // 2, 0)
		return video[:, :, top : top + out_h, left : left + out_w]

	def preprocess(self, frames_bgr: List[np.ndarray]) -> torch.Tensor:
		rgb_frames = [cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) for frame in frames_bgr]
		np_video = np.stack(rgb_frames, axis=0)  # [T, H, W, C]
		tensor_video = torch.from_numpy(np_video).permute(3, 0, 1, 2).float()  # [C, T, H, W]
		tensor_video = self.uniform_temporal_subsample(tensor_video)
		tensor_video = tensor_video / 255.0
		tensor_video = (tensor_video - self.mean) / self.std
		tensor_video = self.short_side_scale(tensor_video)
		tensor_video = self.center_crop_video(tensor_video, self.crop_size, self.crop_size)
		tensor_video = tensor_video.unsqueeze(0)  # [1, C, T, H, W]
		return tensor_video.to(self.device)

	@torch.no_grad()
	def infer(self, frames_bgr: List[np.ndarray]) -> Tuple[int, float]:
		clip = self.preprocess(frames_bgr)
		logits = self.model(clip)
		
		# Validate logits shape for the selected model.
		if logits.shape[-1] != self.expected_num_classes:
			raise ValueError(
				f"Model output has {logits.shape[-1]} classes, expected {self.expected_num_classes}."
			)
		
		probs = torch.softmax(logits, dim=1)
		score, class_idx = torch.max(probs, dim=1)
		class_idx_int = int(class_idx.item())
		score_float = float(score.item())
		
		# Validate output range
		if not (0 <= class_idx_int < self.expected_num_classes):
			raise ValueError(
				f"Predicted class index {class_idx_int} is out of range [0, {self.expected_num_classes - 1}]"
			)
		
		return class_idx_int, score_float


def _extract_state_dict(checkpoint: object) -> Dict[str, torch.Tensor]:
	if not isinstance(checkpoint, dict):
		raise ValueError("Checkpoint must be a dictionary")

	for key in ("model_state_dict", "state_dict"):
		value = checkpoint.get(key)
		if isinstance(value, dict):
			return value

	if all(isinstance(k, str) for k in checkpoint.keys()):
		return checkpoint

	raise ValueError("Unable to locate model state dict in checkpoint")


def _get_default_action_label_map() -> Dict[int, str]:
	"""Return default action label map with 21 custom classes."""
	return {
		0: "Vandalism",
		1: "Stealing",
		2: "Shoplifting",
		3: "Shooting",
		4: "Robbery",
		5: "Roadaccidents",
		6: "Normal",
		7: "Walking",
		8: "Walking_While_Using_Phone",
		9: "Walking_While_Reading_Book",
		10: "Standing_Still",
		11: "Sitting",
		12: "Fighting",
		13: "Explosion",
		14: "Meet_and_Split",
		15: "Burglary",
		16: "Clapping",
		17: "Assault",
		18: "Arson",
		19: "Arrest",
		20: "Abuse",
	}


def load_action_label_map(label_map_path: str, num_classes: int = 21) -> Dict[int, str]:
	default_map = _get_default_action_label_map()
	path = Path(label_map_path)
	if not path.is_file():
		print(f"Warning: label map file not found: {label_map_path}. Using default action classes.")
		return default_map

	labels = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
	if not labels:
		print(f"Warning: label map is empty: {label_map_path}. Using default action classes.")
		return default_map

	return {i: labels[i] if i < len(labels) else f"class_{i}" for i in range(num_classes)}


def apply_action_model_presets(args: argparse.Namespace) -> None:
	presets = {
		"x3d_l": {"clip_len": 16, "side_size": 356, "crop_size": 312},
		"x3d_custom": {"clip_len": 16, "side_size": 356, "crop_size": 312},
	}
	preset = presets.get(args.action_model)
	if preset is None:
		return

	adjustments: List[str] = []
	for key, min_value in preset.items():
		current_value = getattr(args, key)
		if current_value < min_value:
			setattr(args, key, min_value)
			adjustments.append(f"{key}={min_value}")

	if args.track_crop_size < args.side_size:
		args.track_crop_size = args.side_size
		adjustments.append(f"track_crop_size={args.track_crop_size}")

	if adjustments:
		print(
			"Info: auto-adjusted action input settings for "
			f"{args.action_model}: {', '.join(adjustments)}"
		)
