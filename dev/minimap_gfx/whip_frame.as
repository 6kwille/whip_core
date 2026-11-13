// whip's addition to GTA's radar movie, minimap.gfx (Josh, 10 Oct 2026): the HUD black skin's minimap frame, drawn
// by the movie once instead of by a script every frame.
//
// SHELVED THE SAME DAY, AND WHY (commit 3248c197 shipped it, the next took it out; the streamed movie was deleted):
//   * the movie's output is CUT TO THE MAP'S SHAPE (Josh's screenshot: the frame's one visible edge ran exactly from
//     the map's top to its bottom), so it can only ever draw a rim INSIDE the map's edge, never round it;
//   * its 142 x 142 stage is NOT the visible map (the frame came out oversized and off to one side): the game
//     stretches it over another box, which would need measuring in game first;
//   * it draws OVER the map, never under it, so it cannot back the map - and GTA draws the radar's map
//     semi-transparent close up (its roads and blocks are .ydd geometry, not whip's texture tiles), which the sprite
//     frame's filled middle hides. A backing under the map needs a draw every frame (client/hud_skin.lua's sprite).
// Worth reviving only with the radar's map made solid at the source (its .ydd geometry replaced, as the paid
// dark-map packs do), and then as an INSET rim. Nothing in client/ calls these methods now.
//
// stream/minimap.gfx = Rockstar's movie for game build 3407 + these methods, added to the class
// com.rockstargames.gtav.minimap.MINIMAP (and a field `var WHIP_FRAME;` among its others). The game loads Rockstar's
// copy, not the one in FiveM's override cache (/minimapcheck: the bicycle and shark blips, sprites 859 and 914, show).
//
// REBUILDING, after a change here or a new game build (a copy for the wrong build drops the build's new blip icons):
//   1. Rockstar's minimap.gfx from the game the server runs, unmodified:
//      update\update.rpf\x64\patch\data\cdimages\scaleform_minimap.rpf\minimap.gfx (OpenIV, or CodeWalker's
//      RPF explorer; 3D Clanker exported 3407's from FiveM's game cache, sha256 5781611f..., 220,543 bytes)
//   2. JPEXS FFDec (C:\Tools\ffdec, java):
//        java -jar ffdec-cli.jar -export script out minimap.gfx
//      then paste the methods below before the class's last brace in
//        out/scripts/__Packages/com/rockstargames/gtav/minimap/MINIMAP.as
//      and add `var WHIP_FRAME;` to its fields.
//   3. Import ONLY that class (a folder holding just scripts/__Packages/com/rockstargames/gtav/minimap/MINIMAP.as;
//      recompiling Rockstar's other 61 scripts is a needless risk):
//        java -jar ffdec-cli.jar -importScript minimap.gfx minimap_whip.gfx <that folder>/scripts
//   4. Check: export the result's scripts again, the other 61 identical, these methods present; the tag count the same.
//      3407's: 6,281 tags, the class 24,795 -> 31,688 bytes, the file 227,436 bytes, sha256 b8e08150...
//   5. Copy it to stream/minimap.gfx and restart whip_core.
//
// THE METHODS, as added:
   // WHIP (whip_core client/hud_skin.lua, 10 Oct 2026): the HUD black skin's frame round the map, drawn by this movie
   // once instead of by a script every frame. On a layer just under CONTENT (the blips), so they and the N sit on it.
   // Everything in stage units (the 142 x 142 square the radar is drawn in, stretched by the game to its box).
   function WHIP_FRAME_VERSION()
   {
      return 1;
   }
   function SET_WHIP_FRAME(visible, x0, y0, x1, y1, rx, ry, b1x, b1y, b2x, b2y, b3x, b3y)
   {
      var d;
      if(this.WHIP_FRAME == undefined)
      {
         d = this.CONTENT.getDepth() - 1;
         while(this.TIMELINE.getInstanceAtDepth(d) != undefined)
         {
            d = d - 1;
         }
         this.WHIP_FRAME = this.TIMELINE.createEmptyMovieClip("whipFrame",d);
      }
      this.WHIP_FRAME.clear();
      this.WHIP_FRAME._visible = visible == true;
      if(visible != true)
      {
         return undefined;
      }
      // from the map's edge out: a black line (b1), the white (b2), a black edge (b3)
      var e1x = b1x;
      var e1y = b1y;
      var e2x = b1x + b2x;
      var e2y = b1y + b2y;
      this.whipRing(0,x0,y0,x1,y1,rx,ry,e2x,e2y,e2x + b3x,e2y + b3y);
      this.whipRing(16777215,x0,y0,x1,y1,rx,ry,e1x,e1y,e2x,e2y);
      this.whipRing(0,x0,y0,x1,y1,rx,ry,0,0,e1x,e1y);
   }
   function whipRing(colour, x0, y0, x1, y1, rx, ry, inX, inY, outX, outY)
   {
      // two rounded boxes in one fill: the inner one is a hole (the fill is even-odd)
      this.WHIP_FRAME.beginFill(colour,100);
      this.whipBox(x0 - outX,y0 - outY,x1 + outX,y1 + outY,rx + outX,ry + outY);
      this.whipBox(x0 - inX,y0 - inY,x1 + inX,y1 + inY,rx + inX,ry + inY);
      this.WHIP_FRAME.endFill();
   }
   function whipBox(l, t, r, b, rx, ry)
   {
      var mc = this.WHIP_FRAME;
      mc.moveTo(l + rx,t);
      mc.lineTo(r - rx,t);
      this.whipArc(r - rx,t + ry,rx,ry,270);
      mc.lineTo(r,b - ry);
      this.whipArc(r - rx,b - ry,rx,ry,0);
      mc.lineTo(l + rx,b);
      this.whipArc(l + rx,b - ry,rx,ry,90);
      mc.lineTo(l,t + ry);
      this.whipArc(l + rx,t + ry,rx,ry,180);
   }
   function whipArc(cx, cy, rx, ry, from)
   {
      // a quarter ellipse from `from` degrees, clockwise on screen (y down), as two quadratic curves
      var mc = this.WHIP_FRAME;
      var k = 1 / Math.cos(0.39269908169872414);
      var i = 0;
      var a0;
      var a1;
      var am;
      while(i < 2)
      {
         a0 = (from + i * 45) * 0.017453292519943295;
         a1 = (from + (i + 1) * 45) * 0.017453292519943295;
         am = (a0 + a1) / 2;
         mc.curveTo(cx + rx * k * Math.cos(am),cy + ry * k * Math.sin(am),cx + rx * Math.cos(a1),cy + ry * Math.sin(a1));
         i = i + 1;
      }
   }
