# 404 chase animation

Generates `assets/404-chase.gif`, `assets/404-chase.webp` and `assets/404-chase-still.jpg`
from `source.jpg` (requires Python 3 with Pillow and numpy):

```sh
python tools/404-gif/make_gif.py tools/404-gif/source.jpg tools/404-gif/out
cp tools/404-gif/out/404-chase.* tools/404-gif/out/404-chase-still.jpg assets/
```

Loop (32 frames × 80 ms): the 404 bug chases the developer, lunges and almost catches
him, the neon sign glitches, he startles ("!" + sweat) and papers fly off; the bug falls
back. The original spark trail (drawn in front of the bug) is removed and redrawn behind it.
This folder is not part of the public build.
