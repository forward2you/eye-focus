import { advanceSession, BALL_RADIUS, createSession, getBounds, getPhase, resetTrail, TOTAL_DURATION, TRAIL_DURATION } from "./motion.mjs";

const canvas = document.getElementById("field");
const context = canvas.getContext("2d");
const toggle = document.getElementById("toggle");
const fullscreen = document.getElementById("fullscreen");
const phase = document.getElementById("phase");
const remaining = document.getElementById("remaining");
const status = document.getElementById("status");

if (!context) {
  status.textContent = "浏览器无法绘制动画，请更换支持 Canvas 的浏览器";
  toggle.disabled = true;
  throw new Error("Canvas 2D context is unavailable");
}

let width = 0;
let height = 0;
let bounds;
let session;
let running = false;
let previousTime = null;
let animationId = null;

function drawTrail(ball) {
  context.lineWidth = 3;
  context.lineCap = "round";
  for (let index = 1; index < ball.trail.length; index += 1) {
    const start = ball.trail[index - 1];
    const end = ball.trail[index];
    const opacity = point => Math.max(0, 1 - (ball.age - point.time) / TRAIL_DURATION) * 0.45;
    const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
    gradient.addColorStop(0, `rgba(140, 210, 164, ${opacity(start)})`);
    gradient.addColorStop(1, `rgba(140, 210, 164, ${opacity(end)})`);
    context.strokeStyle = gradient;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
}

function drawBall(ball) {
  const halo = context.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 38);
  halo.addColorStop(0, "#80e9a160");
  halo.addColorStop(0.35, "#6fdf9326");
  halo.addColorStop(1, "#63d98800");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(ball.x, ball.y, 38, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#99e5af80";
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(ball.x, ball.y, 16, 0, Math.PI * 2);
  context.stroke();

  const core = context.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, BALL_RADIUS);
  core.addColorStop(0, "#b8efc5");
  core.addColorStop(1, "#80d99b");
  context.fillStyle = core;
  context.beginPath();
  context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  context.fill();
}

function draw() {
  context.clearRect(0, 0, width, height);
  const currentPhase = getPhase(session.elapsed);
  if (currentPhase !== "complete") {
    for (const ball of session.balls) drawTrail(ball);
    for (const ball of session.balls) drawBall(ball);
  }
  phase.textContent = { single: "单球", dual: "双球", complete: "已结束" }[currentPhase];
  const seconds = Math.ceil((TOTAL_DURATION - session.elapsed) / 1000);
  remaining.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function layout() {
  const box = canvas.getBoundingClientRect();
  width = box.width;
  height = box.height;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  bounds = getBounds(width, height);
  if (!session) session = createSession(bounds);
  for (const ball of session.balls) {
    ball.x = Math.max(bounds.left, Math.min(bounds.right, ball.x));
    ball.y = Math.max(bounds.top, Math.min(bounds.bottom, ball.y));
    resetTrail(ball);
  }
  draw();
}

function advance(time) {
  if (previousTime !== null) advanceSession(session, time - previousTime, bounds);
  previousTime = time;
}

function stopAnimation() {
  running = false;
  cancelAnimationFrame(animationId);
  animationId = null;
  previousTime = null;
  toggle.setAttribute("aria-pressed", "false");
}

function finish() {
  stopAnimation();
  draw();
  toggle.textContent = "再来一次";
  status.textContent = "本轮两分钟已结束，请让眼睛休息一下";
}

function frame(time) {
  if (!running) return;
  const before = getPhase(session.elapsed);
  advance(time);
  draw();
  const after = getPhase(session.elapsed);
  if (after === "complete") {
    finish();
    return;
  }
  if (before !== after) status.textContent = "进入双球阶段；自然观看，不必强行同时追踪";
  animationId = requestAnimationFrame(frame);
}

function pause(message = "已暂停，准备好后可继续") {
  if (!running) return;
  advance(performance.now());
  if (getPhase(session.elapsed) === "complete") {
    finish();
    return;
  }
  stopAnimation();
  draw();
  toggle.textContent = "继续跟随";
  status.textContent = message;
}

toggle.addEventListener("click", () => {
  if (running) {
    pause();
    return;
  }
  if (getPhase(session.elapsed) === "complete") session = createSession(bounds);
  running = true;
  previousTime = performance.now();
  toggle.textContent = "暂停";
  toggle.setAttribute("aria-pressed", "true");
  status.textContent = getPhase(session.elapsed) === "single"
    ? "单球阶段；碰边反弹，尾迹显示运动路线"
    : "双球阶段；自然观看，不必强行同时追踪";
  draw();
  animationId = requestAnimationFrame(frame);
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && event.target === document.body) {
    event.preventDefault();
    toggle.click();
  }
  if (event.code === "Escape") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause("页面已离开，已自动暂停");
});
window.addEventListener("blur", () => pause("窗口已切换，已自动暂停"));
window.addEventListener("resize", () => {
  pause("显示区域已变化，已暂停");
  layout();
});
new ResizeObserver(layout).observe(canvas);

if (!document.fullscreenEnabled) fullscreen.hidden = true;
fullscreen.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    console.error("Fullscreen request failed:", error);
    status.textContent = "无法切换全屏，请使用浏览器的全屏菜单";
  }
});
document.addEventListener("fullscreenchange", () => {
  fullscreen.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
  pause("全屏状态已变化，已暂停");
});
layout();
