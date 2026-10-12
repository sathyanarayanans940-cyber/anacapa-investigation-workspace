# User guide source

The shipped guide is `public/guide/Anacapa-Guide.pdf`. Help also offers the fictional practice case in `public/examples/Harbor-Tutorial.anacapa`.

`guide_content.py` contains the 25-page guide for version 0.3.3, including case folders, security, sources, history, integrity, custody, backups, sharing, and recovery.

Run `python3 docs/prepare_guide_images.py`, then `python3 docs/build_guide.py`. The builder uses ReportLab and Pillow and writes `output/pdf/Anacapa-Guide.pdf`. Headings, instructions, captions, and small labels use embedded Georgia regular, bold, and italic from the macOS supplemental font folder; adjust `FONTS` and the font filenames for another system.

The captures in `images/retina/` come from the actual app using a separate fictional Harbor Tutorial case. The board capture is 2,400 pixels wide. The refreshed dialog sources in `high-resolution/` are lossless crops from 3,456 × 1,998 native Retina PNG screenshots with enlarged browser rendering. Preparation never resamples or upscales, and the PDF embeds their original pixels. The source manifest, preparation manifest, and `output/pdf/guide-image-quality.json` record dimensions, crops, and placement. Record-panel sources are cropped to omit the local computer path; uncropped originals stay in ignored temporary files.

After changing the guide, render every page with Poppler and check the images for clipping, legibility, and accurate instructions. Copy the verified PDF to `public/guide/Anacapa-Guide.pdf`, then run `npm run package` to include it in the release.
