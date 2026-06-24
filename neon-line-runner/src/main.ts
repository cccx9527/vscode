import './style.css'

type GameState = 'intro' | 'playing' | 'failed' | 'won'
type Point = { x: number; y: number }
type Wall = { x: number; y: number; width: number; height: number }

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ctx = canvas.getContext('2d')!
const overlay = document.querySelector<HTMLElement>('#overlay')!
const title = document.querySelector<HTMLElement>('#overlay-title')!
const message = document.querySelector<HTMLElement>('#overlay-message')!
const hint = document.querySelector<HTMLElement>('#overlay-hint')!
const button = document.querySelector<HTMLButtonElement>('#start-button')!
const distance = document.querySelector<HTMLElement>('#distance')!
const controlTip = document.querySelector<HTMLElement>('#control-tip')!

const WORLD_HEIGHT = 900, START = { x: 140, y: 450 }, HEAD_RADIUS = 11
const SPEED = 255, TURN_RATE = 1.45, MAX_ANGLE = Math.PI / 3.15, TRAIL_LIMIT = 170, FINISH_X = 4950
const gaps = [[280,500],[510,735],[185,405],[550,760],[320,525],[620,825],[145,350],[465,675],[235,450],[575,790]]
const walls: Wall[] = gaps.flatMap(([top, bottom], index) => {
  const x = 700 + index * (index === 1 ? 390 : 410)
  return [{ x, y: 0, width: 60, height: top }, { x, y: bottom, width: 60, height: WORLD_HEIGHT - bottom }]
})

let state: GameState = 'intro', held = false, shownTip = false, head: Point = { ...START }, heading = 0
let trail: Point[] = [], cameraX = 0, lastTime = 0, dpr = 1, viewWidth = 0, viewHeight = 0

function resetGame() {
  state = 'playing'; held = false; head = { ...START }; heading = 0; trail = [{ ...head }]; cameraX = 0
  distance.textContent = '0000'; overlay.classList.add('hidden')
  if (!shownTip) controlTip.classList.add('visible')
}

