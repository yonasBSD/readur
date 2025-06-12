#!/usr/bin/env python3
"""Create test images with text for OCR testing."""

from PIL import Image, ImageDraw, ImageFont
import os

def create_test_image(text, filename):
    """Create a simple test image with text."""
    # Create a white image
    img = Image.new('RGB', (400, 200), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a basic font
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
    except:
        font = ImageFont.load_default()
    
    # Draw text
    draw.text((20, 50), text, fill='black', font=font)
    
    # Save image
    img.save(filename)
    print(f"Created {filename}")

if __name__ == "__main__":
    os.makedirs("test_data", exist_ok=True)
    
    # Create test images
    create_test_image("Hello OCR Test", "test_data/hello_ocr.png")
    create_test_image("This is a test document\nwith multiple lines", "test_data/multiline.png")
    create_test_image("1234567890", "test_data/numbers.png")