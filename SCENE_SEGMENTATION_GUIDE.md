# Scene Segmentation Integration Guide

## Overview

VisionGuard now includes semantic scene segmentation using the **Segformer** model to understand the environment context when detecting persons. The segmentation runs once at the start of the video and provides a detailed breakdown of the scene's composition.

## Features

- **Single-pass segmentation**: Runs once at video start for efficiency
- **Scene description**: Outputs human-readable breakdown of detected scene elements
- **Visual overlay**: Optional visualization of semantic classes in the output video
- **Context-aware detection**: Enables matching detected persons with their environmental context

## How It Works

1. On the first frame of the video, the Segformer model performs semantic segmentation
2. All pixels are classified into one of 150 ADE20K classes (walls, trees, people, furniture, etc.)
3. A confidence map is generated for each pixel
4. The scene composition is printed (percentage of each class)
5. When persons are detected, you can reference this scene context to understand their environment

## Usage

### Basic Usage: Enable Scene Segmentation

```bash
python main.py \
    --input video.mp4 \
    --output output.mp4 \
    --enable-scene-segmentation
```

### With Visualization

To overlay the semantic segmentation on the first frame of the output video:

```bash
python main.py \
    --input video.mp4 \
    --output output.mp4 \
    --enable-scene-segmentation \
    --visualize-scene-segmentation
```

### Custom Model

To use a different Segformer model from HuggingFace:

```bash
python main.py \
    --input video.mp4 \
    --output output.mp4 \
    --enable-scene-segmentation \
    --scene-segmentation-model "nvidia/segformer-b5-finetuned-ade-640-640"
```

## Available Models

The following Segformer models are available from NVIDIA:

- `nvidia/segformer-b0-finetuned-ade-512-512` (default) - Lightweight, fast
- `nvidia/segformer-b1-finetuned-ade-512-512` - Balanced
- `nvidia/segformer-b2-finetuned-ade-512-512` - Accurate
- `nvidia/segformer-b5-finetuned-ade-640-640` - Most accurate

**Note**: Larger models are more accurate but slower. For videos, use B0 or B1.

## Output

When scene segmentation is enabled, the pipeline will print output like:

```
Scene segmentation complete on first frame:
Scene composition:
  - wall: 28.5%
  - ceiling: 18.2%
  - floor: 15.3%
  - window: 12.1%
  - furniture: 8.4%
  - building: 5.2%
  - grass: 4.5%
  - door: 3.8%
  - road: 2.1%
  - sky: 1.9%
  ...
```

## Integration with Person Detection

The scene segmentation context is available throughout the pipeline. You can:

1. **Use for context matching**: When a person is detected, you know they're in a specific environment (office, park, street, etc.)
2. **Combine with bounding boxes**: Pair person detections with scene context
3. **Event association**: Associate detected actions with scene context for better alerts

## API Usage

You can access the scene segmentation programmatically:

```python
from src.models.segmentation.scene_segmentation import SceneSegmentationEngine
import cv2

# Initialize
segmenter = SceneSegmentationEngine(device="cuda:0")

# Segment a frame
frame = cv2.imread("image.jpg")
result = segmenter.segment_scene(frame)

# Access results
segmentation_map = result["segmentation_map"]  # HxW array with class indices
class_names = result["class_names"]  # Detected class names
label_counts = result["label_counts"]  # Count of pixels per class
description = segmenter.get_scene_description(result)

# Optional: Visualize
viz = segmenter.visualize_segmentation(result, frame, alpha=0.4)
cv2.imwrite("segmentation_viz.jpg", viz)
```

## Performance Notes

- First frame processing adds ~2-5 seconds (depending on model)
- Lightweight B0 model: ~2 seconds on GPU, ~10 seconds on CPU
- B5 model: ~5 seconds on GPU, ~30 seconds on CPU
- Subsequent frames are unaffected (no segmentation needed)

## Requirements

The following packages are automatically installed:
- `transformers>=4.30.0` - HuggingFace transformers library
- `torch>=2.0.0` - PyTorch (already in requirements)
- `pillow>=9.0.0` - Image processing (already in requirements)

## Troubleshooting

### Out of Memory Errors

If you get CUDA out of memory errors:
```bash
# Use smaller model
--scene-segmentation-model "nvidia/segformer-b0-finetuned-ade-512-512"

# Or use CPU (slower)
--device cpu
```

### Model Download Issues

The first run will download the model (~200-800MB depending on which model). This requires an internet connection.

```bash
# Pre-download model offline if needed
python -c "from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation; SegformerImageProcessor.from_pretrained('nvidia/segformer-b0-finetuned-ade-512-512')"
```

## Future Enhancements

Potential improvements:
- Run segmentation every N frames (not just at start)
- Temporal consistency between frames
- Track changes in scene (lights on/off, new objects, etc.)
- Use segmentation to filter false detections
- Integrate with alerting system for scene changes

## References

- **Paper**: "SegFormer: Simple and Efficient Design for Semantic Segmentation with Transformers"
- **Dataset**: ADE20K (150 semantic classes)
- **Model Hub**: https://huggingface.co/nvidia
