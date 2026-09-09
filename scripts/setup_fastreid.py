#!/usr/bin/env python3
"""
Initialize and save FastReID ViT model weights for tracker ReID.
Run once to setup, then tracker config will use the saved weights.
"""
import torch
import sys
from pathlib import Path

def setup_fastreid():
    """Download and save FastReID ViT model."""
    try:
        from torchreid import models
    except ImportError:
        print("Error: torchreid not installed. Run: pip install torchreid")
        sys.exit(1)
    
    # Create config dir if needed
    config_dir = Path(__file__).parent.parent / "config"
    config_dir.mkdir(exist_ok=True)
    
    weights_path = config_dir / "fastreid_vit_base.pth"
    
    print("Initializing FastReID ViT model (pretrained on ImageNet)...")
    try:
        # Build ViT-based ReID model
        model = models.build_model(
            name='vit_transreid_base',
            num_classes=1000,
            pretrained=True
        )
        print("✓ FastReID ViT model loaded")
    except Exception as e:
        print(f"Warning: vit_transreid_base not available, using osnet_x1_0 instead")
        print(f"  (Error: {e})")
        model = models.build_model(
            name='osnet_x1_0',
            num_classes=1000,
            pretrained=True
        )
        weights_path = config_dir / "fastreid_osnet.pth"
        print("✓ OSNet model loaded as fallback")
    
    # Save model state dict
    print(f"Saving weights to {weights_path}...")
    torch.save(model.state_dict(), str(weights_path))
    print(f"✓ Weights saved to {weights_path}")
    print("✓ Setup complete! Update botsort_occlusion.yaml to use this model path.")
    return str(weights_path)

if __name__ == "__main__":
    weights_file = setup_fastreid()
    print(f"\nNext step: Update config/botsort_occlusion.yaml and set:")
    print(f"  model: {weights_file}")