function endGame(won: boolean) {
  state = won ? 'won' : 'failed'; held = false
  const travelled = Math.max(0, Math.floor(head.x - START.x))
  title.textContent = won ? '穿行成功' : '信号中断'
  message.innerHTML = won ? `你抵达了终点<br />前进距离 ${travelled} m` : `线头撞上了障碍<br />前进距离 ${travelled} m`
  hint.textContent = won ? '再挑战一次，跑得更漂亮。' : '调整转向节奏，再试一次。'
  button.textContent = '再来一次'; overlay.classList.remove('hidden'); controlTip.classList.remove('visible')
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2); viewWidth = innerWidth; viewHeight = innerHeight
  canvas.width = Math.floor(viewWidth * dpr); canvas.height = Math.floor(viewHeight * dpr)
  canvas.style.width = `${viewWidth}px`; canvas.style.height = `${viewHeight}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
function hitsRect(circle: Point, radius: number, rect: Wall) {
  const x = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width)), y = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height))
  return (circle.x - x) ** 2 + (circle.y - y) ** 2 <= radius ** 2
}
function update(dt: number) {
  if (state !== 'playing') return
  heading = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, heading + (held ? -TURN_RATE : TURN_RATE) * dt))
  head = { x: head.x + Math.cos(heading) * SPEED * dt, y: head.y + Math.sin(heading) * SPEED * dt }
  trail.push({ ...head }); if (trail.length > TRAIL_LIMIT) trail.splice(0, trail.length - TRAIL_LIMIT)
  cameraX += (head.x - viewWidth * .28 - cameraX) * Math.min(1, dt * 5.5)
  distance.textContent = Math.max(0, Math.floor(head.x - START.x)).toString().padStart(4, '0')
  if (head.y - HEAD_RADIUS < 0 || head.y + HEAD_RADIUS > WORLD_HEIGHT || walls.some(w => hitsRect(head, HEAD_RADIUS, w))) endGame(false)
  else if (head.x >= FINISH_X) endGame(true)
}
function toScreen(p: Point): Point { return { x: p.x - cameraX, y: p.y - (450 - viewHeight / 2) } }
function drawBackground() {
  const gradient = ctx.createLinearGradient(0,0,0,viewHeight); gradient.addColorStop(0,'#071323'); gradient.addColorStop(.5,'#060914'); gradient.addColorStop(1,'#100716')
  ctx.fillStyle = gradient; ctx.fillRect(0,0,viewWidth,viewHeight); const top = 450 - viewHeight / 2
  ctx.strokeStyle = 'rgba(82,194,216,.08)'; ctx.lineWidth = 1
  for (let y = Math.ceil(top / 100) * 100; y <= top + viewHeight; y += 100) { ctx.beginPath(); ctx.moveTo(0,y-top); ctx.lineTo(viewWidth,y-top); ctx.stroke() }
  for (let x = Math.ceil(cameraX / 100) * 100; x <= cameraX + viewWidth; x += 100) { ctx.beginPath(); ctx.moveTo(x-cameraX,0); ctx.lineTo(x-cameraX,viewHeight); ctx.stroke() }
}
function drawWalls() {
  const top = 450 - viewHeight / 2; ctx.save()
  for (const wall of walls) { const x = wall.x-cameraX, y = wall.y-top; if (x>viewWidth || x+wall.width<0 || y>viewHeight || y+wall.height<0) continue; ctx.shadowColor='#ff3a9b'; ctx.shadowBlur=18; ctx.fillStyle='rgba(255,48,144,.84)'; ctx.fillRect(x,y,wall.width,wall.height); ctx.shadowBlur=0; ctx.fillStyle='rgba(255,235,247,.65)'; ctx.fillRect(x+5,y,2,wall.height) }
  const finish = FINISH_X-cameraX; if (finish>-60 && finish<viewWidth+60) { ctx.strokeStyle='#ffe86b'; ctx.lineWidth=4; ctx.shadowColor='#ffe86b'; ctx.shadowBlur=20; ctx.beginPath(); ctx.moveTo(finish,0); ctx.lineTo(finish,viewHeight); ctx.stroke(); ctx.shadowBlur=0; ctx.fillStyle='#ffe86b'; ctx.font='700 12px system-ui'; ctx.fillText('终点',finish+10,28) }; ctx.restore()
}
function drawTrail() {
  if (trail.length < 2) return; ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round'
  for (const [width, alpha] of [[14,.12],[6,.72]] as const) { ctx.beginPath(); trail.forEach((p,i) => { const s=toScreen(p); i ? ctx.lineTo(s.x,s.y) : ctx.moveTo(s.x,s.y) }); ctx.strokeStyle=`rgba(68,242,255,${alpha})`; ctx.lineWidth=width; ctx.shadowColor='#37eefa'; ctx.shadowBlur=width===14?25:10; ctx.stroke() }
  const current=toScreen(head); ctx.fillStyle='#e9ffff'; ctx.shadowColor='#35f0ff'; ctx.shadowBlur=26; ctx.beginPath(); ctx.arc(current.x,current.y,HEAD_RADIUS,0,Math.PI*2); ctx.fill(); ctx.restore()
}
function frame(time: number) { const dt=Math.min((time-lastTime)/1000 || 0,.035); lastTime=time; update(dt); drawBackground(); drawWalls(); drawTrail(); requestAnimationFrame(frame) }
function setHeld(next: boolean) { if (state !== 'playing') return; held=next; if (next && !shownTip) { shownTip=true; controlTip.classList.remove('visible') } }
button.addEventListener('click', resetGame)
canvas.addEventListener('pointerdown', e => { e.preventDefault(); if (state !== 'playing') resetGame(); setHeld(true) })
window.addEventListener('pointerup', () => setHeld(false)); window.addEventListener('pointercancel', () => setHeld(false)); window.addEventListener('blur', () => setHeld(false)); window.addEventListener('resize', resize)
resize(); drawBackground(); drawWalls(); requestAnimationFrame(frame)
