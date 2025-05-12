/* ───────── CONFIG ───────────────────────────────────── */
const CARD_W = 360*0.87, CARD_H = 220*0.87;    // card bitmap size
const CARD_X = 35,  CARD_Y = 112;    // ← adjust if needed

const NUM_SPARKLES = 200;
const SHINE_R_MAIN = 160;
const SHINE_R_LACQ = 120;
const GAMMA_RANGE  = 45;
const BETA_RANGE   = 45;

/* ───────── GLOBALS ─────────────────────────────────── */
let bgImg, cardImg, maskImg;
let lacquerMask = new Uint8Array(CARD_W * CARD_H);     // 0/1 per pixel
let lacquerGfx;
let sparkles = [];

let tiltG = 0, tiltB = 0;
let cx = CARD_X + CARD_W/2;
let cy = CARD_Y + CARD_H/2;

/* ───────── PRELOAD ─────────────────────────────────── */
function preload(){
  bgImg   = loadImage('bg.png',       null, () => console.error('❌ bg.png failed to load'));
  cardImg = loadImage('card.png',     null, () => console.error('❌ card.png failed to load'));
  maskImg = loadImage('lacquerMask.png', null, () => console.error('❌ lacquerMask.png failed to load'));
}
/* ───────── SETUP ───────────────────────────────────── */
function setup(){
  pixelDensity(1);
  createCanvas(bgImg.width, bgImg.height);
  noStroke();

  buildMaskLookup();
  seedSparkles();

  lacquerGfx = createGraphics(CARD_W, CARD_H);
  lacquerGfx.pixelDensity(1);

  /* Gyro access */
  if (window.DeviceOrientationEvent &&
      typeof DeviceOrientationEvent.requestPermission === 'function'){
    addMotionButton();
  } else {
    window.addEventListener('deviceorientation', onTilt, { passive:true });
  }
}

/* ───────── BUILD MASK ──────────────────────────────── */
function buildMaskLookup(){
  maskImg.loadPixels();
  const imgW = maskImg.width;
  const imgH = maskImg.height;
  const d    = imgW / CARD_W;           // assume square pixels & integer scale
  const stride = imgW;

  for(let y=0;y<CARD_H;y++){
    const srcY = y*d + (d>>1);
    for(let x=0;x<CARD_W;x++){
      const srcX = x*d + (d>>1);
      const idx  = 4*(srcY*stride + srcX);
      lacquerMask[y*CARD_W + x] = maskImg.pixels[idx] > 127 ? 1 : 0;
    }
  }
}

/* ───────── SPARKLES ────────────────────────────────── */
function seedSparkles(){
  while(sparkles.length<NUM_SPARKLES){
    const x = floor(random(CARD_W));
    const y = floor(random(CARD_H));
    if(lacquerMask[y*CARD_W + x]){
      sparkles.push({
        x, y,
        r: random(0.5,1.5),
        base: random(0.4,1),
        phase: random(TAU)
      });
    }
  }
}

/* ───────── iOS PERMISSION BUTTON ───────────────────── */
function addMotionButton(){
  const btn = createButton('Enable Motion');
  btn.position(20, height-60);
  btn.mousePressed(async ()=>{
    const ok = await requestMotionAccess();
    if(ok){
      window.addEventListener('deviceorientation', onTilt, { passive:true });
      btn.remove();
    } else {
      alert("Motion access denied. Pop the sketch out to a new tab and try again.");
    }
  });
}

async function requestMotionAccess(){
  if (window.DeviceOrientationEvent &&
      typeof DeviceOrientationEvent.requestPermission === 'function'){
    try{ if((await DeviceOrientationEvent.requestPermission())==='granted') return true; }catch(e){}
  }
  if (window.DeviceMotionEvent &&
      typeof DeviceMotionEvent.requestPermission === 'function'){
    try{ if((await DeviceMotionEvent.requestPermission())==='granted') return true; }catch(e){}
  }
  return false;
}

/* ───────── ORIENTATION CALLBACK ───────────────────── */
function onTilt(e){
  if(e.beta==null||e.gamma==null) return;
  tiltG = constrain(e.gamma,-GAMMA_RANGE,GAMMA_RANGE);
  tiltB = constrain(e.beta, -BETA_RANGE, BETA_RANGE);
}

/* ───────── DRAW LOOP ───────────────────────────────── */
function draw(){
  /* ease shine centre */
  const tx = CARD_X + map(tiltG,-GAMMA_RANGE,GAMMA_RANGE, CARD_W*0.2, CARD_W*0.8);
  const ty = CARD_Y + map(tiltB,-BETA_RANGE, BETA_RANGE, CARD_H*0.2, CARD_H*0.8);
  cx = lerp(cx,tx,0.1);
  cy = lerp(cy,ty,0.1);

  /* background UI */
  image(bgImg,0,0);

  /* card artwork */
  image(cardImg, CARD_X, CARD_Y, CARD_W, CARD_H);

  /* broad shine */
  push();
  blendMode(ADD);
  radial(this,cx,cy,SHINE_R_MAIN,0.35);
  pop();

  /* lacquer shine */
  drawLacquerShine();

  /* sparkles */
  drawSparkles();
}

/* ───────── RADIAL GRADIENT (safe) ──────────────────── */
function radial(g,x,y,r,a0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r)||r<=0) return;
  const ctx=g.drawingContext;
  const grd=ctx.createRadialGradient(x,y,0,x,y,r);
  grd.addColorStop(0,`rgba(255,255,255,${a0})`);
  grd.addColorStop(1,`rgba(255,255,255,0)`);
  ctx.fillStyle=grd;
  ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill();
}

/* ───────── LACQUER SHINE ───────────────────────────── */
function drawLacquerShine(){
  lacquerGfx.clear();
  radial(lacquerGfx, cx-CARD_X, cy-CARD_Y, SHINE_R_LACQ, 0.8);

  lacquerGfx.loadPixels();
  const p = lacquerGfx.pixels;
  for(let i=0;i<lacquerMask.length;i++){
    if(!lacquerMask[i]) p[i*4+3]=0;
  }
  lacquerGfx.updatePixels();

  push();
  blendMode(ADD);
  image(lacquerGfx, CARD_X, CARD_Y);
  pop();
}

/* ───────── SPARKLES ───────────────────────────────── */
function drawSparkles(){
  push();
  blendMode(ADD); noStroke();
  for(const s of sparkles){
    const sx = CARD_X + s.x;
    const sy = CARD_Y + s.y;
    const d = dist(cx,cy,sx,sy);
    let a = s.base * max(0,1-d/140);
    a *= 0.7+0.3*sin(frameCount*0.08+s.phase);
    if(a>0.01){ fill(255,255*a); circle(sx,sy,s.r); }
  }
  pop();
}

/* ───────── MOUSE PREVIEW (desktop) ─────────────────── */
function mouseMoved(){
  if('ontouchstart' in window) return;
  tiltG = map(mouseX,0,width,-GAMMA_RANGE,GAMMA_RANGE);
  tiltB = map(mouseY,0,height,-BETA_RANGE,BETA_RANGE);
}