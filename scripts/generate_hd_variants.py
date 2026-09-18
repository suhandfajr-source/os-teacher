import os
from PIL import Image, ImageOps
import numpy as np

def remove_white_background(img_rgb, threshold=248, softness=25):
    arr = np.array(img_rgb.convert('RGB'), dtype=np.float32)
    brightness = arr.max(axis=2)
    alpha = np.clip((threshold - brightness) / softness, 0.0, 1.0) * 255.0
    alpha_norm = (alpha / 255.0)[:, :, np.newaxis]
    unblended = (arr - (1.0 - alpha_norm) * 255.0) / np.maximum(alpha_norm, 1e-5)
    unblended = np.clip(unblended, 0.0, 255.0).astype(np.uint8)
    rgba = np.dstack((unblended, alpha.astype(np.uint8)))
    return Image.fromarray(rgba, 'RGBA')

def main():
    os.makedirs('public/brand', exist_ok=True)
    os.makedirs('docs/brand', exist_ok=True)
    
    # 1. Load Master 4K Image
    master = Image.open('public/brand/klassa-logo-master.png').convert('RGB')
    board = Image.open('public/brand/klassa-brand-board.png').convert('RGB')
    
    # Extract High-Res Elements from Master
    # Mark: [500, 58, 1038, 668] (K + Sparkle)
    mark_crop = master.crop((500, 58, 1038, 668))
    mark_rgba = remove_white_background(mark_crop)
    bbox_m = mark_rgba.getbbox()
    if bbox_m:
        mark_rgba = mark_rgba.crop(bbox_m)
    
    # Wordmark: [320, 705, 1218, 865] (KLASSA)
    word_crop = master.crop((320, 705, 1218, 865))
    word_rgba = remove_white_background(word_crop)
    bbox_w = word_rgba.getbbox()
    if bbox_w:
        word_rgba = word_rgba.crop(bbox_w)
        
    # Tagline: [365, 892, 1170, 934] (NAIK KELAS BERSAMA)
    tag_crop = master.crop((365, 892, 1170, 934))
    tag_rgba = remove_white_background(tag_crop)
    bbox_t = tag_rgba.getbbox()
    if bbox_t:
        tag_rgba = tag_rgba.crop(bbox_t)
        
    # ----------------------------------------------------
    # VARIANT 1: HORIZONTAL (UTAMA) - High Res HD
    # ----------------------------------------------------
    # In horizontal layout: Mark on left, text block on right
    # Scale mark to height 400
    target_mark_h = 400
    scale_m = target_mark_h / mark_rgba.height
    mark_h_resized = mark_rgba.resize((int(mark_rgba.width * scale_m), target_mark_h), Image.Resampling.LANCZOS)
    
    # Scale wordmark to match proportion (height ~160)
    target_word_h = 150
    scale_w = target_word_h / word_rgba.height
    word_h_resized = word_rgba.resize((int(word_rgba.width * scale_w), target_word_h), Image.Resampling.LANCZOS)
    
    # Tagline width matches wordmark width
    target_tag_w = word_h_resized.width
    scale_t = target_tag_w / tag_rgba.width
    tag_h_resized = tag_rgba.resize((target_tag_w, int(tag_rgba.height * scale_t)), Image.Resampling.LANCZOS)
    
    gap_between_mark_text = 60
    gap_between_word_tag = 22
    
    text_block_h = word_h_resized.height + gap_between_word_tag + tag_h_resized.height
    total_canvas_h = max(mark_h_resized.height, text_block_h) + 60
    total_canvas_w = mark_h_resized.width + gap_between_mark_text + word_h_resized.width + 60
    
    horiz_canvas = Image.new('RGBA', (total_canvas_w, total_canvas_h), (0, 0, 0, 0))
    
    # Paste mark centered vertically
    mark_y = (total_canvas_h - mark_h_resized.height) // 2
    horiz_canvas.paste(mark_h_resized, (30, mark_y), mark_h_resized)
    
    # Paste text block centered vertically
    text_start_y = (total_canvas_h - text_block_h) // 2
    text_x = 30 + mark_h_resized.width + gap_between_mark_text
    
    horiz_canvas.paste(word_h_resized, (text_x, text_start_y), word_h_resized)
    horiz_canvas.paste(tag_h_resized, (text_x, text_start_y + word_h_resized.height + gap_between_word_tag), tag_h_resized)
    
    # Trim empty borders
    bbox_h_final = horiz_canvas.getbbox()
    if bbox_h_final:
        horiz_canvas = horiz_canvas.crop(bbox_h_final)
    
    # Save Horizontal
    horiz_canvas.save('public/brand/klassa-logo-horizontal.png')
    horiz_canvas.save('docs/brand/klassa-logo-horizontal.png')
    print('Generated High-Res Horizontal Logo:', horiz_canvas.size)

    # ----------------------------------------------------
    # VARIANT 2: VERTIKAL (Master Lockup) - High Res HD
    # ----------------------------------------------------
    vert_crop = master.crop((320, 58, 1218, 936))
    vert_rgba = remove_white_background(vert_crop)
    bbox_v = vert_rgba.getbbox()
    if bbox_v:
        vert_rgba = vert_rgba.crop(bbox_v)
    vert_rgba.save('public/brand/klassa-logo-vertical.png')
    vert_rgba.save('docs/brand/klassa-logo-vertical.png')
    print('Generated High-Res Vertical Logo:', vert_rgba.size)

    # ----------------------------------------------------
    # VARIANT 3: MARK ONLY (Monogram K + Sparkle) - High Res HD
    # ----------------------------------------------------
    mark_rgba.save('public/brand/klassa-mark.png')
    mark_rgba.save('docs/brand/klassa-mark.png')
    print('Generated High-Res Mark Only:', mark_rgba.size)

    # ----------------------------------------------------
    # VARIANT 4: 3 APP ICON SQUIRCLES (Primary, Light, Dark)
    # ----------------------------------------------------
    # 1. Primary Hero App Icon (From Brand Board Hero)
    app_hero_crop = board.crop((895, 68, 1195, 368))
    app_hero_crop.save('public/brand/klassa-app-icon.png')
    app_hero_crop.save('public/brand/klassa-app-icon-primary.png')
    app_hero_crop.save('docs/brand/klassa-app-icon.png')
    
    # 2. Light App Icon (Mint Squircle)
    app_light_crop = board.crop((1308, 235, 1392, 320))
    app_light_crop.save('public/brand/klassa-app-icon-light.png')
    
    # 3. Dark App Icon (Dark Slate Squircle)
    app_dark_crop = board.crop((1408, 235, 1492, 320))
    app_dark_crop.save('public/brand/klassa-app-icon-dark.png')

    # Also make high-res versions of Light and Dark squircles using the high-res mark
    # Create 512x512 Dark Squircle
    dark_sq = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    # Draw rounded rect
    from PIL import ImageDraw
    d_mask = Image.new('L', (512, 512), 0)
    d_draw = ImageDraw.Draw(d_mask)
    d_draw.rounded_rectangle((0, 0, 512, 512), radius=115, fill=255)
    
    # Dark background #0F172A
    dark_bg = Image.new('RGBA', (512, 512), (15, 23, 42, 255))
    dark_sq.paste(dark_bg, (0, 0), d_mask)
    
    # Paste mark centered
    target_sq_mark_h = 320
    scale_sq_m = target_sq_mark_h / mark_rgba.height
    mark_sq_resized = mark_rgba.resize((int(mark_rgba.width * scale_sq_m), target_sq_mark_h), Image.Resampling.LANCZOS)
    
    m_x = (512 - mark_sq_resized.width) // 2
    m_y = (512 - target_sq_mark_h) // 2
    dark_sq.paste(mark_sq_resized, (m_x, m_y), mark_sq_resized)
    dark_sq.save('public/brand/klassa-app-icon-dark-hd.png')

    # Create 512x512 Light Squircle
    light_sq = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    l_mask = Image.new('L', (512, 512), 0)
    l_draw = ImageDraw.Draw(l_mask)
    l_draw.rounded_rectangle((0, 0, 512, 512), radius=115, fill=255)
    
    # Light mint background #CCFBF1
    light_bg = Image.new('RGBA', (512, 512), (204, 251, 241, 255))
    light_sq.paste(light_bg, (0, 0), l_mask)
    light_sq.paste(mark_sq_resized, (m_x, m_y), mark_sq_resized)
    light_sq.save('public/brand/klassa-app-icon-light-hd.png')

    # High-res PWA Favicons
    app_hero_crop.resize((512, 512), Image.Resampling.LANCZOS).save('public/icon-512.png')
    app_hero_crop.resize((192, 192), Image.Resampling.LANCZOS).save('public/icon-192.png')
    app_hero_crop.resize((192, 192), Image.Resampling.LANCZOS).save('public/apple-touch-icon.png')
    app_hero_crop.resize((64, 64), Image.Resampling.LANCZOS).save('public/favicon.png')
    app_hero_crop.resize((64, 64), Image.Resampling.LANCZOS).save('public/favicon.ico')

    print('All Ultra-HD variants generated successfully!')

if __name__ == '__main__':
    main()
