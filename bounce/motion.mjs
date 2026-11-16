export const SINGLE_DURATION = 60000;
export const TOTAL_DURATION = 120000;
export const BALL_SPEED = 90;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function getPhase(elapsed) {
  if (elapsed >= TOTAL_DURATION) return "complete";
  return elapsed >= SINGLE_DURATION ? "dual" : "single";
}

export function getBounds(width, height) {
  return { left: 44, right: width - 44, top: 108, bottom: height - 108 };
}

export function createBall(bounds, random = Math.random) {
  const angle = 0.35 + random() * 0.8;
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    vx: Math.cos(angle) * BALL_SPEED * (random() < 0.5 ? -1 : 1),
    vy: Math.sin(angle) * BALL_SPEED * (random() < 0.5 ? -1 : 1),
  };
}

export function advanceBall(ball, seconds, bounds, random = Math.random) {
  ball.x = clamp(ball.x, bounds.left, bounds.right);
  ball.y = clamp(ball.y, bounds.top, bounds.bottom);

  // Resolve time of impact so dropped frames cannot send a ball through a wall.
  while (seconds > 0) {
    const timeX = ball.vx > 0 ? (bounds.right - ball.x) / ball.vx : (bounds.left - ball.x) / ball.vx;
    const timeY = ball.vy > 0 ? (bounds.bottom - ball.y) / ball.vy : (bounds.top - ball.y) / ball.vy;
    const collisionTime = Math.max(0, Math.min(timeX, timeY));
    const travel = Math.min(seconds, collisionTime);
    ball.x = clamp(ball.x + ball.vx * travel, bounds.left, bounds.right);
    ball.y = clamp(ball.y + ball.vy * travel, bounds.top, bounds.bottom);
    seconds -= travel;
    if (collisionTime > travel) break;

    if (Math.abs(timeX - collisionTime) < 1e-8) ball.vx *= -1;
    if (Math.abs(timeY - collisionTime) < 1e-8) ball.vy *= -1;
    const angle = clamp(Math.atan2(Math.abs(ball.vy), Math.abs(ball.vx)) + (random() - 0.5) * 0.24, 0.3, 1.27);
    ball.vx = Math.sign(ball.vx) * Math.cos(angle) * BALL_SPEED;
    ball.vy = Math.sign(ball.vy) * Math.sin(angle) * BALL_SPEED;
  }
}

export function createSession(bounds, random = Math.random) {
  return { elapsed: 0, balls: [createBall(bounds, random)] };
}

export function advanceSession(session, milliseconds, bounds, random = Math.random) {
  const start = session.elapsed;
  const end = Math.min(TOTAL_DURATION, start + Math.max(0, milliseconds));
  if (start >= TOTAL_DURATION) return;

  const singleTime = Math.min(end, SINGLE_DURATION) - Math.min(start, SINGLE_DURATION);
  advanceBall(session.balls[0], singleTime / 1000, bounds, random);

  if (end >= SINGLE_DURATION && session.balls.length === 1) {
    const first = session.balls[0];
    const second = createBall(bounds, random);
    second.x = bounds.left + (bounds.right - bounds.left) * (first.x < second.x ? 0.75 : 0.25);
    second.y = bounds.top + (bounds.bottom - bounds.top) * (first.y < second.y ? 0.75 : 0.25);
    session.balls.push(second);
  }
  const dualTime = Math.max(0, end - SINGLE_DURATION) - Math.max(0, start - SINGLE_DURATION);
  if (dualTime > 0) {
    for (const ball of session.balls) advanceBall(ball, dualTime / 1000, bounds, random);
  }
  session.elapsed = end;
}
