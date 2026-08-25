# 幸运弹珠 5×5 配件精灵图提示词

Use case: stylized-concept

Asset type: production 5 by 5 game UI icon sprite sheet for the Chinese single-player marble arcade game Lucky Marble.

Input images: Image 1 is `arcade-icons-v1.webp`, used as the rounded glossy icon style reference. Image 2 is `cabinet-background-v2.webp`, used as the palette and physical arcade-cabinet reference.

Primary request: Create exactly twenty-five distinct premium arcade accessory icons arranged in a perfectly aligned grid of exactly 5 columns by 5 rows. Each equal square cell contains one centered icon with generous identical safe padding and no overlap or bleed into adjacent cells.

Exact cell order, left to right, top to bottom:

- Row 1: shiny gold point coin with a simple recessed dot and no symbol; purple-and-gold musical note; clockwise purple-and-gold reset arrow; faceted violet lucky gem; small purple-and-gold reward card with no writing.
- Row 2: radiant five-point gold star; small jeweled gold crown; celebratory gold trophy; jade four-leaf clover with gold trim; cheerful gold celebration bell with violet ribbon.
- Row 3: gold sunburst medallion with no text; polished silver marble; purple-and-gold bullseye target; gold lucky horseshoe; round gold-and-violet arcade bumper post.
- Row 4: cluster of gold-violet sparkles; dynamic gold lightning bolt; compact purple-gold confetti burst; friendly red-orange cracked sad star for near-miss; elegant purple-and-gold ribbon bow.
- Row 5: single warm gold marquee bulb in a violet socket; round gold cabinet screw head; small gold-edged purple reward ticket with no writing; compact purple-and-gold launcher plunger handle; symmetrical gold laurel wreath with violet jewel.

Style/medium: polished cheerful 3D toy-like arcade UI icon render, rounded forms, glossy enamel, softly beveled gold metal, crisp readable silhouettes, cute premium physical amusement-machine styling. Match the visual language, highlights, outline weight, purple and bright gold palette of the references.

Composition/framing: exact orthographic front view, identical visual weight, consistent scale, no perspective grid, no borders, no cell dividers, no labels. Keep every object fully inside its own 20 percent by 20 percent cell with at least 12 percent internal padding on every side.

Lighting/mood: warm studio highlights contained inside each object; vivid festive polish.

Scene/backdrop: perfectly flat solid `#00FFFF` chroma-key background for background removal. The entire background and every gap between icons must be exactly one uniform `#00FFFF`, with no shadows, gradients, texture, reflections, floor plane, glow, or lighting variation.

Constraints: exactly 5 columns and exactly 5 rows; exactly 25 icons; every listed cell contains only its specified icon; crisp isolated edges; no cast shadow; no contact shadow; no watermark; no words; no letters; no numbers. Do not use `#00FFFF` or cyan anywhere inside any icon.

Avoid: extra objects, missing objects, merged cells, uneven spacing, text, logos, slot-machine imagery, realistic gambling chips, frames, grid lines, cropped icons, background patterns, cyan subject colors.

## 唯一一次网格修正

Use case: precise-object-edit

Primary request: Change only the spacing and alignment. Preserve all 25 existing icon designs, colors, materials, order, flat `#00FFFF` background, square canvas, and exact 5-column by 5-row layout. Slightly shrink and reposition every icon so each icon is fully contained inside its own exact mathematical 20% by 20% grid cell.

Required geometry: every cell must have at least 8% of the cell width as key-color padding on all four sides; no icon pixel, glow, outline, highlight, or antialiasing may cross a cell boundary. Center each icon within its cell. Keep the grid invisible: no borders, guides, dividers, labels, or text.

Constraints: change only scale and position needed for safe padding; do not redesign, replace, add, remove, merge, reorder, crop, or relabel any icon. Exactly 25 icons remain.
