"""
Semantic scene segmentation using Segformer model.
Provides scene context for person detection and action recognition.
"""

from typing import Optional, Tuple

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor


class SceneSegmentationEngine:
	"""Handles semantic scene segmentation using Segformer model."""

	def __init__(self, device: str = "cuda:0", model_name: str = "nvidia/segformer-b0-finetuned-ade-512-512"):
		"""
		Initialize the semantic segmentation engine.

		Args:
			device: Device to run model on (e.g., "cuda:0", "cpu")
			model_name: HuggingFace model identifier for Segformer
		"""
		self.device = device
		self.model_name = model_name

		# Load processor and model
		try:
			self.processor = SegformerImageProcessor.from_pretrained(model_name)
			self.model = SegformerForSemanticSegmentation.from_pretrained(model_name)
			self.model = self.model.to(device)
			self.model.eval()

			# Get number of labels from model config
			self.num_labels = self.model.config.num_labels
			# Create label map (ADE20K uses 150 labels, from index 1 to 150)
			self._setup_label_map()
		except Exception as e:
			raise RuntimeError(f"Failed to load Segformer model '{model_name}': {e}")

	def _setup_label_map(self) -> None:
		"""Setup semantic segmentation label names for ADE20K dataset."""
		# Complete ADE20K class names (150 classes)
		# Index 0 is background/unknown, indices 1-150 are actual classes
		ade20k_labels = [
            "wall",
            "building",
            "sky",
            "floor",
            "tree",
            "ceiling",
            "road",
            "bed",
            "windowpane",
            "grass",
            "cabinet",
            "sidewalk",
            "person",
            "earth",
            "door",
            "table",
            "mountain",
            "plant",
            "curtain",
            "chair",
            "car",
            "water",
            "painting",
            "sofa",
            "shelf",
            "house",
            "sea",
            "mirror",
            "rug",
            "field",
            "armchair",
            "seat",
            "fence",
            "desk",
            "rock",
            "wardrobe",
            "lamp",
            "bathtub",
            "railing",
            "cushion",
            "base",
            "box",
            "column",
            "signboard",
            "chest of drawers",
            "counter",
            "sand",
            "sink",
            "skyscraper",
            "fireplace",
            "refrigerator",
            "grandstand",
            "path",
            "stairs",
            "runway",
            "case",
            "pool table",
            "pillow",
            "screen door",
            "stairway",
            "river",
            "bridge",
            "bookcase",
            "blind",
            "coffee table",
            "toilet",
            "flower",
            "book",
            "hill",
            "bench",
            "countertop",
            "stove",
            "palm",
            "kitchen island",
            "computer",
            "swivel chair",
            "boat",
            "bar",
            "arcade machine",
            "hovel",
            "bus",
            "towel",
            "light",
            "truck",
            "tower",
            "chandelier",
            "awning",
            "streetlight",
            "booth",
            "television",
            "airplane",
            "dirt track",
            "apparel",
            "pole",
            "land",
            "bannister",
            "escalator",
            "ottoman",
            "bottle",
            "buffet",
            "poster",
            "stage",
            "van",
            "ship",
            "fountain",
            "conveyor belt",
            "canopy",
            "washer",
            "plaything",
            "swimming pool",
            "stool",
            "barrel",
            "basket",
            "waterfall",
            "tent",
            "bag",
            "minibike",
            "cradle",
            "oven",
            "ball",
            "food",
            "step",
            "tank",
            "trade name",
            "microwave",
            "pot",
            "animal",
            "bicycle",
            "lake",
            "dishwasher",
            "screen",
            "blanket",
            "sculpture",
            "hood",
            "sconce",
            "vase",
            "traffic light",
            "tray",
            "ashcan",
            "fan",
            "pier",
            "crt screen",
            "plate",
            "monitor",
            "bulletin board",
            "shower",
            "radiator",
            "glass",
            "clock",
            "flag"
        ]
		
		# Ensure we have exactly 150 labels (or pad/trim as needed)
		if len(ade20k_labels) < self.num_labels:
			# Pad with generic class names if needed
			for i in range(len(ade20k_labels), self.num_labels):
				ade20k_labels.append(f"class_{i}")
		elif len(ade20k_labels) > self.num_labels:
			# Trim to match model's expected number of labels
			ade20k_labels = ade20k_labels[:self.num_labels]
		
		self.label_names = ade20k_labels

	def segment_scene(self, frame_bgr: np.ndarray) -> dict:
		"""
		Segment the scene in a frame.

		Args:
			frame_bgr: Input frame in BGR format (HxWx3)

		Returns:
			Dictionary containing:
				- segmentation_map: Semantic segmentation map (HxW) with class indices
				- confidence_map: Confidence scores for each class
				- class_names: List of detected class names
				- label_counts: Count of pixels for each detected class
				- processed_shape: Shape of the original frame
		"""
		if frame_bgr.size == 0:
			raise ValueError("Empty frame provided")

		try:
			# Convert BGR to RGB for PIL
			frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
			image = Image.fromarray(frame_rgb)

			# Process image and get predictions
			with torch.no_grad():
				inputs = self.processor(images=image, return_tensors="pt")
				inputs = {k: v.to(self.device) for k, v in inputs.items()}
				outputs = self.model(**inputs)

			# Get logits and upsample to original image size
			logits = outputs.logits  # (1, num_labels, H/4, W/4)
			upsampled_logits = torch.nn.functional.interpolate(
				logits,
				size=frame_rgb.shape[:2],
				mode="bilinear",
				align_corners=False,
			)

			# Get predicted class and confidence for each pixel
			segmentation_map = upsampled_logits.argmax(dim=1)[0].cpu().numpy()
			confidence_scores = torch.nn.functional.softmax(upsampled_logits, dim=1)
			max_confidence = confidence_scores.max(dim=1)[0][0].cpu().numpy()

			# Get unique classes and their names
			unique_classes = np.unique(segmentation_map)
			class_names = []
			for cls_idx in unique_classes:
				cls_id = int(cls_idx)
				if cls_id < len(self.label_names):
					class_names.append(self.label_names[cls_id])
				else:
					class_names.append(f"class_{cls_id}")

			# Count pixels for each class
			label_counts = {}
			for cls_idx in unique_classes:
				cls_id = int(cls_idx)
				count = int((segmentation_map == cls_idx).sum())
				label_name = self.label_names[cls_id] if cls_id < len(self.label_names) else f"class_{cls_id}"
				label_counts[label_name] = count

			return {
				"segmentation_map": segmentation_map,
				"confidence_map": max_confidence,
				"class_names": class_names,
				"label_counts": label_counts,
				"processed_shape": frame_bgr.shape[:2],
			}
		except Exception as e:
			raise RuntimeError(f"Scene segmentation failed: {e}")

	def visualize_segmentation(
		self,
		segmentation_result: dict,
		frame_bgr: np.ndarray,
		alpha: float = 0.5,
	) -> np.ndarray:
		"""
		Visualize semantic segmentation on the frame.

		Args:
			segmentation_result: Output from segment_scene()
			frame_bgr: Original frame
			alpha: Overlay transparency (0-1), higher = more segmentation visible

		Returns:
			Annotated frame with segmentation overlay
		"""
		segmentation_map = segmentation_result["segmentation_map"]
		frame_h, frame_w = frame_bgr.shape[:2]

		# Create color map for visualization
		colormap = self._get_colormap()
		
		# Create colored segmentation image
		colored_seg = np.zeros((frame_h, frame_w, 3), dtype=np.uint8)
		
		# Map each pixel to its class color
		for class_idx in range(self.num_labels):
			mask = (segmentation_map == class_idx)
			if np.any(mask):
				color = colormap[class_idx]
				colored_seg[mask] = color

		# Blend with original frame
		result = cv2.addWeighted(
			frame_bgr,
			1 - alpha,
			colored_seg,
			alpha,
			0,
		)

		# Add legend with detected classes
		class_names = segmentation_result["class_names"]
		label_counts = segmentation_result["label_counts"]

		# Add text overlay with detected classes
		y_offset = 30
		font = cv2.FONT_HERSHEY_SIMPLEX
		font_scale = 0.5
		thickness = 1
		
		# Sort labels by pixel count (descending) and display top classes by percentage
		sorted_labels = sorted(label_counts.items(), key=lambda x: x[1], reverse=True)
		total_pixels = segmentation_map.shape[0] * segmentation_map.shape[1]
		for i, (label_name, count) in enumerate(sorted_labels[:8]):  # Show top 8 classes by percentage
			percentage = (count / total_pixels) * 100 if total_pixels > 0 else 0
			text = f"{label_name}: {percentage:.1f}%"
			
			text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
			text_y = y_offset + i * 25
			
			# Draw semi-transparent background for text
			overlay = result.copy()
			cv2.rectangle(overlay, (5, text_y - 15), (15 + text_size[0], text_y + 5), (0, 0, 0), -1)
			cv2.addWeighted(overlay, 0.7, result, 0.3, 0, result)
			
			# Draw text in white
			cv2.putText(result, text, (10, text_y), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

		return result

	def _get_colormap(self) -> np.ndarray:
		"""Generate a colormap for semantic segmentation visualization."""
		# Create a colormap with distinct colors for each class
		colors = np.zeros((self.num_labels, 3), dtype=np.uint8)
		
		# Use a pre-defined palette for better color separation
		# Map: define vibrant colors for common classes first
		palette = [
			(0, 0, 0),        # 0: unknown (black)
			(255, 0, 0),      # 1: wall (red)
			(0, 255, 0),      # 2: building (green)
			(0, 0, 255),      # 3: sky (blue)
			(255, 255, 0),    # 4: floor (yellow)
			(0, 255, 255),    # 5: tree (cyan)
			(255, 0, 255),    # 6: ceiling (magenta)
			(255, 128, 0),    # 7: road (orange)
			(128, 0, 255),    # 8: bed (purple)
			(255, 0, 128),    # 9: windowpane (pink)
		]
		
		# Fill first 10 with pre-defined colors
		for i in range(min(10, len(palette))):
			colors[i] = palette[i]
		
		# Fill rest with generated colors
		for i in range(10, self.num_labels):
			colors[i] = self._generate_color(i)
		
		return colors

	@staticmethod
	def _generate_color(index: int) -> Tuple[int, int, int]:
		"""Generate a distinct color for a given class index using distributed HSV."""
		# Use a better distribution method for colors
		# Distribute hue across the spectrum
		h = int((index * 47) % 180)  # 47 is a prime for better distribution
		s = 200 + (index % 55)  # Vary saturation
		v = 150 + (index % 105)  # Vary value for brightness
		
		# Ensure values are in valid range
		h = max(0, min(180, h))
		s = max(100, min(255, s))
		v = max(100, min(255, v))
		
		hsv = np.uint8([[[h, s, v]]])
		bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)[0, 0]
		return tuple(int(c) for c in bgr)

	def get_scene_description(self, segmentation_result: dict) -> str:
		"""
		Get a human-readable description of the scene.

		Args:
			segmentation_result: Output from segment_scene()

		Returns:
			Formatted string describing detected scene elements
		"""
		label_counts = segmentation_result["label_counts"]

		# Sort by pixel count (descending)
		sorted_labels = sorted(label_counts.items(), key=lambda x: x[1], reverse=True)

		description = "Scene composition:\n"
		total_pixels = sum(label_counts.values())

		for label_name, count in sorted_labels[:15]:  # Top 15 classes
			percentage = (count / total_pixels) * 100 if total_pixels > 0 else 0
			description += f"  - {label_name}: {percentage:.1f}%\n"

		return description
