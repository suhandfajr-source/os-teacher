import os
from PIL import Image, ImageFilter
import numpy as np

def remove_white_background(img_rgb, threshold=248, softness=30):
    """
    High-quality alpha matting for graphics on white background.
    Preserves vibrant colors, anti-aliasing and avoids white fringing.
    """
    arr = np.array(img_rgb.convert('RGB'), dtype=np.float32)
    
    # Calculate brightness
    brightness = arr.max(axis=2)
    
    # Alpha calculation
    # Pure white (>= threshold) -> 0
    # Dark (< threshold - softness) -> 255
    # In-between -> linear interpolation
    alpha = np.clip((threshold - brightness) / softness, 0.0, 1.0) * 255.0
    
    # Color un-multiplying to remove white halo
    # C_original = (C_rendered - (1 - alpha) * 255) / max(alpha, eps)
    alpha_norm = (alpha / 255.0)[:, :, np.newaxis]
    eps = 1e-5
    
    # Un-blend from white background
    unblended = (arr - (1.0 - alpha_norm) * 255.0) / np.maximum(alpha_norm, eps)
    unblended = np.clip(unblended, 0.0, 255.0).astype(np.uint8)
    
    # Compose RGBA
    result = np.dstack((unblended, alpha.astype(np.uint8)))
    return Image.fromarray(result, 'RGBA')

def main():
    os.makedirs('public/brand', exist_ok=True)
    os.makedirs('docs/brand', exist_ok=True)
    
    # 1. Load Master Image
    master = Image.open('public/brand/klassa-logo-master.png').convert('RGB')
    
    # Bounding boxes from analysis
    # Mark: [504, 63, 1034, 665] -> [500, 60, 1038, 668]
    # Wordmark: [325, 709, 1213, 861] -> [320, 705, 1218, 865]
    # Tagline: [371, 896, 1164, 930] -> [365, 892, 1170, 934]
    # Full Vertical: [320, 60, 1218, 934]
    
    # Crop Full Vertical Lockup
    crop_vert = master.crop((320, 58, 1218, 936))
    crop_vert_rgba = remove_white_background(crop_vert)
    crop_vert_rgba.save('public/brand/klassa-logo-vertical.png')
    crop_vert_rgba.save('docs/brand/klassa-logo-vertical.png')
    
    # Crop Mark Only
    crop_mark = master.crop((500, 58, 1038, 668))
    crop_mark_rgba = remove_white_background(crop_mark)
    crop_mark_rgba.save('public/brand/klassa-mark.png')
    crop_mark_rgba.save('docs/brand/klassa-mark.png')
    
    # Crop Wordmark
    crop_word = master.crop((320, 705, 1218, 865))
    crop_word_rgba = remove_white_background(crop_word)
    crop_word_rgba.save('public/brand/klassa-wordmark.png')
    
    # Crop Tagline
    crop_tag = master.crop((365, 892, 1170, 934))
    crop_tag_rgba = remove_white_background(crop_tag)
    crop_tag_rgba.save('public/brand/klassa-tagline.png')
    
    # 2. Compose Perfect Horizontal Lockup (Mark on Left + Wordmark & Tagline on Right)
    # Target height: 400px
    mark_h = 360
    mark_w = int(crop_mark_rgba.width * (mark_h / crop_mark_rgba.height))
    mark_resized = crop_mark_rgba.resize((mark_w, mark_h), Image.Resampling.LANCZOS)
    
    # Right block: Wordmark (height ~140px) + Tagline (height ~35px) + gap
    word_h = 135
    word_w = int(crop_word_rgba.width * (word_h / crop_word_rgba.height))
    word_resized = crop_word_rgba.resize((word_w, word_h), Image.Resampling.LANCZOS)
    
    tag_w = word_w
    tag_h = int(crop_tag_rgba.height * (tag_w / crop_tag_rgba.width))
    tag_resized = crop_tag_rgba.resize((tag_w, tag_h), Image.Resampling.LANCZOS)
    
    gap_x = 50
    total_w = mark_w + gap_x + word_w + 40
    total_h = 420
    
    horiz_img = Image.new('RGBA', (total_w, total_h), (0, 0, 0, 0))
    # Paste Mark centered vertically
    mark_y = (total_h - mark_h) // 2
    horiz_img.paste(mark_resized, (20, mark_y), mark_resized)
    
    # Calculate right block Y
    right_block_h = word_h + 20 + tag_h
    right_start_y = (total_h - right_block_h) // 2 + 10
    
    right_x = 20 + mark_w + gap_x
    horiz_img.paste(word_resized, (right_x, right_start_y), word_resized)
    horiz_img.paste(tag_resized, (right_x, right_start_y + word_h + 18), tag_resized)
    
    horiz_img.save('public/brand/klassa-logo-horizontal.png')
    horiz_img.save('docs/brand/klassa-logo-horizontal.png')
    
    # 3. Crop App Icon from Brand Board
    board = Image.open('public/brand/klassa-brand-board.png').convert('RGB')
    
    # Locate hero app icon
    # Hero Squircle is approximately between x: 900-1190, y: 70-360
    app_hero = board.crop((900, 72, 1195, 368))
    app_hero.save('public/brand/klassa-app-icon.png')
    app_hero.save('docs/brand/klassa-app-icon.png')
    
    # Generate PWA & Favicon Icons from App Icon
    app_512 = app_hero.resize((512, 512), Image.Resampling.LANCZOS)
    app_512.save('public/icon-512.png')
    
    app_192 = app_hero.resize((192, 192), Image.Resampling.LANCZOS)
    app_192.save('public/icon-192.png')
    app_192.save('public/apple-touch-icon.png')
    
    app_64 = app_hero.resize((64, 64), Image.Resampling.LANCZOS)
    app_64.save('public/favicon.png')
    app_64.save('public/favicon.ico')
    
    print('All authentic high-res brand assets generated successfully!')

if __name__ == '__main__':
    main()
